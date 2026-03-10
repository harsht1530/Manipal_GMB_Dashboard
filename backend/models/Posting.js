const mongoose = require('mongoose');

const postingSchema = new mongoose.Schema({
    Cluster: String,
    Branch: String,
    "Business name": String,
    "Source URL": String,
    Department: String,
    "Type of post": String,
    "GMB Post Link": String,
    Date: String,
    Month: String
}, { collection: 'manipalpostingdata' });

// Add index for common queries if data gets large
postingSchema.index({ Cluster: 1, Branch: 1, Month: 1 });

module.exports = mongoose.model('Posting', postingSchema);
