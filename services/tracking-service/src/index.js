const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { connectRedis, updateDriverLocation } = require('./redisClient');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io to allow live dual streams
const io = new Server(server);

app.use(express.json());
app.post('/api/v1/tracking/update', async (req, res) => {
    const { driverId, longitude, latitude } = req.body;
    if (!driverId || !longitude || !latitude) {
        return res.status(400).json({ error: "Missing tracking metrics." });
    }
    await updateDriverLocation(driverId, longitude, latitude);

    // Broadcast the movement live to any passenger listening via WebSockets
    io.emit(`location.${driverId}`, { driverId, longitude, latitude, updated: new Date() });

    res.status(200).json({ message: "Telemetry cached successfully." });
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