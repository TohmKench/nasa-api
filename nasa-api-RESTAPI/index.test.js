const request = require('supertest');
const app = require('./index'); // Make sure your index.js exports the app

describe('GET /api/apod/last7days', () => {
    it('should return an array of APOD items', async () => {
        const res = await request(app).get('/api/apod/last7days');
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        // Optionally check structure
        if (res.body.length > 0) {
            expect(res.body[0]).toHaveProperty('url');
            expect(res.body[0]).toHaveProperty('media_type');
        }
    });
});