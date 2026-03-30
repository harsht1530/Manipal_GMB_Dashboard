const mongoose = require('mongoose');

const optimizationSchema = new mongoose.Schema({
    "Location": String,
    "Business Name": String,
    "Profile Url": String,
    "Website": String,
    "Website Link": String,
    "Timings": String,
    "Phone number": String,
    "Phone Number ": String,
    "Address": String,
    "Address Detail": String,
    "Keywords": String,
    "Description": String,
    "Cover Photo": String,
    "Logo": String
}, { collection: 'manipaloptimizationdata' });

module.exports = mongoose.model('Optimization', optimizationSchema);
