const mongoose = require('mongoose');

const ReportingDataSchema = new mongoose.Schema({
    Cluster: String,
    Unit: String,
    "Business Profile Name": String,
    "GMB Status": String,
    "Profile Type": String,
    Date: String,
    "Longitude/Latitude": String,
    "Google Search Link": String,
    "GMB Short URL": String,
    "Creation Month": String,
    "Mail Id": String
}, { collection: 'manipalreportingdata' });

module.exports = mongoose.model('ReportingData', ReportingDataSchema);
