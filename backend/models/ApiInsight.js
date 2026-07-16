const mongoose = require('mongoose');

const ApiInsightSchema = new mongoose.Schema({
  Month: String,
  Date: String,
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
  Phone: String,
  status_type: String,
  Year: Number
}, { collection: 'manipalApiInsights' });

module.exports = mongoose.model('ApiInsight', ApiInsightSchema);
