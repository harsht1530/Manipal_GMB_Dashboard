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
    orgEmail: String,
    Cluster: String,
    Branch: String,
    Name: String,
    notifyPhoneChange: { type: Boolean, default: true },
    notifyNameChange: { type: Boolean, default: true },
    notifyMonthlyReport: { type: Boolean, default: true },
    otp: String,
    otpExpires: Date,
    resetToken: String,
    resetTokenExpires: Date
}, { collection: 'users' });

module.exports = mongoose.model('User', UserSchema);
