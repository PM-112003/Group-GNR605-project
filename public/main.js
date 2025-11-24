// main.js
// Flood simulation using Cesium and preprocessed data/grid.json
// Expects grid.json format produced by preprocess_dem.py

// >>> CONFIG
const GRID_JSON = '/data/grid.json';  // ensure server serves /data
const CELL_OPACITY = 0.55;            // flood fill opacity
const CELL_BORDER = false;            // draw borders for debug
// <<< CONFIG

// Cesium initialization
window.CESIUM_BASE_URL = 'https://unpkg.com/cesium@latest/Build/Cesium/';

const viewer = new Cesium.Viewer('cesiumContainer', {
  timeline: false,
  animation: false,
  baseLayerPicker: true,
  // Using OpenStreetMap as an imagery provider (no token)
  imageryProvider: new Cesium.OpenStreetMapImageryProvider({
    url: 'https://a.tile.openstreetmap.org/'
  }),
  terrainProvider: Cesium.createWorldTerrain ? undefined : undefined,
  sceneModePicker: true,
  shouldAnimate: true
});

viewer.scene.globe.depthTestAgainstTerrain = true;

// UI Elements
const waterSlider = document.getElementById('waterSlider');
const waterValue = document.getElementById('waterValue');
const playBtn = document.getElementById('playBtn');
const resetBtn = document.getElementById('resetBtn');

let gridData = null;
let entities = [];
let playing = false;
let playInterval = null;

function setWaterSlider(val) {
  waterSlider.value = val;
  waterValue.innerText = val;
}

// load grid.json
fetch(GRID_JSON)
  .then(r => {
    if (!r.ok) throw new Error('Failed to fetch ' + GRID_JSON);
    return r.json();
  })
  .then(data => {
    gridData = data;
    console.log('Loaded grid:', gridData.ncols, 'x', gridData.nrows, 'bbox', gridData.bbox);
    locateAndRender();
  })
  .catch(err => {
    console.error(err);
    alert('Error loading grid.json. Make sure you ran preprocess_dem.py and placed the file in /data/grid.json\nSee console for details.');
  });

function locateAndRender() {
  const { bbox, ncols, nrows, lons, lats, elev } = gridData;
  const [minLon, minLat, maxLon, maxLat] = bbox;

  // Zoom viewer to bbox
  const rectangle = Cesium.Rectangle.fromDegrees(minLon, minLat, maxLon, maxLat);
  viewer.camera.flyTo({
    destination: rectangle,
    duration: 1.2
  });

  // Initialize water slider range based on min/max elevation
  let flatElevs = elev.flat().filter(v => v !== null && isFinite(v));
  const minE = Math.min(...flatElevs);
  const maxE = Math.max(...flatElevs);
  waterSlider.min = Math.floor(minE - 5);
  waterSlider.max = Math.ceil(maxE + 10);
  waterSlider.step = 0.5;
  setWaterSlider(0);

  // Build entities grid (but do not set visibility yet). We'll create one entity per cell.
  // To avoid huge counts, use the provided ncols x nrows; preprocess controls that.
  clearEntities();

  // iterate rows (lats) and cols (lons).
  // Note: elev array rows correspond to lats order used in preprocess (top->bottom)
  for (let r = 0; r < nrows - 1; r++) {
    for (let c = 0; c < ncols - 1; c++) {
      const lon0 = lons[c];
      const lon1 = lons[c + 1];
      const lat0 = lats[r + 1]; // bottom of cell
      const lat1 = lats[r];     // top of cell

      const cellElev = elev[r][c]; // may be null

      // create entity for this cell
      const rect = Cesium.Rectangle.fromDegrees(lon0, lat0, lon1, lat1);

      const ent = viewer.entities.add({
        rectangle: {
          coordinates: rect,
          material: Cesium.Color.BLUE.withAlpha(0.0), // start transparent
          height: 0,
          extrudedHeight: 0,
          outline: CELL_BORDER,
          outlineColor: Cesium.Color.BLACK
        },
        properties: {
          elev: cellElev
        }
      });

      entities.push(ent);
    }
  }

  // initial render with water level (0)
  updateFlood(parseFloat(waterSlider.value));
}

function clearEntities() {
  entities.forEach(e => viewer.entities.remove(e));
  entities = [];
}

function updateFlood(waterLevel) {
  waterValue.innerText = waterLevel;
  if (!gridData) return;
  const { ncols, nrows } = gridData;

  let idx = 0;
  for (let r = 0; r < nrows - 1; r++) {
    for (let c = 0; c < ncols - 1; c++) {
      const ent = entities[idx++];
      const elevVal = ent.properties.elev;
      if (elevVal === null || !isFinite(elevVal)) {
        // unknown elevation -> transparent
        ent.rectangle.material = Cesium.Color.TRANSPARENT;
        ent.rectangle.height = 0;
        ent.rectangle.extrudedHeight = 0;
        ent.show = false;
        continue;
      }

      if (elevVal < waterLevel) {
        // flooded: show rectangle at waterLevel with some thickness
        const thickness = 0.5; // small thickness so top surface visible
        ent.rectangle.material = Cesium.Color.BLUE.withAlpha(CELL_OPACITY);
        // Use height and extrudedHeight to show a slab from (waterLevel - thickness) to waterLevel
        ent.rectangle.height = waterLevel - thickness;
        ent.rectangle.extrudedHeight = waterLevel;
        ent.show = true;
      } else {
        // not flooded: hide
        ent.rectangle.material = Cesium.Color.TRANSPARENT;
        ent.rectangle.height = 0;
        ent.rectangle.extrudedHeight = 0;
        ent.show = false;
      }
    }
  }
}

// slider event
waterSlider.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  updateFlood(val);
});

// play / animate water rising
playBtn.addEventListener('click', () => {
  if (!playing) {
    playing = true;
    playBtn.innerText = 'Pause';
    playInterval = setInterval(() => {
      let val = parseFloat(waterSlider.value);
      val += 0.25; // rise speed
      if (val > parseFloat(waterSlider.max)) {
        val = parseFloat(waterSlider.max);
        stopPlaying();
      }
      setWaterSlider(val);
      updateFlood(val);
    }, 120);
  } else {
    stopPlaying();
  }
});

function stopPlaying() {
  playing = false;
  playBtn.innerText = 'Play rise';
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
  }
}

resetBtn.addEventListener('click', () => {
  stopPlaying();
  setWaterSlider(0);
  updateFlood(0);
});
