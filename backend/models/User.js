const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    user: String,
    psw: String,
    mail: String,
    "Total Profiles": Number,
    "Total Verified": Number,
    Unverified: Number,
    "Not Intrested": Number,
    Logo: String,
    API: String,
    Repeated: Number,
    "Need Access": Number,
    Hospitals: Number,
    Department: Number,
    Clinic: Number,
    Doctor: Number,
    MARS: Number,
    Organization: Number,
    orgEmail: String
}, { collection: 'users' });

module.exports = mongoose.model('User', UserSchema);
