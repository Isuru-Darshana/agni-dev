process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const cors = require('cors');
const WebSocket = require('ws');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ── State ─────────────────────────────────────────────
let sheetsReady = false;

// ── Health Check (must be first) ──────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'agni-guard-backend',
    sheets: sheetsReady ? 'connected' : 'connecting'
  });
});

// ── Google Sheets Configuration ───────────────────────
const SHEET_ID = process.env.SHEET_ID;
const CLIENT_EMAIL = process.env.CLIENT_EMAIL;
const PRIVATE_KEY = process.env.PRIVATE_KEY
  ? process.env.PRIVATE_KEY.replace(/\\n/g, '\n')
  : '';

const doc = new GoogleSpreadsheet(SHEET_ID);

async function initSheet() {
  try {
    await doc.useServiceAccountAuth({
      client_email: CLIENT_EMAIL,
      private_key: PRIVATE_KEY,
    });
    await doc.loadInfo();
    sheetsReady = true;
    console.log(`✅ Connected to Google Sheets: ${doc.title}`);
  } catch (err) {
    console.error('❌ Google Sheets init failed:', err.message);
    /* istanbul ignore next */
    setTimeout(initSheet, 30000);
  }
}

/* istanbul ignore next */
if (process.env.NODE_ENV !== 'test') {
  initSheet();
}

// ── Helper: Parse NodeData Row ────────────────────────
function parseNodeRow(row) {
  return {
    timestamp:     row['Timestamp'],
    nodeId:        parseInt(row['Node ID'])                || 0,
    online:        row['Online'] === 'Online',
    temp680:       parseFloat(row['T680 (°C)'])            || 0,
    humidity680:   parseFloat(row['H680 (%)'])             || 0,
    pressure680:   parseFloat(row['P680 (hPa)'])           || 0,
    gasResistance: parseFloat(row['Gas R (Ω)'])            || 0,
    temp280:       parseFloat(row['T280 (°C)'])            || 0,
    humidity280:   parseFloat(row['H280 (%)'])             || 0,
    pressure280:   parseFloat(row['P280 (hPa)'])           || 0,
    pm25:          parseFloat(row['PM2.5 (µg/m³)'])        || 0,
    pm10:          parseFloat(row['PM10 (µg/m³)'])         || 0,
    tempFused:     parseFloat(row['Temp Fused (°C)'])      || 0,
    humidityFused: parseFloat(row['Humidity Fused (%)'])   || 0,
    pressureFused: parseFloat(row['Pressure Fused (hPa)']) || 0,
    gasRatio:      parseFloat(row['Gas Ratio'])            || 0,
    riskScore:     parseFloat(row['Risk Score'])           || 0,
    fireStage:     parseInt(row['Fire Stage'])             || 0,
    stageName:     row['Stage Name']                       || 'NORMAL',
    tempRate:      parseFloat(row['Temp Rate (°C/min)'])   || 0,
    humidityRate:  parseFloat(row['Humidity Rate (%/min)'])|| 0,
    gasRate:       parseFloat(row['Gas Rate (Ω/min)'])     || 0,
    soc:           parseFloat(row['SOC (%)'])              || 0,
    rssi:          parseInt(row['RSSI (dBm)'])             || 0,
    interval:      parseFloat(row['Interval (min)'])       || 0
  };
}

// ── REST API Endpoints ────────────────────────────────

