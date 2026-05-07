process.env.NODE_ENV = 'test';

const request = require('supertest');

// ── Mock google-auth-library ──────────────────────────
jest.mock('google-auth-library', () => ({
  JWT: jest.fn().mockImplementation(() => ({}))
}));

// ── Mock Google Sheets ────────────────────────────────
jest.mock('google-spreadsheet', () => ({
  GoogleSpreadsheet: jest.fn().mockImplementation(() => ({
    useServiceAccountAuth: jest.fn().mockResolvedValue(true),
    loadInfo: jest.fn().mockResolvedValue(true),
    title: 'AGNI GUARD Test Sheet',
    sheetsByIndex: [
      {
        getRows: jest.fn().mockResolvedValue([
          { Timestamp: '46013', 'Event Type': 'TEST', Details: 'test' }
        ])
      },
      {
        loadHeaderRow: jest.fn().mockResolvedValue(true),
        headerValues: [
          'Node ID', '', 'Online', 'T680 (°C)', 'H680 (%)', 'P680 (hPa)',
          'Gas R (Ω)', 'T280 (°C)', 'H280 (%)', 'P280 (hPa)',
          'PM2.5 (µg/m³)', 'PM10 (µg/m³)', 'Temp Fused (°C)',
          'Humidity Fused (%)', 'Pressure Fused (hPa)', 'Gas Ratio',
          'Risk Score', 'Fire Stage', 'Stage Name',
          'Temp Rate (°C/min)', 'Humidity Rate (%/min)', 'Gas Rate (Ω/min)',
          'SOC (%)', 'RSSI (dBm)', 'Interval (min)', 'Timestamp'
        ],
        getRows: jest.fn().mockResolvedValue([
          {
            'Timestamp':              '2024-01-01 10:00:00',
            'Node ID':                '1',
            'Online':                 'Online',
            'T680 (°C)':              '31.2',
            'H680 (%)':               '58.4',
            'P680 (hPa)':             '956.31',
            'Gas R (Ω)':              '40.11',
            'T280 (°C)':              '29.9',
            'H280 (%)':               '55.5',
            'P280 (hPa)':             '955.85',
            'PM2.5 (µg/m³)':          '20.0',
            'PM10 (µg/m³)':           '22.0',
            'Temp Fused (°C)':        '30.3',
            'Humidity Fused (%)':     '56.4',
            'Pressure Fused (hPa)':   '956.08',
            'Gas Ratio':              '0.39',
            'Risk Score':             '22.5',
            'Fire Stage':             '0',
            'Stage Name':             'NORMAL',
            'Temp Rate (°C/min)':     '0.5',
            'Humidity Rate (%/min)':  '-0.3',
            'Gas Rate (Ω/min)':       '-100.0',
            'SOC (%)':                '54.0',
            'RSSI (dBm)':             '-48',
            'Interval (min)':         '5.0'
          }
        ])
      },
      {
        getRows: jest.fn().mockResolvedValue([
          {
            'Timestamp':        '2024-01-01 10:00:00',
            'Total Nodes':      '6',
            'Online':           '5',
            'Offline':          '1',
            'Temp Avg':         '30.3',
            'Humidity Avg':     '56.4',
            'PM2.5 Avg':        '20.0',
            'Gas Ratio Avg':    '0.39',
            'Risk Avg':         '22.5',
            'Risk Max':         '45.0',
            'Fire Stage':       '0',
            'Stage Name':       'NORMAL',
            'Normal Count':     '4',
            'Alert Count':      '1',
            'Elevated Count':   '0',
            'Critical Count':   '0'
          }
        ])
      },
      {
        getRows: jest.fn().mockResolvedValue([
          {
            'Timestamp':    '2024-01-01 10:00:00',
            'Node ID':      '1',
            'Alert Type':   'LOW_GAS',
            'Message':      'Node 1 Gas=0.38',
            'Resolved':     'No'
          }
        ])
      }
    ]
  }))
}));

const app = require('../server');

// ── Enable test mode ──────────────────────────────────
beforeAll(() => {
  app.setTestMode();
});

