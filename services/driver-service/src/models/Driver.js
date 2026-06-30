const mongoose = require('mongoose');

const DriverSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, require: true },
    status: { type: String, default: 'AVAILABLE' },
    location: { type: String, require: true }
});

module.exports = mongoose.model('Driver', DriverSchema);