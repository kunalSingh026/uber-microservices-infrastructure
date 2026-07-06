const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
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

const app = express();

// Gateway Configuration Ports
const PORT = process.env.PORT || 3000;

// Service URL Mappings
const PASSENGER_SERVICE_URL = process.env.PASSENGER_SERVICE_URL;
const DRIVER_SERVICE_URL = process.env.DRIVER_SERVICE_URL;
const BILLING_SERVICE_URL = process.env.BILLING_SERVICE_URL;

// CORS and Logger Middleware
app.use((req, res, next) => {
    console.log(`[API Gateway] Intercepted: ${req.method} ${req.url}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// _____ ROUTING RULE 1: PASSENGER TRACK ______________
// Any request starting with /api/v1/passenger will be forwarded to port 3001
app.use('/api/v1/passenger', createProxyMiddleware({
    target: PASSENGER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
        '^/api/v1/passenger': '', // Strips '/api/v1/passenger' from the url before forwarding
    },
}));

//_______ROUTING RULE 2: Driver Track______________
//Any request starting with /api/v1/driver will be forwarded to port 3002
app.use('/api/v1/driver', createProxyMiddleware({
    target: DRIVER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
        '^/api/v1/driver': '', // Strips '/api/v1/driver' from the url before forwarding
    },
}));

//_______ROUTING RULE 3: Billing Track______________
//Any request starting with /api/v1/billing will be forwarded to port 3003
app.use('/api/v1/billing', createProxyMiddleware({
    target: BILLING_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
        '^/api/v1/billing': '', // Strips '/api/v1/billing' from the url before forwarding
    },
}));

app.get('/gateway-health', (req, res) => {
    res.status(200).json({ status: "API Gateway is operational." });
});

app.listen(PORT, () => {
    console.log(`🚀 API Gateway acts as single entry point on port ${PORT}`)
})