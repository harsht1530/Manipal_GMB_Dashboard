const mongoose = require('mongoose');

const gmbPostSchema = new mongoose.Schema({
    cluster: String,
    location: String,
    doctorName: String,
    account: String,
    email: String,
    sourceLink: String,
    imageUrl: String,
    postsText: String,
    newReviewUri: String,
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Posted', 'Failed'],
        default: 'Pending'
    },
    scheduledTime: Date,
    aiResponse: mongoose.Schema.Types.Mixed,
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { collection: 'manipalgmbpostings' });

module.exports = mongoose.model('GMBPost', gmbPostSchema);
