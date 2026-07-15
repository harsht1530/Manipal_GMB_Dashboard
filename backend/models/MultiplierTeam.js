const mongoose = require('mongoose');

const MultiplierTeamSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    cluster: {
        type: String,
        required: true
    }
}, { collection: 'multiplierteam' });

module.exports = mongoose.model('MultiplierTeam', MultiplierTeamSchema);
