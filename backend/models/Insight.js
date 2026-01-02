const mongoose = require('mongoose');

const InsightSchema = new mongoose.Schema({
  Month: String,
  Date: Date,
  Cluster: String,
  Branch: String,
  Department: String,
  Speciality: String,
  "Business name": String,
  "Google Search - Mobile": Number,
  "Google Search - Desktop": Number,
  "Google Maps - Mobile": Number,
  "Google Maps - Desktop": Number,
  Directions: Number,
  "Website clicks": Number,
  Calls: Number,
  Review: Number,
  Rating: Number,
  Phone: String
}, { collection: 'manipalinsightsdatas' });

module.exports = mongoose.model('Insight', InsightSchema);
