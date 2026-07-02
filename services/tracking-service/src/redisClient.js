const { createClient } = require('redis');

const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

client.on('error', (err) => console.error('[Redis Tracking Error]', err));

async function connectRedis() {
    await client.connect();
    console.log('└─🔋 [Redis Store] Connected to in-memory geospatial cache.');
}

async function updateDriverLocation(driverId, longitude, latitude) {
    await client.geoAdd('drivers_loc', {
        longitude: parseFloat(longitude),
        latitude: parseFloat(latitude),
        member: driverId
    });
}

async function getDriverLocation(driverId) {
    const pos = await client.geoPos('drivers_loc', driverId);
    if (!pos || !pos[0]) return null;
    return { longitude: pos[0].longitude, latitude: pos[0].latitude };
}

module.exports = { connectRedis, updateDriverLocation, getDriverLocation };