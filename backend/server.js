const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Models
const Insight = require('./models/Insight');
const Doctor = require('./models/Doctor');
const Location = require('./models/Location');
const User = require('./models/User');
const Alert = require('./models/Alert');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://vasudeva:ommN1EMg2KsURyPQ@cluster0.n3ejr.mongodb.net/HarshDB';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Mail Transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER || 'gmb-dashboard-support@multipliersolutions.com',
        pass: process.env.SMTP_PASS || 'oggw dehy frzc fvub',
    },
});

const MANIPAL_LOGO = "https://multipliersolutions.in/manipalhospitals/manipallogo2.png";

const sendEmail = async (to, subject, html) => {
    try {
        await transporter.sendMail({
            from: `"GMB Analytics Dashboard" <${process.env.SMTP_USER || 'gmb-dashboard-support@multipliersolutions.com'}>`,
            to,
            subject,
            html
        });
        return true;
    } catch (error) {
        console.error("Email sending failed:", error);
        return false;
    }
};

const getEmailTemplate = (content) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; text-align: center; border: 1px solid #ddd; border-radius: 10px;">
        <div style="margin-bottom: 20px;">
            <img src="${MANIPAL_LOGO}" alt="Manipal Hospitals" style="max-width: 150px; margin-bottom: 10px;">
        </div>
        <div style="color: #333; line-height: 1.6;">
            ${content}
        </div>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #888; text-align: center;">
            <p>&copy; ${new Date().getFullYear()} Multiplier AI. All rights reserved.</p>
        </div>
    </div>
