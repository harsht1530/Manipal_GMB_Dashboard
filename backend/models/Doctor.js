const mongoose = require('mongoose');

const LabelSchema = new mongoose.Schema({
    rank: Number,
    label: String,
    competitors: [String],
    screen_shot: String,
    business_name: String,
    link: String
});

const DoctorSchema = new mongoose.Schema({
    business_name: String,
    name: String,
    phone: String,
    placeId: String,
    newReviewUri: String,
    mapsUri: String,
    websiteUrl: String,
    labels: [LabelSchema],
    account: String,
    primaryCategory: String,
    address: String,
    averageRating: Number,
    totalReviewCount: Number,
    profile_photo: String,
    profile_screenshot: String,
    mail_id: String,
    Cluster: String,
    Branch: String
}, { collection: 'manipalfinaldatas' });

module.exports = mongoose.model('Doctor', DoctorSchema);
