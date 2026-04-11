// ================================================
// MediDeliver - Weather/Location External API Route
// GET /api/weather/:city
// ================================================
const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

const WEATHER_API_KEY = process.env.WEATHER_API_KEY || '';
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

router.get('/:city', async (req, res) => {
    const city = req.params.city;
    const cached = cache.get(city.toLowerCase());
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
        return res.json({ data: cached.data, source: 'cache' });
    }

    if (!WEATHER_API_KEY || WEATHER_API_KEY === 'your_openweathermap_api_key_here') {
        const mock = {
            city, temperature: 28 + Math.round(Math.random() * 5),
            feels_like: 31, humidity: 72, description: 'Partly cloudy',
            icon: '02d', wind_speed: 12, note: 'Mock data — set WEATHER_API_KEY in .env'
        };
        cache.set(city.toLowerCase(), { data: mock, ts: Date.now() });
        return res.json({ data: mock, source: 'mock' });
    }

    try {
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)},MY&appid=${WEATHER_API_KEY}&units=metric`;
        const r = await fetch(url);
        const w = await r.json();
        if (!r.ok) return res.status(r.status).json({ error: w.message });

        const data = {
            city: w.name, temperature: Math.round(w.main.temp),
            feels_like: Math.round(w.main.feels_like), humidity: w.main.humidity,
            description: w.weather[0].description, icon: w.weather[0].icon,
            wind_speed: Math.round(w.wind.speed * 3.6)
        };
        cache.set(city.toLowerCase(), { data, ts: Date.now() });
        res.json({ data, source: 'api' });
    } catch (err) {
        res.status(500).json({ error: 'Weather API error', message: err.message });
    }
});

module.exports = router;