`;

// Routes

// 1. Diagnostic / Default
app.get('/api', (req, res) => {
    res.json({ success: true, message: "Backend API is running", version: "1.2.0" });
});

// 2. Auth Route - Step 1: Verify Credentials and Send OTP
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({
            $or: [{ orgEmail: email }, { mail: email }],
            psw: password
        });

        if (user) {
            // Generate 6-digit OTP
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            user.otp = otp;
            user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
            await user.save();

            const emailHtml = getEmailTemplate(`
                <h2 style="color: #333;">Almost there</h2>
                <p style="font-size: 16px; color: #555;">Here is your code:</p>
                <h1 style="font-size: 32px; letter-spacing: 4px; color: #000; margin: 20px 0;"><strong>${otp}</strong></h1>
                <p style="font-size: 14px; color: #777;">
                    This code will be active for ten minutes. If you don’t make it in time, you can always request a new one.
                </p>
                <p style="font-size: 14px; color: #777; margin-top: 20px;">
                    If you weren’t expecting this email, someone else may have accidentally entered your email address. 
                    If you need help, contact our <a href="mailto:gmb-dashboard-support@multipliersolutions.com" style="color: #007bff; text-decoration: none;">support team</a>.
                </p>
            `);

            const sent = await sendEmail(user.orgEmail || user.mail, "Login OTP - GMB Analytics Dashboard", emailHtml);

            if (sent) {
                res.json({ success: true, message: "OTP sent to your email", email: user.orgEmail || user.mail });
            } else {
                res.status(500).json({ success: false, error: "Failed to send OTP email" });
            }
        } else {
            // Handle special Admin case for convenience
            if (email === "admin@manipal.com" && password === "admin123") {
                res.json({
                    success: true,
                    message: "Admin bypass for development",
                    user: { name: "Admin", email: "admin@manipal.com", role: "Admin" }
                });
            } else {
                res.status(401).json({ success: false, error: 'Invalid credentials' });
            }
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2.1 Verify OTP Route
app.post('/api/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    try {
        const user = await User.findOne({
            $or: [{ orgEmail: email }, { mail: email }],
            otp,
            otpExpires: { $gt: Date.now() }
        });

        if (user) {
            // Clear OTP after successful verification
            user.otp = undefined;
            user.otpExpires = undefined;
            await user.save();

            res.json({
                success: true,
                user: {
                    name: user.Name || user.user,
                    email: user.orgEmail || user.mail,
                    logo: user.Logo,
                    role: user.user,
                    cluster: user.Cluster,
                    branch: user.Branch,
                    notifications: {
                        phoneChange: user.notifyPhoneChange ?? true,
                        nameChange: user.notifyNameChange ?? true,
                        monthlyReport: user.notifyMonthlyReport ?? true
                    }
                }
            });
        } else {
            res.status(401).json({ success: false, error: "Invalid or expired OTP" });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2.2 Forgot Password Route
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ $or: [{ orgEmail: email }, { mail: email }] });
        if (!user) {
            return res.json({ success: true, message: "If that email exists, a reset link has been sent." });
        }

        const token = crypto.randomBytes(32).toString('hex');
        user.resetToken = token;
        user.resetTokenExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        const resetUrl = `${req.headers.origin}/reset-password?token=${token}&email=${email}`;

        const emailHtml = getEmailTemplate(`
            <h2 style="color: #333;">Password Reset Request</h2>
            <p style="font-size: 16px; color: #555;">We received a request to reset your password.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background-color: #7C3A84; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
            </div>
            <p style="font-size: 14px; color: #777;">
                This link will be active for one hour. If you didn't request this, you can safely ignore this email.
            </p>
            <p style="font-size: 14px; color: #777; margin-top: 20px;">
                If you need help, contact our <a href="mailto:gmb-dashboard-support@multipliersolutions.com" style="color: #007bff; text-decoration: none;">support team</a>.
            </p>
            <p style="word-break: break-all; font-size: 11px; color: #888; margin-top: 20px;">Alternatively, copy and paste this link: ${resetUrl}</p>
        `);

        await sendEmail(email, "Password Reset - GMB Analytics Dashboard", emailHtml);
        res.json({ success: true, message: "Reset link sent to your email" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2.3 Reset Password Route
app.post('/api/reset-password', async (req, res) => {
    const { email, token, newPassword } = req.body;
    try {
        const user = await User.findOneAndUpdate(
            {
                $or: [{ orgEmail: email }, { mail: email }],
                resetToken: token,
                resetTokenExpires: { $gt: Date.now() }
            },
            {
                $set: { psw: newPassword },
                $unset: { resetToken: 1, resetTokenExpires: 1 }
            },
            { new: true }
        );

        if (!user) {
            return res.status(400).json({ success: false, error: "Invalid or expired reset token" });
        }

        res.json({ success: true, message: "Password updated successfully" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. Search Keywords Impressions (Diagnostic GET)
app.get('/api/search-keywords-impressions', (req, res) => {
    res.json({ success: true, message: "Search Keywords API is live (GET works). Use POST for data." });
});

// 4. Search Keywords Impressions (POST)
app.post('/api/search-keywords-impressions', async (req, res) => {
    const { email, locationId, startYear, startMonth, endYear, endMonth } = req.body;

    if (!email || !locationId || !startYear || !startMonth || !endYear || !endMonth) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const http = require('http');
    const postData = JSON.stringify({
        action: "search_keywords_impressions",
        email: email,
        locationId: locationId,
        startYear: startYear,
        startMonth: startMonth,
        endYear: endYear,
        endMonth: endMonth
    });

    const options = {
        hostname: 'multipliersolutions.in',
        port: 80,
        path: '/gmbhospitals/gmb_api/api.php',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const externalReq = http.request(options, (externalRes) => {
        let body = '';
        externalRes.setEncoding('utf8');
        externalRes.on('data', (chunk) => body += chunk);
        externalRes.on('end', () => {
            if (externalRes.statusCode !== 200) {
                console.warn(`External API returned status ${externalRes.statusCode}: ${body}`);
            }
            try {
                const data = JSON.parse(body);
                res.json(data);
            } catch (e) {
                console.error("Error parsing external API response:", e);
                res.status(500).json({ success: false, error: "Failed to parse external API response" });
            }
        });
    });

    externalReq.on('error', (e) => {
        console.error(`Problem with request: ${e.message}`);
        res.status(500).json({ success: false, error: e.message });
    });

    externalReq.write(postData);
    externalReq.end();
});

// 5. Insights Route
app.get('/api/insights', async (req, res) => {
    try {
        const insights = await Insight.find({});
        res.json({ success: true, data: insights });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 6. Doctors Route
app.get('/api/doctors', async (req, res) => {
    try {
        const doctors = await Doctor.find({});
        res.json({ success: true, data: doctors });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 7. Locations Route
app.get('/api/locations', async (req, res) => {
    try {
        const locations = await Location.find({});
        res.json({ success: true, data: locations });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 7.1 Clusters and Branches Route
app.get('/api/clusters-branches', async (req, res) => {
    try {
        const clusters = await Insight.distinct('Cluster', { Cluster: { $ne: null, $ne: "" } });
        const branches = await Insight.distinct('Branch', { Branch: { $ne: null, $ne: "" } });
        res.json({
            success: true,
            data: {
                clusters: clusters.sort(),
                branches: branches.sort()
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 8. Top 10 Doctors
app.get('/api/top10-doctors', async (req, res) => {
    try {
        const insightsData = await Insight.find({});
        if (!insightsData || insightsData.length === 0) {
            return res.json({ success: true, data: { latestMonth: '', topDoctors: [] } });
        }
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const uniqueMonths = [...new Set(insightsData.map(d => d.Month))];
        const sortedMonths = uniqueMonths.sort((a, b) => months.indexOf(b) - months.indexOf(a));
        const latestMonth = sortedMonths[0] || '';
        const latestMonthData = insightsData
            .filter(d => d.Month === latestMonth)
            .map(d => ({
                ...d.toObject(),
                totalGoogleSearch: (d["Google Search - Mobile"] || 0) + (d["Google Search - Desktop"] || 0)
            }))
            .sort((a, b) => b.totalGoogleSearch - a.totalGoogleSearch)
            .slice(0, 10);
        res.json({ success: true, data: { latestMonth, topDoctors: latestMonthData } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 9. Doctor Details
app.get('/api/doctor-details/:name', async (req, res) => {
    const identifier = req.params.name.trim();
    const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedIdentifier = escapeRegExp(identifier);

    try {
        let profile = await Doctor.findOne({
            business_name: { $regex: new RegExp(`^${escapedIdentifier}$`, 'i') }
        });
        if (!profile) {
            profile = await Doctor.findOne({
                name: { $regex: new RegExp(`^${escapedIdentifier}$`, 'i') }
            });
        }
        const targetBusinessName = profile && profile.business_name ? profile.business_name : identifier;
        const escapedTargetName = escapeRegExp(targetBusinessName);
        const insights = await Insight.find({
            "Business name": { $regex: new RegExp(`^${escapedTargetName}$`, 'i') }
        });
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthlyInsights = insights.sort((a, b) => months.indexOf(a.Month) - months.indexOf(b.Month));
        res.json({
            success: true, data: {
                profile,
                monthlyInsights,
                keywords: profile?.labels || [],
                competitors: profile?.labels?.flatMap(l => l.competitors) || []
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Helper for Reviews
async function fetchAllReviews(email, location, pageToken = "", aggregatedData = { ratings: [0, 0, 0, 0, 0], goodReviews: [], badReviews: [], totalFetched: 0 }) {
    return new Promise((resolve, reject) => {
        const http = require('http');
        const postData = JSON.stringify({ function: "reviews", email, location, pageToken });
        const options = {
            hostname: 'multipliersolutions.in',
            port: 80,
            path: '/gmbhospitals/gmb_api/api.php',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
        };
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    if (data.reviews) {
                        data.reviews.forEach(review => {
                            if (review.starRating) {
                                const ratingMap = { "ONE": 0, "TWO": 1, "THREE": 2, "FOUR": 3, "FIVE": 4 };
                                const index = ratingMap[review.starRating];
                                if (index !== undefined) aggregatedData.ratings[index]++;
                                if (review.comment) {
                                    if (review.starRating === "FIVE" && aggregatedData.goodReviews.length < 5) aggregatedData.goodReviews.push({ comment: review.comment, author: review.reviewer.displayName, date: review.createTime });
                                    if (review.starRating === "ONE" && aggregatedData.badReviews.length < 5) aggregatedData.badReviews.push({ comment: review.comment, author: review.reviewer.displayName, date: review.createTime });
                                }
                            }
                        });
                        aggregatedData.totalFetched += data.reviews.length;
                    }
                    if (data.nextPageToken && aggregatedData.totalFetched < 3000) {
                        try { resolve(await fetchAllReviews(email, location, data.nextPageToken, aggregatedData)); } catch (e) { reject(e); }
                    } else { resolve(aggregatedData); }
                } catch (e) { resolve(aggregatedData); }
            });
        });
        req.on('error', (e) => resolve(aggregatedData));
        req.write(postData);
        req.end();
    });
}

// 10. Reviews Route
app.post('/api/reviews', async (req, res) => {
    const { email, location } = req.body;
    if (!email || !location) return res.status(400).json({ success: false, error: "Email and Location required" });
    try {
        const result = await fetchAllReviews(email, location);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 11. User Management CRUD (Admin Only)

// GET All Users
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({});
        res.json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// CREATE User
app.post('/api/users', async (req, res) => {
    try {
        const newUser = new User(req.body);
        await newUser.save();
        res.json({ success: true, user: newUser });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// UPDATE User
app.put('/api/users/:id', async (req, res) => {
    try {
        const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedUser) return res.status(404).json({ success: false, error: "User not found" });
        res.json({ success: true, user: updatedUser });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE User
app.delete('/api/users/:id', async (req, res) => {
    try {
        const deletedUser = await User.findByIdAndDelete(req.params.id);
        if (!deletedUser) return res.status(404).json({ success: false, error: "User not found" });
        res.json({ success: true, message: "User deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// 12. Alerts Endpoints

// GET All Alerts (Hierarchical Filtering)
app.get('/api/alerts', async (req, res) => {
    const { email, role, cluster } = req.query;
    try {
        let query = {};

        // Hierarchical Filtering Logic
        if (email === "harsh@multipliersolutions.com") {
            // Super Admin: Sees everything
            query = {};
        } else if (role === "Admin") {
            // Admin: Sees only Cluster and Branch logins
            query = { role: { $in: ["Cluster", "Branch"] } };
        } else if (role === "Cluster") {
            // Cluster: Sees only Branch logins for branches under their cluster
            query = { role: "Branch", cluster: cluster };
        } else {
            // Default/Branch: No one sees their own alerts usually, or restricted view
            query = { _id: null }; // Return nothing
        }

        const alerts = await Alert.find(query).sort({ timestamp: -1 }).limit(50);
        res.json({ success: true, data: alerts });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// CREATE Alert (Internal use / Login trigger)
app.post('/api/alerts', async (req, res) => {
    try {
        const newAlert = new Alert(req.body);
        await newAlert.save();
        res.json({ success: true, alert: newAlert });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// MARK Alerts as Read
app.patch('/api/alerts/read', async (req, res) => {
    try {
        await Alert.updateMany({ read: false }, { $set: { read: true } });
        res.json({ success: true, message: "All alerts marked as read" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE Specific Alert
app.delete('/api/alerts/:id', async (req, res) => {
    try {
        const deletedAlert = await Alert.findByIdAndDelete(req.params.id);
        if (!deletedAlert) return res.status(404).json({ success: false, error: "Alert not found" });
        res.json({ success: true, message: "Alert deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE All Alerts
app.delete('/api/alerts', async (req, res) => {
    try {
        await Alert.deleteMany({});
        res.json({ success: true, message: "All alerts deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
