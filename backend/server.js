// server.js (place in backend/)
const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const cors = require('cors');
const WebSocket = require('ws');
require('dotenv').config(); // Store secrets in .env

const app = express();
app.use(cors());
app.use(express.json());

// Google Sheets setup
const SHEET_ID = process.env.SHEET_ID;
const CLIENT_EMAIL = process.env.CLIENT_EMAIL;
const PRIVATE_KEY = process.env.PRIVATE_KEY ? process.env.PRIVATE_KEY.replace(/\\n/g, '\n') : '';
const doc = new GoogleSpreadsheet(SHEET_ID);

async function initSheet() {
  await doc.useServiceAccountAuth({
    client_email: CLIENT_EMAIL,
    private_key: PRIVATE_KEY,
  });
  await doc.loadInfo();
}
initSheet();

// REST API endpoints
app.get('/api/sensor-data', async (req, res) => {
  try {
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    const data = rows.map(row => ({
      timestamp: row.Timestamp,
      temperature: parseFloat(row['Temperature (°C)']),
      humidity: parseFloat(row['Humidity (%)']),
      gasLevel: parseInt(row['Gas Level'])
    }));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sensor-data/latest', async (req, res) => {
  try {
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    const latestRow = rows[rows.length - 1];
    res.json({
      timestamp: latestRow.Timestamp,
      temperature: parseFloat(latestRow['Temperature (°C)']),
      humidity: parseFloat(latestRow['Humidity (%)']),
      gasLevel: parseInt(latestRow['Gas Level'])
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket server for real-time updates
const wss = new WebSocket.Server({ port: 8080 });
wss.on('connection', ws => {
  console.log('Client connected');
});

// Broadcast latest data every 5 seconds
setInterval(async () => {
  try {
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    const latestRow = rows[rows.length - 1];
    const data = {
      timestamp: latestRow.Timestamp,
      temperature: parseFloat(latestRow['Temperature (°C)']),
      humidity: parseFloat(latestRow['Humidity (%)']),
      gasLevel: parseInt(latestRow['Gas Level'])
    };
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  } catch (error) {
    // Optionally log errors
  }
}, 5000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`REST API running on port ${PORT}`);
});
