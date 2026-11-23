const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
    platformFeePercent: { type: Number, default: 5 }, // Platform default fee
    hostFeePercent: { type: Number, default: 3 }, // Host default fee
    guestFeePercent: { type: Number, default: 0 }, // Guest default fee
}, { timestamps: true });

module.exports = mongoose.model('Settings', SettingsSchema);
