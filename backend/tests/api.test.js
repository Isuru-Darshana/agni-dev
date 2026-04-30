process.env.NODE_ENV = 'test';

const request = require('supertest');

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
            'Temp Rate (°C/min)':     '0.0',
            'Humidity Rate (%/min)':  '0.0',
            'Gas Rate (Ω/min)':       '0.0',
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
            'Total Nodes':      '1',
            'Online':           '1',
            'Offline':          '0',
            'Temp Avg':         '30.3',
            'Humidity Avg':     '56.4',
            'PM2.5 Avg':        '20.0',
            'Gas Ratio Avg':    '0.39',
            'Risk Avg':         '22.5',
            'Risk Max':         '22.5',
            'Fire Stage':       '0',
            'Stage Name':       'NORMAL',
            'Normal Count':     '1',
            'Alert Count':      '0',
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

beforeAll(() => {
  app.setTestMode();
});

// ── Set sheetsReady to true for tests ────────────────
beforeAll(() => {
  app.set('sheetsReady', true);
});

describe('AGNI GUARD Backend API', () => {

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
  });

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
  });

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
  });

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
  });

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
  });

  describe('Error Handling', () => {
    test('unknown route returns 404', async () => {
      const res = await request(app).get('/api/unknown');
      expect(res.statusCode).toBe(404);
    });
  });
});