const { io } = require('socket.io-client');

const socket = io('http://localhost:3005');

const DRIVER_IDS = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9', 'd10'];

// Simulated route coordinates in Mumbai for all 10 drivers
const driverRoutes = {
    d1: [
        { longitude: 72.8777, latitude: 19.0760 },
        { longitude: 72.8785, latitude: 19.0768 },
        { longitude: 72.8792, latitude: 19.0775 },
        { longitude: 72.8801, latitude: 19.0783 },
        { longitude: 72.8810, latitude: 19.0791 },
        { longitude: 72.8822, latitude: 19.0800 }
    ],
    d2: [
        { longitude: 72.8900, latitude: 19.0800 },
        { longitude: 72.8912, latitude: 19.0815 },
        { longitude: 72.8925, latitude: 19.0830 },
        { longitude: 72.8938, latitude: 19.0845 },
        { longitude: 72.8950, latitude: 19.0860 }
    ],
    d3: [
        { longitude: 72.8600, latitude: 19.0600 },
        { longitude: 72.8615, latitude: 19.0618 },
        { longitude: 72.8630, latitude: 19.0635 },
        { longitude: 72.8645, latitude: 19.0652 },
        { longitude: 72.8660, latitude: 19.0670 }
    ],
    d4: [
        { longitude: 72.8700, latitude: 19.0500 },
        { longitude: 72.8715, latitude: 19.0515 },
        { longitude: 72.8730, latitude: 19.0530 },
        { longitude: 72.8745, latitude: 19.0545 },
        { longitude: 72.8760, latitude: 19.0560 }
    ],
    d5: [
        { longitude: 72.8800, latitude: 19.0900 },
        { longitude: 72.8812, latitude: 19.0912 },
        { longitude: 72.8825, latitude: 19.0925 },
        { longitude: 72.8838, latitude: 19.0938 },
        { longitude: 72.8850, latitude: 19.0950 }
    ],
    d6: [
        { longitude: 72.8500, latitude: 19.0700 },
        { longitude: 72.8515, latitude: 19.0715 },
        { longitude: 72.8530, latitude: 19.0730 },
        { longitude: 72.8545, latitude: 19.0745 },
        { longitude: 72.8560, latitude: 19.0760 }
    ],
    d7: [
        { longitude: 72.8400, latitude: 19.0800 },
        { longitude: 72.8415, latitude: 19.0815 },
        { longitude: 72.8430, latitude: 19.0830 },
        { longitude: 72.8445, latitude: 19.0845 },
        { longitude: 72.8460, latitude: 19.0860 }
    ],
    d8: [
        { longitude: 72.8300, latitude: 19.0900 },
        { longitude: 72.8315, latitude: 19.0915 },
        { longitude: 72.8330, latitude: 19.0930 },
        { longitude: 72.8345, latitude: 19.0945 },
        { longitude: 72.8360, latitude: 19.0960 }
    ],
    d9: [
        { longitude: 72.8200, latitude: 19.0800 },
        { longitude: 72.8215, latitude: 19.0815 },
        { longitude: 72.8230, latitude: 19.0830 },
        { longitude: 72.8245, latitude: 19.0845 },
        { longitude: 72.8260, latitude: 19.0860 }
    ],
    d10: [
        { longitude: 72.8100, latitude: 19.0700 },
        { longitude: 72.8115, latitude: 19.0715 },
        { longitude: 72.8130, latitude: 19.0730 },
        { longitude: 72.8145, latitude: 19.0745 },
        { longitude: 72.8160, latitude: 19.0760 }
    ]
};

socket.on('connect', () => {
    console.log(`Connected to Microservice WebSocket Gateway (ID: ${socket.id})`);
    console.log(`Starting live telemetry transmission for 10 drivers...\n`);

    const indices = {};
    DRIVER_IDS.forEach(id => { indices[id] = 0; });

    // Simulate high-frequency ingestion pinging every 2.5 seconds
    setInterval(async () => {
        for (const driverId of DRIVER_IDS) {
            const route = driverRoutes[driverId];
            let index = indices[driverId];
            if (index >= route.length) {
                index = 0;
            }
            const currentLoc = route[index];
            indices[driverId] = index + 1;

            const payload = {
                driverId,
                ...currentLoc
            };

            try {
                await fetch('http://localhost:3005/api/v1/tracking/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } catch (err) {
                // Squelch connection failures to keep terminal clean
            }
        }
        console.log(`📡 [Ingestion Ping] Dispatched coordinates batch for 10 drivers.`);
    }, 2500);
});

socket.on('disconnect', () => {
    console.log('🔌 Disconnected from the real-time stream server.');
});