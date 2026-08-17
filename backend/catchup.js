const mongoose = require('mongoose');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');

dotenv.config();

const ManipalRequest = require('./models/ManipalRequest');
const ManipalCorporate = require('./models/ManipalCorporate');
const Alert = require('./models/Alert');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://gmbaccess11_db_user:uxxtaFMTwNLS2OHh@cluster0.u2mdg45.mongodb.net/HarshDB';

// Mail Transporter (matching backend config)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const sendEmail = async (to, subject, html) => {
    try {
        await transporter.sendMail({
            from: `"GMB Operations Support" <${process.env.SMTP_USER}>`,
            to,
            subject,
            html
        });
        console.log(`Email sent successfully to ${to}`);
    } catch (err) {
        console.error(`Failed to send email to ${to}:`, err);
    }
};

const getRequestEmailTemplate = (bodyContent) => {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        ${bodyContent}
    </div>
    `;
};

const getRequestDetailsUrl = (req, reqIdStr) => {
    return `https://multiplierai.co/GMB/#/requests/details/${reqIdStr}`;
};

const runCatchup = async () => {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB successfully.");

    const now = new Date();
    const unresolvedRequests = await ManipalRequest.find({
        status: { $nin: ['Completed', 'Closed'] }
    });

    console.log(`Found ${unresolvedRequests.length} unresolved requests. Processing SLA check...`);
    
    let updatedCount = 0;
    for (const requestDoc of unresolvedRequests) {
        if (requestDoc.status === 'Waiting for Google') {
            console.log(`Skipping Request ${requestDoc.requestId || requestDoc.ticketId} (Waiting for Google)`);
            continue;
        }

        const reqIdStr = requestDoc.requestId || requestDoc.ticketId;
        const diffTime = Math.abs(now - requestDoc.createdAt);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let priorityChanged = false;
        let escalationLogged = false;
        let oldPriority = requestDoc.priority;
        let newPriority = oldPriority;
        let remarks = "";
        let action = "";
        
        if (diffDays >= 8 && requestDoc.status !== 'Escalated') {
            requestDoc.status = 'Escalated';
            requestDoc.priority = 'P1';
            newPriority = 'P1';
            action = "Escalations";
            
            // Fetch active corporate escalation contacts
            const corporateContacts = await ManipalCorporate.find({ isActive: true });
            const ticketCluster = (requestDoc.cluster || "").trim().toLowerCase();
            const escalatedContacts = corporateContacts.filter(c => {
                const contactCluster = (c.cluster || "").trim().toLowerCase();
                if (contactCluster === "all") return true;
                if (ticketCluster && contactCluster === ticketCluster) return true;
                return false;
            });

            let recipientEmails = escalatedContacts.map(c => c.email).filter(Boolean);
            let escalationDetails = "";

            if (escalatedContacts.length > 0) {
                escalationDetails = escalatedContacts.map(c => `${c.name || 'Unknown'} (${c.email})`).join(", ");
            }

            if (recipientEmails.length === 0) {
                recipientEmails = [
                    'mohd.aman@manipalhospitals.com',
                    'harsh@multipliersolutions.com',
                    'rupesh.mishra@manipalhospitals.com',
                    'rumela.bhattacharya@manipalhospitals.com',
                    'mayank.agarwal@multipliersolutions.com'
                ];
                escalationDetails = recipientEmails.join(", ");
            }

            remarks = `Auto-escalated to Manipal Corporate Team & Regional Marketing Head after 8 days of SLA breach. Escalated to: ${escalationDetails}.`;

            const escalActionUrl = getRequestDetailsUrl(null, reqIdStr);
            const escalHtml = getRequestEmailTemplate(`
                <h2 style="color: #dc2626; margin-top: 0; font-size: 20px; font-weight: 700;">SLA Breach Escalation Notice</h2>
                <p style="font-size: 15px; color: #4b5563;">
                    The GMB operations request <strong style="color: #dc2626;">${reqIdStr}</strong> has been unresolved for 8+ days and is escalated to the Manipal Corporate Team and Regional Marketing Head.
                </p>
                <table class="data-table">
                    <tr><th>Request ID:</th><td><strong style="color: #dc2626;">${reqIdStr}</strong></td></tr>
                    <tr><th>Assignee:</th><td>${requestDoc.assignedTo.name} (${requestDoc.assignedTo.email})</td></tr>
                    <tr><th>Branch:</th><td>${requestDoc.branch} (${requestDoc.cluster})</td></tr>
                    <tr><th>Status:</th><td><span style="background-color: #fef2f2; color: #991b1b; padding: 3px 10px; border-radius: 6px; font-weight: bold; font-size: 12px; border: 1px solid #fecaca;">Escalated (Day 8+)</span></td></tr>
                </table>
                <div style="text-align: center; margin: 30px 0 10px;">
                    <a href="${escalActionUrl}" class="btn-primary">Inspect Escalated Request</a>
                </div>
            `);

            for (const mailTo of recipientEmails) {
                await sendEmail(mailTo, `SLA BREACH ESCALATION: ${reqIdStr}`, escalHtml);
            }
            
            escalationLogged = true;
        } else if (diffDays === 7 && requestDoc.priority !== 'P1') {
            requestDoc.priority = 'P1';
            newPriority = 'P1';
            action = "Priority Changes";
            remarks = `Auto-increased priority to P1 (Day 7). Final SLA reminder logged.`;
            priorityChanged = true;
        } else if (diffDays === 6 && requestDoc.priority !== 'P2') {
            requestDoc.priority = 'P2';
            newPriority = 'P2';
            action = "Priority Changes";
            remarks = `Auto-increased priority to P2 (Day 6). SLA reminder logged.`;
            priorityChanged = true;
        } else if (diffDays === 5 && requestDoc.priority !== 'P2') {
            requestDoc.priority = 'P2';
            newPriority = 'P2';
            action = "Priority Changes";
            remarks = `Auto-increased priority to P2 (Day 5). SLA reminder logged.`;
            priorityChanged = true;
        } else if (diffDays === 4 && requestDoc.priority !== 'P3') {
            requestDoc.priority = 'P3';
            newPriority = 'P3';
            action = "Priority Changes";
            remarks = `Auto-increased priority to P3 (Day 4).`;
            priorityChanged = true;
        } else if (diffDays === 3 && requestDoc.priority !== 'P4') {
            requestDoc.priority = 'P4';
            newPriority = 'P4';
            action = "Priority Changes";
            remarks = `Auto-increased priority to P4 (Day 3).`;
            priorityChanged = true;
        }
        
        if (priorityChanged || escalationLogged) {
            console.log(`Updating Request ${reqIdStr}: ${oldPriority} -> ${newPriority} | Status: ${requestDoc.status} | DiffDays: ${diffDays}`);
            console.log(`Remarks: ${remarks}`);
            
            requestDoc.activityLogs.push({
                user: "System",
                email: "system@manipal.com",
                action: action,
                prevValue: oldPriority,
                newValue: newPriority,
                remarks: remarks,
                timestamp: new Date()
            });
            requestDoc.updatedAt = new Date();
            await requestDoc.save();

            try {
                const slaAlert = new Alert({
                    user: 'System',
                    role: 'System',
                    location: requestDoc.branch,
                    cluster: requestDoc.cluster,
                    type: 'TICKET_SLA',
                    targetEmail: requestDoc.assignedTo.email,
                    message: `Request ${reqIdStr} SLA Update: ${remarks}`
                });
                await slaAlert.save();
            } catch (alertErr) {
                console.error("Failed to create SLA check alert:", alertErr);
            }

            updatedCount++;
        }
    }

    console.log(`SLA catch-up complete. Updated ${updatedCount} requests.`);
    await mongoose.connection.close();
};

runCatchup().catch(err => {
    console.error("Error running SLA catchup:", err);
    process.exit(1);
});
