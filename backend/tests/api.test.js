process.env.NODE_ENV = 'test';

const request = require('supertest');

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
});