app.get('/api/sensor-data', async (req, res) => {
  if (!sheetsReady) {
    return res.status(503).json({ error: 'Service initializing' });
  }
  try {
    const sheet = doc.sheetsByIndex[1];
    const rows = await sheet.getRows();
    console.log(`Fetched ${rows.length} rows from NodeData`);
    res.json(rows.map(parseNodeRow));
  } catch (error) {
    console.error('Error fetching sensor data:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sensor-data/latest', async (req, res) => {
  if (!sheetsReady) {
    return res.status(503).json({ error: 'Service initializing' });
  }
  try {
    const sheet = doc.sheetsByIndex[1];
    const rows = await sheet.getRows();
    res.json(parseNodeRow(rows[rows.length - 1]));
  } catch (error) {
    console.error('Error fetching latest data:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/aggregate', async (req, res) => {
  if (!sheetsReady) {
    return res.status(503).json({ error: 'Service initializing' });
  }
  try {
    const sheet = doc.sheetsByIndex[2];
    const rows = await sheet.getRows();
    const latestRow = rows[rows.length - 1];
    res.json({
      timestamp:     latestRow['Timestamp'],
      totalNodes:    parseInt(latestRow['Total Nodes'])    || 0,
      online:        parseInt(latestRow['Online'])          || 0,
      offline:       parseInt(latestRow['Offline'])         || 0,
      tempAvg:       parseFloat(latestRow['Temp Avg'])      || 0,
      humidityAvg:   parseFloat(latestRow['Humidity Avg'])  || 0,
      pm25Avg:       parseFloat(latestRow['PM2.5 Avg'])     || 0,
      gasRatioAvg:   parseFloat(latestRow['Gas Ratio Avg']) || 0,
      riskAvg:       parseFloat(latestRow['Risk Avg'])      || 0,
      riskMax:       parseFloat(latestRow['Risk Max'])      || 0,
      fireStage:     parseInt(latestRow['Fire Stage'])      || 0,
      stageName:     latestRow['Stage Name']               || 'NORMAL',
      normalCount:   parseInt(latestRow['Normal Count'])    || 0,
      alertCount:    parseInt(latestRow['Alert Count'])     || 0,
      elevatedCount: parseInt(latestRow['Elevated Count'])  || 0,
      criticalCount: parseInt(latestRow['Critical Count'])  || 0
    });
  } catch (error) {
    console.error('Error fetching aggregate:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/alerts', async (req, res) => {
  if (!sheetsReady) {
    return res.status(503).json({ error: 'Service initializing' });
  }
  try {
    const sheet = doc.sheetsByIndex[3];
    const rows = await sheet.getRows();
    res.json(rows.map(row => ({
      timestamp: row['Timestamp'],
      nodeId:    parseInt(row['Node ID']) || 0,
      alertType: row['Alert Type']        || '',
      message:   row['Message']           || '',
      resolved:  row['Resolved'] === 'Yes'
    })));
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── 404 Handler ───────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── WebSocket Server ──────────────────────────────────
const WS_PORT = process.env.WS_PORT || 8080;

/* istanbul ignore next */
if (process.env.NODE_ENV !== 'test') {
  const wss = new WebSocket.Server({ port: WS_PORT });

  wss.on('connection', ws => {
    console.log(`WebSocket client connected. Total: ${wss.clients.size}`);
    ws.on('error', console.error);
    ws.on('close', () => {
      console.log(`Client disconnected. Total: ${wss.clients.size}`);
    });
  });

  setInterval(async () => {
    if (!sheetsReady) return;
    try {
      const nodeSheet = doc.sheetsByIndex[1];
      const aggSheet  = doc.sheetsByIndex[2];
      const nodeRows  = await nodeSheet.getRows();
      const aggRows   = await aggSheet.getRows();
      const data = {
        node: parseNodeRow(nodeRows[nodeRows.length - 1]),
        aggregate: {
          stageName:  aggRows[aggRows.length - 1]['Stage Name'] || 'NORMAL',
          riskAvg:    parseFloat(aggRows[aggRows.length - 1]['Risk Avg'])     || 0,
          online:     parseInt(aggRows[aggRows.length - 1]['Online'])         || 0,
          totalNodes: parseInt(aggRows[aggRows.length - 1]['Total Nodes'])    || 0
        },
        broadcastTime: new Date().toISOString()
      };
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    } catch (error) {
      console.error('WebSocket broadcast error:', error);
    }
  }, 5000);
}

// ── Graceful Shutdown ─────────────────────────────────
/* istanbul ignore next */
process.on('SIGTERM', () => {
  console.log('SIGTERM received - shutting down gracefully');
  process.exit(0);
});

// ── Start Server ──────────────────────────────────────
const PORT = process.env.PORT || 3000;

/* istanbul ignore next */
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`✅ REST API running on port ${PORT}`);
    console.log(`✅ WebSocket running on port ${WS_PORT}`);
  });
}

// ── Test Helper ───────────────────────────────────────
app.setTestMode = () => {
  sheetsReady = true;
};

module.exports = app;