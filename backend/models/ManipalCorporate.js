const mongoose = require('mongoose');

const ManipalCorporateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    role: {
        type: String,
        default: "Admin"
    },
    accessScope: {
        type: String,
        default: "Global"
    },
    cluster: {
        type: String,
        default: "All"
    },
    branch: {
        type: String,
        default: "All"
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { collection: 'manipalcorporate' });

module.exports = mongoose.model('ManipalCorporate', ManipalCorporateSchema);
