const request = require('supertest');

jest.mock('google-spreadsheet', () => ({
  GoogleSpreadsheet: jest.fn().mockImplementation(() => ({
    useServiceAccountAuth: jest.fn().mockResolvedValue(true),
    loadInfo: jest.fn().mockResolvedValue(true),
    sheetsByIndex: [{
      getRows: jest.fn().mockResolvedValue([
        {
          Timestamp: '2024-01-01 10:00:00',
          'Temperature (°C)': '32.5',
          'Humidity (%)': '65.0',
          'Gas Level': '450'
        }
      ])
    }]
  }))
}));

const app = require('../server');

describe('AGNI GUARD Backend API', () => {

  describe('Health Check', () => {
    test('GET /health returns 200', async () => {
      const res = await request(app).get('/health');
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('Sensor Data Endpoints', () => {
    test('GET /api/sensor-data returns array', async () => {
      const res = await request(app).get('/api/sensor-data');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /api/sensor-data/latest returns object', async () => {
      const res = await request(app)
        .get('/api/sensor-data/latest');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('temperature');
      expect(res.body).toHaveProperty('humidity');
      expect(res.body).toHaveProperty('timestamp');
    });
  });
});