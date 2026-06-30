const mongoose = require('mongoose');

const RideRequestSchema = new mongoose.Schema({
    requestId: { type: String, required: true, unique: true },
    passengerId: { type: String, required: true },
    pickup: { type: String, required: true },
    dropoff: { type: String, required: true },
    status: { type: String, default: 'PENDING' },
    driverId: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('RideRequest', RideRequestSchema);