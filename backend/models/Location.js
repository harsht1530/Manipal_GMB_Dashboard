const mongoose = require('mongoose');

const LocationSchema = new mongoose.Schema({
    Month: String,
    Cluster: String,
    "Unit Name": String,
    Department: String,
    "Total Profiles": Number,
    "Verified Profiles": Number,
    "Unverfied Profiles": Number,
    "Need Access": Number,
    "Not Intrested": Number,
    "Out Of Organization": Number
}, { collection: 'manipalLocations' });

module.exports = mongoose.model('Location', LocationSchema);
