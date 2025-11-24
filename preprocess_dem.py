#!/usr/bin/env python3
"""
preprocess_dem.py

Reads data/dem.tif (GeoTIFF DEM), downsamples to a manageable grid,
and writes data/grid.json for the browser to consume.

Usage:
  python3 preprocess_dem.py --input data/dem.tif --output data/grid.json --nx 150 --ny 100
"""

import argparse
import json
import numpy as np
import rasterio
from rasterio.enums import Resampling
from tqdm import tqdm

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', '-i', default='data/dem.tif', help='Input DEM GeoTIFF')
    parser.add_argument('--output', '-o', default='data/grid.json', help='Output JSON file')
    parser.add_argument('--nx', type=int, default=150, help='Grid columns (downsample to this)')
    parser.add_argument('--ny', type=int, default=100, help='Grid rows')
    parser.add_argument('--nodata', type=float, default=None, help='Value to treat as nodata')
    args = parser.parse_args()

    src_path = args.input
    out_path = args.output
    nx = args.nx
    ny = args.ny

    with rasterio.open(src_path) as src:
        print("Source CRS:", src.crs)
        print("Source bounds:", src.bounds)
        # read first band
        band1 = src.read(
            1,
            out_shape=(1, ny, nx),
            resampling=Resampling.bilinear
        ).astype(np.float32)

        # transform to get bounding box and coordinates
        left, bottom, right, top = src.bounds
        # Note: rasterio bounds are in same CRS as file. We assume geographic (lon/lat) or something that maps to lon/lat.
        # If your DEM is in projected CRS (e.g. UTM), reproject to EPSG:4326 first using gdalwarp or rasterio.
        # For safety, warn if CRS isn't EPSG:4326:
        if src.crs and src.crs.to_string() != 'EPSG:4326':
            print("WARNING: DEM CRS is not EPSG:4326. Consider reprojecting to EPSG:4326 for correct lon/lat coordinates.")

        # compute lons & lats arrays (linear spacing)
        lons = np.linspace(left, right, nx).tolist()
        lats = np.linspace(top, bottom, ny).tolist()  # top to bottom so row0 is top
        # Ensure nodata handled
        if args.nodata is None:
            nodata = src.nodata
        else:
            nodata = args.nodata
        elev = band1.tolist()
        # Replace nodata with None
        if nodata is not None:
            for i in range(len(elev)):
                row = elev[i]
                for j in range(len(row)):
                    if np.isclose(row[j], nodata):
                        row[j] = None

        out = {
            "bbox": [left, bottom, right, top],
            "ncols": nx,
            "nrows": ny,
            "lons": lons,
            "lats": lats,
            "elev": elev
        }

        with open(out_path, 'w') as f:
            json.dump(out, f)
        print("Wrote", out_path)

if __name__ == '__main__':
    main()
