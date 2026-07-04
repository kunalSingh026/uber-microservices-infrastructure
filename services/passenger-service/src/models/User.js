const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    picture: { type: String },
    role: { type: String, default: 'passenger' }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
