const express = require('express');
const { listenForCompletedRides } = require('./queue');
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

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
    console.log(`Billing Service running smoothly on port ${PORT}`);
});