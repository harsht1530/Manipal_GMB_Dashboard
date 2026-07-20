const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        default: Date.now
    },
    user: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    action: {
        type: String,
        required: true
    },
    prevValue: String,
    newValue: String,
    remarks: String,
    isInternal: {
        type: Boolean,
        default: false
    },
    attachments: [{
        filename: String,
        path: String
    }]
});

const ManipalRequestSchema = new mongoose.Schema({
    requestId: {
        type: String,
        required: true,
        unique: true
    },
    ticketId: {
        type: String
    },
    category: {
        type: String,
        required: true
    },
    requestType: {
        type: String,
        required: true
    },
    ticketType: {
        type: String
    },
    raisedBy: {
        name: { type: String, required: true },
        email: { type: String, required: true },
        role: { type: String, required: false }
    },
    assignedTo: {
        name: { type: String, required: true },
        email: { type: String, required: true },
        role: { type: String, required: false }
    },
    cluster: {
        type: String,
        required: true
    },
    branch: {
        type: String,
        required: true
    },
    dueDate: {
        type: Date,
        required: true
    },
    priority: {
        type: String,
        default: 'P5'
    },
    status: {
        type: String,
        default: 'Open',
        enum: ['Open', 'In Progress', 'Waiting for Client', 'Waiting for Google', 'Completed', 'Closed', 'Escalated']
    },
    description: {
        type: String,
        required: true
    },
    excelTemplate: {
        filename: String,
        path: String
    },
    attachments: [{
        filename: String,
        path: String
    }],
    activityLogs: [ActivityLogSchema],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { collection: 'manipalrequests' });

ManipalRequestSchema.index({ "assignedTo.email": 1 });
ManipalRequestSchema.index({ "raisedBy.email": 1 });
ManipalRequestSchema.index({ cluster: 1 });
ManipalRequestSchema.index({ branch: 1 });
ManipalRequestSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ManipalRequest', ManipalRequestSchema);
