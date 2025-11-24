const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Serve static files from public/
app.use(express.static(path.join(__dirname, 'public')));

// Serve data folder
app.use('/data', express.static(path.join(__dirname, 'data')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});
