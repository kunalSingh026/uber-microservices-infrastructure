const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

require('dotenv').config();

// Load Docker secrets into process.env if available
const fs = require('fs');
const path = require('path');
const secretsDir = '/run/secrets';
if (fs.existsSync(secretsDir)) {
    try {
        fs.readdirSync(secretsDir).forEach(file => {
            const secretPath = path.join(secretsDir, file);
            if (fs.statSync(secretPath).isFile()) {
                const envVarName = file.toUpperCase();
                process.env[envVarName] = fs.readFileSync(secretPath, 'utf8').trim();
                console.log(`[Secrets] Loaded: ${envVarName}`);
            }
        });
    } catch (err) {
        console.warn(`[Secrets] Error loading secrets: ${err.message}`);
    }
} else {
    console.log('[Secrets] No secrets directory found. Using default process.env.');
}

console.log(`[Secrets Check] GOOGLE_CLIENT_SECRET loaded: ${process.env.GOOGLE_CLIENT_SECRET ? 'YES' : 'NO'}`);
console.log(`[Secrets Check] JWT_SECRET loaded: ${process.env.JWT_SECRET ? 'YES' : 'NO'}`);

const { connectRedis, updateDriverLocation } = require('./redisClient');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io to allow live dual streams
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.json());
app.post('/api/v1/tracking/update', async (req, res) => {
    const { driverId, longitude, latitude } = req.body;
    if (!driverId || !longitude || !latitude) {
        return res.status(400).json({ error: "Missing tracking metrics." });
    }
    console.log(`📥 [Telemetry Ingestion] Handling update request for driver: ${driverId} (Lon: ${longitude}, Lat: ${latitude})`);

    await updateDriverLocation(driverId, longitude, latitude);
    console.log(`💾 [Redis Cache] Saved tracking details for driver: ${driverId} down to mini_uber_redis`);

    // Broadcast the movement live to any passenger listening via WebSockets
    io.emit(`location.${driverId}`, { driverId, longitude, latitude, updated: new Date() });

    res.status(200).json({ status: "success", message: "Telemetry cached successfully." });
});

// 2. WebSocket Pipeline connection handler
io.on('connection', (socket) => {
    console.log(`[WebSocket Stream Open] Client connected to live feed: ${socket.id}`);

    socket.on('disconnect', () => {
        console.log(`[WebSocket Stream Closed] Client disconnected.`);
    });
});

// Health Probe
app.get('/health', (req, res) => {
    res.status(200).json({ service: 'Tracking Service', status: 'Healthy' });
});

const PORT = process.env.PORT || 3005;
server.listen(PORT, async () => {
    await connectRedis();
    console.log(`Tracking Service routing live on port ${PORT}`);
});