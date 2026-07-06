const express = require('express');
const { listenForCompletedRides } = require('./queue');

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

app.use(express.json());

// In-memory invoice ledger
const invoices = [];

// Business logic to process payments
function processBilling(rideDetails) {
    const { requestId, passengerId, distanceInKm = 5 } = rideDetails; // defaulting to 5km for mock purposes
    
    console.log(`\n[Billing Service] Processing fare for finished trip: ${requestId}`);
    
    // Simple Pricing Algorithm: Base 50 + 12 per KM
    const baseFare = 50;
    const perKmRate = 12;
    const totalAmount = baseFare + (distanceInKm * perKmRate);

    const invoice = {
        invoiceId: `inv-${Date.now()}`,
        requestId,
        passengerId,
        amount: totalAmount,
        status: "PAID",
        processedAt: new Date()
    };

    invoices.push(invoice);
    console.log(`[Billing Service SUCCESS] Invoice generated: ${invoice.invoiceId} | Total Charged: ₹${totalAmount}`);
}

// Start listening to the event stream
listenForCompletedRides(processBilling);

app.get('/health', (req, res) => {
    res.status(200).json({ service: 'Billing Service', status: 'Healthy' });
});

// GET all invoices
app.get('/invoices', (req, res) => {
    // Sort or return list of invoices
    res.status(200).json(invoices);
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
    console.log(`Billing Service running smoothly on port ${PORT}`);
});