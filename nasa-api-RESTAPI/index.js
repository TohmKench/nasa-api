require('dotenv').config();
var express = require('express');
var bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');

var app = express();

app.use(express.static('public'));

// Middleware to parse JSON bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());

// In-memory cache for APOD data
let apodCache = {
    data: null,
    timestamp: 0
};
const CACHE_DURATION = 1000 * 60 * 60 * 6; // 6 hours in milliseconds

// API route to proxy APOD images for the last ~month
app.get('/api/apod/last7days', async (req, res) => {
    const apiKey = process.env.NASA_API_KEY || 'DEMO_KEY';
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30); // 6 days ago + today ~month

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    // Serve from cache if not expired
    if (
        apodCache.data &&
        Date.now() - apodCache.timestamp < CACHE_DURATION
    ) {
        return res.json(apodCache.data);
    }

    try {
        const response = await axios.get(
            `https://api.nasa.gov/planetary/apod`,
            {
                params: {
                    api_key: apiKey,
                    start_date: startStr,
                    end_date: endStr
                }
            }
        );

        const rawData = response.data;
        // Only images with hdurl
        const imagesOnly = rawData.filter(item => item.media_type === 'image' && item.hdurl);

        // Filter for space-related keywords in title or explanation
        const spaceImageKeywords = ['nebula', 'galaxy', 'cluster', 'moon', 'sun', 'planet', 'star', 'comet', 'asteroid', 'aurora'];
        const spacePhotos = imagesOnly.filter(item =>
            spaceImageKeywords.some(keyword =>
                item.title?.toLowerCase().includes(keyword) ||
                item.explanation?.toLowerCase().includes(keyword)
            )
        );

        apodCache = {
            data: spacePhotos,
            timestamp: Date.now()
        };

        res.json(spacePhotos);
    } catch (error) {
        console.error('NASA API fetch error:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch data from NASA API' });
    }
});

const PORT = process.env.PORT || 3000;

// Only start the server if this file is run directly, not when imported for tests
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;