// ── Test Suites ───────────────────────────────────────
describe('AGNI GUARD Backend API', () => {

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── Health Endpoint ─────────────────────────────────
  describe('Health Endpoint', () => {
    test('GET /health returns 200', async () => {
      const res = await request(app).get('/health');
      expect(res.statusCode).toBe(200);
    });

    test('GET /health returns ok status', async () => {
      const res = await request(app).get('/health');
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('service', 'agni-guard-backend');
    });

    test('GET /health returns timestamp', async () => {
      const res = await request(app).get('/health');
      expect(res.body).toHaveProperty('timestamp');
      expect(typeof res.body.timestamp).toBe('string');
    });

    test('GET /health returns sheets status', async () => {
      const res = await request(app).get('/health');
      expect(res.body).toHaveProperty('sheets');
    });
  });

  // ── Sensor Data ─────────────────────────────────────
  describe('GET /api/sensor-data', () => {
    test('returns 200', async () => {
      const res = await request(app).get('/api/sensor-data');
      expect(res.statusCode).toBe(200);
    });

    test('returns array', async () => {
      const res = await request(app).get('/api/sensor-data');
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('has correct sensor fields', async () => {
      const res = await request(app).get('/api/sensor-data');
      const reading = res.body[0];
      expect(reading).toHaveProperty('nodeId');
      expect(reading).toHaveProperty('tempFused');
      expect(reading).toHaveProperty('humidityFused');
      expect(reading).toHaveProperty('gasRatio');
      expect(reading).toHaveProperty('riskScore');
      expect(reading).toHaveProperty('stageName');
    });

    test('values are numbers not strings', async () => {
      const res = await request(app).get('/api/sensor-data');
      const reading = res.body[0];
      expect(typeof reading.tempFused).toBe('number');
      expect(typeof reading.riskScore).toBe('number');
    });

    test('has both BME680 and BME280 readings', async () => {
      const res = await request(app).get('/api/sensor-data');
      const reading = res.body[0];
      expect(reading).toHaveProperty('temp680');
      expect(reading).toHaveProperty('temp280');
      expect(reading).toHaveProperty('tempFused');
    });

    test('online status is boolean', async () => {
      const res = await request(app).get('/api/sensor-data');
      expect(typeof res.body[0].online).toBe('boolean');
    });

    test('has battery and signal fields', async () => {
      const res = await request(app).get('/api/sensor-data');
      const reading = res.body[0];
      expect(reading).toHaveProperty('soc');
      expect(reading).toHaveProperty('rssi');
    });

    test('fire stage is valid number', async () => {
      const res = await request(app).get('/api/sensor-data');
      expect(typeof res.body[0].fireStage).toBe('number');
      expect(res.body[0].fireStage).toBeGreaterThanOrEqual(0);
    });

    test('risk score is within valid range 0-100', async () => {
      const res = await request(app).get('/api/sensor-data');
      expect(res.body[0].riskScore).toBeGreaterThanOrEqual(0);
      expect(res.body[0].riskScore).toBeLessThanOrEqual(100);
    });

    test('has rate of change fields', async () => {
      const res = await request(app).get('/api/sensor-data');
      const reading = res.body[0];
      expect(reading).toHaveProperty('tempRate');
      expect(reading).toHaveProperty('humidityRate');
      expect(reading).toHaveProperty('gasRate');
    });

    test('has particulate matter fields', async () => {
      const res = await request(app).get('/api/sensor-data');
      const reading = res.body[0];
      expect(reading).toHaveProperty('pm25');
      expect(reading).toHaveProperty('pm10');
    });
  });

  // ── Latest Sensor Data ──────────────────────────────
  describe('GET /api/sensor-data/latest', () => {
    test('returns 200', async () => {
      const res = await request(app)
        .get('/api/sensor-data/latest');
      expect(res.statusCode).toBe(200);
    });

    test('returns object not array', async () => {
      const res = await request(app)
        .get('/api/sensor-data/latest');
      expect(Array.isArray(res.body)).toBe(false);
    });

    test('has all AGNI GUARD fields', async () => {
      const res = await request(app)
        .get('/api/sensor-data/latest');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('nodeId');
      expect(res.body).toHaveProperty('tempFused');
      expect(res.body).toHaveProperty('humidityFused');
      expect(res.body).toHaveProperty('gasRatio');
      expect(res.body).toHaveProperty('riskScore');
      expect(res.body).toHaveProperty('stageName');
      expect(res.body).toHaveProperty('soc');
      expect(res.body).toHaveProperty('rssi');
    });

    test('stageName is valid fire stage', async () => {
      const res = await request(app)
        .get('/api/sensor-data/latest');
      const validStages = [
        'NORMAL', 'ALERT', 'ELEVATED', 'CRITICAL', 'RAIN'
      ];
      expect(validStages).toContain(res.body.stageName);
    });

    test('pressure readings exist', async () => {
      const res = await request(app)
        .get('/api/sensor-data/latest');
      expect(res.body).toHaveProperty('pressure680');
      expect(res.body).toHaveProperty('pressure280');
      expect(res.body).toHaveProperty('pressureFused');
    });
  });

  // ── Aggregate Data ──────────────────────────────────
  describe('GET /api/aggregate', () => {
    test('returns 200', async () => {
      const res = await request(app).get('/api/aggregate');
      expect(res.statusCode).toBe(200);
    });

    test('has system summary fields', async () => {
      const res = await request(app).get('/api/aggregate');
      expect(res.body).toHaveProperty('totalNodes');
      expect(res.body).toHaveProperty('online');
      expect(res.body).toHaveProperty('riskAvg');
      expect(res.body).toHaveProperty('stageName');
      expect(res.body).toHaveProperty('criticalCount');
    });

    test('online count is non negative', async () => {
      const res = await request(app).get('/api/aggregate');
      expect(res.body.online).toBeGreaterThanOrEqual(0);
    });

    test('risk average is within range', async () => {
      const res = await request(app).get('/api/aggregate');
      expect(res.body.riskAvg).toBeGreaterThanOrEqual(0);
      expect(res.body.riskAvg).toBeLessThanOrEqual(100);
    });

    test('stage counts are non negative', async () => {
      const res = await request(app).get('/api/aggregate');
      expect(res.body.normalCount).toBeGreaterThanOrEqual(0);
      expect(res.body.alertCount).toBeGreaterThanOrEqual(0);
      expect(res.body.elevatedCount).toBeGreaterThanOrEqual(0);
      expect(res.body.criticalCount).toBeGreaterThanOrEqual(0);
    });

    test('total nodes matches mock data', async () => {
      const res = await request(app).get('/api/aggregate');
      expect(res.body.totalNodes).toBe(6);
    });

    test('has environmental averages', async () => {
      const res = await request(app).get('/api/aggregate');
      expect(res.body).toHaveProperty('tempAvg');
      expect(res.body).toHaveProperty('humidityAvg');
      expect(res.body).toHaveProperty('pm25Avg');
    });
  });

  // ── Alerts ──────────────────────────────────────────
  describe('GET /api/alerts', () => {
    test('returns 200', async () => {
      const res = await request(app).get('/api/alerts');
      expect(res.statusCode).toBe(200);
    });

    test('returns array', async () => {
      const res = await request(app).get('/api/alerts');
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('alert has required fields', async () => {
      const res = await request(app).get('/api/alerts');
      const alert = res.body[0];
      expect(alert).toHaveProperty('timestamp');
      expect(alert).toHaveProperty('nodeId');
      expect(alert).toHaveProperty('alertType');
      expect(alert).toHaveProperty('message');
      expect(alert).toHaveProperty('resolved');
    });

    test('resolved field is boolean', async () => {
      const res = await request(app).get('/api/alerts');
      expect(typeof res.body[0].resolved).toBe('boolean');
    });

    test('alert type is string', async () => {
      const res = await request(app).get('/api/alerts');
      expect(typeof res.body[0].alertType).toBe('string');
    });

    test('unresolved alert has resolved false', async () => {
      const res = await request(app).get('/api/alerts');
      expect(res.body[0].resolved).toBe(false);
    });
  });

  // ── Error Handling ──────────────────────────────────
  describe('Error Handling', () => {
    test('unknown route returns 404', async () => {
      const res = await request(app).get('/api/unknown');
      expect(res.statusCode).toBe(404);
    });

    test('unknown route returns json error message', async () => {
      const res = await request(app).get('/api/unknown');
      expect(res.body).toHaveProperty('error');
    });
  });

  // ── 503 When Sheets Not Ready ────────────────────────
  describe('503 when sheets not initialised', () => {
    afterEach(() => {
      app.setTestMode(true);
    });

    test('GET /api/sensor-data returns 503', async () => {
      app.setTestMode(false);
      const res = await request(app).get('/api/sensor-data');
      expect(res.statusCode).toBe(503);
      expect(res.body).toHaveProperty('error', 'Service initializing');
    });

    test('GET /api/sensor-data/latest returns 503', async () => {
      app.setTestMode(false);
      const res = await request(app).get('/api/sensor-data/latest');
      expect(res.statusCode).toBe(503);
      expect(res.body).toHaveProperty('error', 'Service initializing');
    });

    test('GET /api/aggregate returns 503', async () => {
      app.setTestMode(false);
      const res = await request(app).get('/api/aggregate');
      expect(res.statusCode).toBe(503);
      expect(res.body).toHaveProperty('error', 'Service initializing');
    });

    test('GET /api/alerts returns 503', async () => {
      app.setTestMode(false);
      const res = await request(app).get('/api/alerts');
      expect(res.statusCode).toBe(503);
      expect(res.body).toHaveProperty('error', 'Service initializing');
    });
  });

  // ── 500 Error Handling ───────────────────────────────
  describe('500 when sheet throws', () => {
    afterEach(() => {
      app.setTestMode(true);
    });

    test('GET /api/sensor-data returns 500 on sheet error', async () => {
      app.setTestMode(true);
      app.getDoc().sheetsByIndex[1].getRows.mockRejectedValueOnce(new Error('Sheet read failed'));
      const res = await request(app).get('/api/sensor-data');
      expect(res.statusCode).toBe(500);
      expect(res.body).toHaveProperty('error');
    });

    test('GET /api/sensor-data/latest returns 500 on sheet error', async () => {
      app.setTestMode(true);
      app.getDoc().sheetsByIndex[1].getRows.mockRejectedValueOnce(new Error('Sheet read failed'));
      const res = await request(app).get('/api/sensor-data/latest');
      expect(res.statusCode).toBe(500);
      expect(res.body).toHaveProperty('error');
    });

    test('GET /api/aggregate returns 500 on sheet error', async () => {
      app.setTestMode(true);
      app.getDoc().sheetsByIndex[2].getRows.mockRejectedValueOnce(new Error('Sheet read failed'));
      const res = await request(app).get('/api/aggregate');
      expect(res.statusCode).toBe(500);
      expect(res.body).toHaveProperty('error');
    });

    test('GET /api/alerts returns 500 on sheet error', async () => {
      app.setTestMode(true);
      app.getDoc().sheetsByIndex[3].getRows.mockRejectedValueOnce(new Error('Sheet read failed'));
      const res = await request(app).get('/api/alerts');
      expect(res.statusCode).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
  });

  // ── 404 No Data ──────────────────────────────────────
  describe('404 when no valid rows', () => {
    afterEach(() => {
      app.setTestMode(true);
    });

    test('GET /api/sensor-data/latest returns 404 when no valid rows', async () => {
      app.setTestMode(true);
      app.getDoc().sheetsByIndex[1].getRows.mockResolvedValueOnce([]);
      const res = await request(app).get('/api/sensor-data/latest');
      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error', 'No valid data found');
    });

    test('GET /api/sensor-data/latest returns 404 when all rows invalid', async () => {
      app.setTestMode(true);
      app.getDoc().sheetsByIndex[1].getRows.mockResolvedValueOnce([
        { 'Node ID': 'bad' }, { 'Node ID': '' }
      ]);
      const res = await request(app).get('/api/sensor-data/latest');
      expect(res.statusCode).toBe(404);
    });
  });

  // ── buildHeaderMap / initSheet / getVal ──────────────
  describe('Internal helpers', () => {
    beforeEach(() => {
      app.setTestMode();
    });

    test('buildHeaderMap loads header row and maps non-empty headers', async () => {
      const mockSheet = {
        loadHeaderRow: jest.fn().mockResolvedValue(true),
        headerValues: ['Node ID', '', 'Online', 'T680 (°C)']
      };
      await app.buildHeaderMapForTest(mockSheet);
      expect(mockSheet.loadHeaderRow).toHaveBeenCalledTimes(1);
    });

    test('initSheet connects to Google Sheets and sets ready', async () => {
      await app.initSheetForTest();
      const res = await request(app).get('/health');
      expect(res.body.sheets).toBe('connected');
    });

    test('initSheet catches errors without throwing', async () => {
      jest.spyOn(global, 'setTimeout').mockImplementation(() => {});
      const { GoogleSpreadsheet } = require('google-spreadsheet');
      GoogleSpreadsheet.mockImplementationOnce(() => ({
        loadInfo: jest.fn().mockRejectedValue(new Error('Auth failed')),
        sheetsByIndex: [],
        title: 'Test'
      }));
      await app.initSheetForTest();
    });

    test('getVal reads values from _rawData using header index', async () => {
      const mockSheet = {
        loadHeaderRow: jest.fn().mockResolvedValue(true),
        headerValues: ['Node ID', '', 'Online', 'T680 (°C)']
      };
      await app.buildHeaderMapForTest(mockSheet);
      app.getDoc().sheetsByIndex[1].getRows.mockResolvedValueOnce([
        { _rawData: ['1', '', 'Online', '31.2'] }
      ]);
      const res = await request(app).get('/api/sensor-data');
      expect(res.statusCode).toBe(200);
      expect(res.body[0].nodeId).toBe(1);
      expect(res.body[0].online).toBe(true);
      expect(res.body[0].temp680).toBe(31.2);
      expect(res.body[0].humidity680).toBe(0);
    });

    test('getVal returns empty string when header not in map', async () => {
      const mockSheet = {
        loadHeaderRow: jest.fn().mockResolvedValue(true),
        headerValues: ['Node ID']
      };
      await app.buildHeaderMapForTest(mockSheet);
      app.getDoc().sheetsByIndex[1].getRows.mockResolvedValueOnce([
        { _rawData: ['1'] }
      ]);
      const res = await request(app).get('/api/sensor-data');
      expect(res.statusCode).toBe(200);
      expect(res.body[0].nodeId).toBe(1);
      expect(res.body[0].temp680).toBe(0);
    });
  });
});