process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const cors = require('cors');
const WebSocket = require('ws');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ── State ─────────────────────────────────────────────
let sheetsReady = false;
let doc = null;
let headerMap = {};

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
  ? process.env.PRIVATE_KEY
      .replace(/\\n/g, '\n')
      .replace(/\r/g, '')
      .trim()
  : '';

async function buildHeaderMap(sheet) {
  await sheet.loadHeaderRow();
  headerMap = {};
  // Include ALL positions including empty headers
  sheet.headerValues.forEach((header, index) => {
    if (header && header.trim()) {
      headerMap[header.trim()] = index;
    }
  });
  console.log('✅ Header map built:', JSON.stringify(headerMap));
  console.log('✅ Total header positions:', sheet.headerValues.length);
}
async function initSheet() {
  try {
    const jwt = new JWT({
      email: CLIENT_EMAIL,
      key: PRIVATE_KEY,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
      ],
    });
    doc = new GoogleSpreadsheet(SHEET_ID, jwt);
    await doc.loadInfo();
    await buildHeaderMap(doc.sheetsByIndex[1]);
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

// ── Helper: Get value from row by header name ─────────
function getVal(row, name) {
  // For test mocks - check direct property first
  if (!row._rawData && row[name] !== undefined) {
    return row[name];
  }
  // For real Google Sheets rows - use header map index
  const d = row._rawData || [];
  const index = headerMap[name];
  if (index !== undefined && d[index] !== undefined) {
    return d[index];
  }
  return '';
}

// ── Helper: Check if row has valid data ───────────────
function isValidRow(row) {
  const nodeId = parseInt(getVal(row, 'Node ID'));
  return !isNaN(nodeId) && nodeId > 0;
}

// ── Helper: Parse NodeData Row ────────────────────────
function parseNodeRow(row) {
  return {
    timestamp:     getVal(row, 'Timestamp'),
    nodeId:        parseInt(getVal(row, 'Node ID'))                || 0,
    online:        getVal(row, 'Online')                           === 'Online',
    temp680:       parseFloat(getVal(row, 'T680 (°C)'))            || 0,
    humidity680:   parseFloat(getVal(row, 'H680 (%)'))             || 0,
    pressure680:   parseFloat(getVal(row, 'P680 (hPa)'))           || 0,
    gasResistance: parseFloat(getVal(row, 'Gas R (Ω)'))            || 0,
    temp280:       parseFloat(getVal(row, 'T280 (°C)'))            || 0,
    humidity280:   parseFloat(getVal(row, 'H280 (%)'))             || 0,
    pressure280:   parseFloat(getVal(row, 'P280 (hPa)'))           || 0,
    pm25:          parseFloat(getVal(row, 'PM2.5 (µg/m³)'))        || 0,
    pm10:          parseFloat(getVal(row, 'PM10 (µg/m³)'))         || 0,
    tempFused:     parseFloat(getVal(row, 'Temp Fused (°C)'))      || 0,
    humidityFused: parseFloat(getVal(row, 'Humidity Fused (%)'))   || 0,
    pressureFused: parseFloat(getVal(row, 'Pressure Fused (hPa)')) || 0,
    gasRatio:      parseFloat(getVal(row, 'Gas Ratio'))            || 0,
    riskScore:     parseFloat(getVal(row, 'Risk Score'))           || 0,
    fireStage:     parseInt(getVal(row, 'Fire Stage'))             || 0,
    stageName:     getVal(row, 'Stage Name')                       || 'NORMAL',
    tempRate:      parseFloat(getVal(row, 'Temp Rate (°C/min)'))   || 0,
    humidityRate:  parseFloat(getVal(row, 'Humidity Rate (%/min)'))|| 0,
    gasRate:       parseFloat(getVal(row, 'Gas Rate (Ω/min)'))     || 0,
    soc:           parseFloat(getVal(row, 'SOC (%)'))              || 0,
    rssi:          parseInt(getVal(row, 'RSSI (dBm)'))             || 0,
    interval:      parseFloat(getVal(row, 'Interval (min)'))       || 0
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
    const validRows = rows.filter(isValidRow);
    console.log(`Valid rows: ${validRows.length}`);
    res.json(validRows.map(parseNodeRow));
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

    let lastValidRow = null;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (isValidRow(rows[i])) {
        lastValidRow = rows[i];
        break;
      }
    }

    if (!lastValidRow) {
      return res.status(404).json({ error: 'No valid data found' });
    }

    res.json(parseNodeRow(lastValidRow));
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
      timestamp:     getVal(latestRow, 'Timestamp'),
      totalNodes:    parseInt(getVal(latestRow, 'Total Nodes'))    || 0,
      online:        parseInt(getVal(latestRow, 'Online'))          || 0,
      offline:       parseInt(getVal(latestRow, 'Offline'))         || 0,
      tempAvg:       parseFloat(getVal(latestRow, 'Temp Avg'))      || 0,
      humidityAvg:   parseFloat(getVal(latestRow, 'Humidity Avg'))  || 0,
      pm25Avg:       parseFloat(getVal(latestRow, 'PM2.5 Avg'))     || 0,
      gasRatioAvg:   parseFloat(getVal(latestRow, 'Gas Ratio Avg')) || 0,
      riskAvg:       parseFloat(getVal(latestRow, 'Risk Avg'))      || 0,
      riskMax:       parseFloat(getVal(latestRow, 'Risk Max'))      || 0,
      fireStage:     parseInt(getVal(latestRow, 'Fire Stage'))      || 0,
      stageName:     getVal(latestRow, 'Stage Name')               || 'NORMAL',
      normalCount:   parseInt(getVal(latestRow, 'Normal Count'))    || 0,
      alertCount:    parseInt(getVal(latestRow, 'Alert Count'))     || 0,
      elevatedCount: parseInt(getVal(latestRow, 'Elevated Count'))  || 0,
      criticalCount: parseInt(getVal(latestRow, 'Critical Count'))  || 0
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
      timestamp: getVal(row, 'Timestamp'),
      nodeId:    parseInt(getVal(row, 'Node ID')) || 0,
      alertType: getVal(row, 'Alert Type')        || '',
      message:   getVal(row, 'Message')           || '',
      resolved:  getVal(row, 'Resolved')          === 'Yes'
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

      let lastValidNode = null;
      for (let i = nodeRows.length - 1; i >= 0; i--) {
        if (isValidRow(nodeRows[i])) {
          lastValidNode = nodeRows[i];
          break;
        }
      }

      if (!lastValidNode) return;

      const lastAgg = aggRows[aggRows.length - 1];
      const data = {
        node: parseNodeRow(lastValidNode),
        aggregate: {
          stageName:  getVal(lastAgg, 'Stage Name') || 'NORMAL',
          riskAvg:    parseFloat(getVal(lastAgg, 'Risk Avg'))     || 0,
          online:     parseInt(getVal(lastAgg, 'Online'))         || 0,
          totalNodes: parseInt(getVal(lastAgg, 'Total Nodes'))    || 0
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
app.setTestMode = (ready = true) => {
  sheetsReady = ready;
  if (ready) doc = new GoogleSpreadsheet();
};
app.getDoc = () => doc;
app.buildHeaderMapForTest = buildHeaderMap;
app.initSheetForTest = initSheet;

module.exports = app;