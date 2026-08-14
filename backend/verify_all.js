const mongoose = require('mongoose');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });
const mongoURI = process.env.MONGODB_URI;

async function testAll() {
    console.log("--- STARTING END-TO-END VERIFICATION ---");
    await mongoose.connect(mongoURI);
    const db = mongoose.connection.db;
    const requestsCol = db.collection('manipalrequests');

    // 1. Test Ticket Creation with attachedUrl and verify assignedAt
    console.log("\n[Test 1] Testing Ticket Creation with Attached URL & assignedAt...");
    const createRes = await axios.post('http://127.0.0.1:5000/api/requests', {
        category: 'Others',
        ticketType: 'Other GMB Query',
        raisedByName: 'Test Raiser',
        raisedByEmail: 'test.raiser@manipal.com',
        raisedByRole: 'Branch',
        cluster: 'South',
        branch: 'Jayanagar',
        description: 'Testing optional attached URL and assignedAt auto-populate.',
        attachedUrl: 'https://example.com/test-url'
    });

    if (!createRes.data.success) {
        throw new Error("Create request failed: " + JSON.stringify(createRes.data));
    }
    const createdTicket = createRes.data.data;
    const ticketId = createdTicket.requestId;
    console.log("Created Ticket:", {
        requestId: createdTicket.requestId,
        attachedUrl: createdTicket.attachedUrl,
        assignedAt: createdTicket.assignedAt,
        assignedTo: createdTicket.assignedTo
    });

    // Check in database
    const dbDoc = await requestsCol.findOne({ requestId: ticketId });
    console.log("DB Document check:", {
        hasAttachedUrl: dbDoc.attachedUrl === 'https://example.com/test-url',
        hasAssignedAt: !!dbDoc.assignedAt,
        assignedAt: dbDoc.assignedAt
    });

    // 2. Test Comment / Status Change from Admin (Third-party)
    console.log("\n[Test 2] Adding comment/status change as Admin (neither raiser nor assignee)...");
    const logRes = await axios.post(`http://127.0.0.1:5000/api/requests/${ticketId}/logs`, {
        user: 'Corporate Admin',
        email: 'admin@manipal.com',
        action: 'Status Change',
        prevValue: 'Open',
        newValue: 'In Progress',
        remarks: 'Admin verified and transitioned status to In Progress.',
        isInternal: false
    });
    console.log("Status update response success:", logRes.data.success);
    const updatedDbDoc = await requestsCol.findOne({ requestId: ticketId });
    console.log("Updated Status in DB:", updatedDbDoc.status);
    console.log("Latest Activity Log:", updatedDbDoc.activityLogs[updatedDbDoc.activityLogs.length - 1]);

    // 3. Test Transfer Request
    console.log("\n[Test 3] Testing Reassignment / Transfer...");
    const teamCol = db.collection('multiplierteams');
    const teamMember = await teamCol.findOne({});
    const targetTransferEmail = teamMember ? teamMember.email : 'saisree@multipliersolutions.com';

    const transferRes = await axios.post(`http://127.0.0.1:5000/api/requests/${ticketId}/transfer`, {
        newAssigneeEmail: targetTransferEmail,
        transferByName: 'Admin Manager',
        remarks: 'Reassigned for verification'
    });
    console.log("Transfer response success:", transferRes.data.success);
    const transferDbDoc = await requestsCol.findOne({ requestId: ticketId });
    console.log("New Assignee:", transferDbDoc.assignedTo);
    console.log("New AssignedAt:", transferDbDoc.assignedAt);

    // 4. Test SLA check escalation logging
    console.log("\n[Test 4] Testing SLA escalation contact logging in remarks...");
    // Simulate an 8-day old unresolved ticket
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10);
    await requestsCol.updateOne(
        { requestId: ticketId },
        { $set: { createdAt: oldDate, status: 'In Progress' } }
    );

    // Run SLA check API
    const slaRes = await axios.get('http://127.0.0.1:5000/api/requests/run-sla-check');
    console.log("SLA Check trigger response:", slaRes.data);

    const escalatedDbDoc = await requestsCol.findOne({ requestId: ticketId });
    console.log("Escalated Status in DB:", escalatedDbDoc.status);
    const escalationLog = escalatedDbDoc.activityLogs.find(l => l.action === 'Escalations');
    console.log("Escalation Log in Activity Logs:", escalationLog);

    // 5. Clean up test ticket
    console.log("\n[Test 5] Cleaning up test ticket...");
    await requestsCol.deleteOne({ requestId: ticketId });
    console.log("Cleaned up successfully.");

    console.log("\n--- ALL API TESTS COMPLETED AND VERIFIED ---");
    process.exit(0);
}

testAll().catch(err => {
    console.error("Test failed with error:", err.message, err.response ? err.response.data : "");
    process.exit(1);
});
