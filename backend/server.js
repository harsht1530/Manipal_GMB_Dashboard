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
const MultiplierTeam = require('./models/MultiplierTeam');
const ManipalTicket = require('./models/ManipalTicket');
const Alert = require('./models/Alert');
const Posting = require('./models/Posting');
const Optimization = require('./models/Optimization');
const GMBPost = require('./models/GMBPost');
const ApiInsight = require('./models/ApiInsight');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const axios = require('axios');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        const allowed = [
            'https://multiplierai.co',
            'https://www.multiplierai.co',
            'http://localhost:5173',
            'http://localhost:3000',
            'http://localhost:8080'
        ];
        if (allowed.includes(origin) || origin.includes('localhost:')) {
            callback(null, true);
        } else {
            callback(null, true); // Fallback to true for development, but specify allowed for safety
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer Configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = './uploads/GMB';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'));
    }
});
const upload = multer({ storage: storage });

const storageTicket = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = './uploads/tickets';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'));
    }
});
const uploadTicket = multer({ storage: storageTicket });

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://vasudeva:ommN1EMg2KsURyPQ@cluster0.n3ejr.mongodb.net/HarshDB';

const seedMultiplierTeam = async () => {
    try {
        // Drop unique index on email to allow multi-cluster team configurations
        try {
            await mongoose.connection.db.collection('multiplierteam').dropIndex('email_1');
            console.log("Unique email index dropped on multiplierteam collection.");
        } catch (e) {
            // Index doesn't exist, ignore
        }

        const count = await MultiplierTeam.countDocuments();
        if (count === 0) {
            const team = [
                { name: "Aishwarya", email: "aishwarya@multipliersolutions.com", cluster: "South" },
                { name: "Nikhil", email: "nikhil@multipliersolutions.com", cluster: "West" },
                { name: "Sai Sree", email: "saisree@multipliersolutions.com", cluster: "Bhubaneswar-Vijayawada" },
                { name: "Pranjal", email: "pranjal@multipliersolutions.com", cluster: "North West" },
                { name: "Harsh", email: "harsh@multipliersolutions.com", cluster: "South" }
            ];
            await MultiplierTeam.insertMany(team);
            console.log("Multiplier Team seeded successfully!");
        }
    } catch (err) {
        console.error("Error seeding Multiplier Team:", err);
    }
};

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('Connected to MongoDB');
        seedMultiplierTeam();
    })
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
    <html>
    <head>
        <style>
            .btn:hover {
                background-color: #48BEB9 !important;
                color: white !important;
            }
        </style>
    </head>
    <body style="margin: 0; padding: 0;">
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
    </body>
    </html>
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

            // Log OTP to server console so developers can see it in local testing
            console.log(`\n==========================================\n[AUTH] OTP for ${user.orgEmail || user.mail} is: ${otp}\n==========================================\n`);

            if (sent) {
                res.json({ success: true, message: "OTP sent to your email", email: user.orgEmail || user.mail });
            } else {
                console.warn(`[AUTH] Failed to send OTP email to ${user.orgEmail || user.mail}. Falling back to console login.`);
                res.json({ 
                    success: true, 
                    message: "OTP generated (Email failed to send. For local development, check the server terminal console for the OTP).", 
                    email: user.orgEmail || user.mail 
                });
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
                <a href="${resetUrl}" class="btn" style="background-color: transparent; color: #48BEB9; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; border: 2px solid #48BEB9; transition: all 0.3s ease;">Reset Password</a>
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
        const projection = {
            "Business name": 1,
            "Google Search - Mobile": 1,
            "Google Search - Desktop": 1,
            "Google Maps - Mobile": 1,
            "Google Maps - Desktop": 1,
            Directions: 1,
            "Website clicks": 1,
            Calls: 1,
            Cluster: 1,
            Month: 1,
            Branch: 1,
            Date: 1,
            Speciality: 1,
            Review: 1,
            Rating: 1,
            Department: 1,
            Phone: 1,
            status_type: 1,
            Year: 1
        };

        const insights = await Insight.find({}, projection).lean();

        // De-duplicate insights by Business name + Month + Year to solve duplicate data seeding issue
        const uniqueMap = new Map();
        for (const item of insights) {
            const bName = (item["Business name"] || "").trim().toLowerCase();
            const month = (item.Month || "").trim().toLowerCase();
            const year = item.Year ? String(item.Year) : "";
            const key = `${bName}_${month}_${year}`;
            
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, item);
            }
        }
        const deDuplicated = Array.from(uniqueMap.values());

        res.json({ success: true, data: deDuplicated });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 6. Doctors Route
app.get('/api/doctors', async (req, res) => {
    try {
        const doctors = await Doctor.find({}, {
            business_name: 1,
            name: 1,
            phone: 1,
            placeId: 1,
            newReviewUri: 1,
            mapsUri: 1,
            websiteUrl: 1,
            labels: 1,
            primaryCategory: 1,
            address: 1,
            averageRating: 1,
            totalReviewCount: 1,
            mail_id: 1,
            Cluster: 1,
            Branch: 1,
            profile_screenshot: 1,
            account: 1,
            "labels.rank": 1,
            "labels.label": 1
        });
        res.json({ success: true, data: doctors });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 6.1 Doctor Details Route (For single profile details, loading heavy competitors and screenshot fields dynamically)
app.get('/api/doctors/details', async (req, res) => {
    const { businessName } = req.query;
    try {
        if (!businessName) {
            return res.status(400).json({ success: false, error: "businessName parameter is required" });
        }
        const doctor = await Doctor.findOne({
            business_name: { $regex: new RegExp(`^${businessName.trim()}$`, 'i') }
        });
        if (!doctor) {
            const doctorByName = await Doctor.findOne({
                name: { $regex: new RegExp(`^${businessName.trim()}$`, 'i') }
            });
            if (!doctorByName) {
                return res.status(404).json({ success: false, error: "Doctor not found" });
            }
            return res.json({ success: true, data: doctorByName });
        }
        res.json({ success: true, data: doctor });
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

// GET Distinct Branches and their Clusters for dropdown meta
app.get('/api/branches-meta', async (req, res) => {
    try {
        const locations = await Location.find({}, { "Unit Name": 1, Cluster: 1, _id: 0 });
        const branchesMap = {};
        locations.forEach(loc => {
            const branchName = loc["Unit Name"];
            if (branchName && loc.Cluster) {
                branchesMap[branchName] = loc.Cluster;
            }
        });
        const data = Object.entries(branchesMap).map(([branch, cluster]) => ({
            branch,
            cluster
        }));
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 7.0 Postings Route
app.get('/api/postings', async (req, res) => {
    try {
        const postings = await Posting.find({}).sort({ Date: -1 });
        res.json({ success: true, data: postings });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 7.0.1 Optimizations Route
app.get('/api/optimizations', async (req, res) => {
    try {
        const optimizations = await Optimization.find({});
        res.json({ success: true, data: optimizations });
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
        // Find the latest month from the collection
        const latestEntry = await Insight.findOne({ Month: { $ne: null } }).sort({ Date: -1 });
        if (!latestEntry) return res.json({ success: true, data: { latestMonth: '', topDoctors: [] } });

        const latestMonth = latestEntry.Month;

        // Get top 10 doctors for that month using aggregation
        const topDoctors = await Insight.aggregate([
            { $match: { Month: latestMonth } },
            {
                $addFields: {
                    totalGoogleSearch: { $add: [{ $ifNull: ["$Google Search - Mobile", 0] }, { $ifNull: ["$Google Search - Desktop", 0] }] }
                }
            },
            { $sort: { totalGoogleSearch: -1 } },
            { $limit: 10 }
        ]);

        res.json({ success: true, data: { latestMonth, topDoctors } });
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
// 11.5 Critical GMB Profiles Route
app.get('/api/critical-gmb-profiles', async (req, res) => {
    try {
        const collection = mongoose.connection.db.collection('manipalcriticalissues');

        // Exclude the summary doc from items and project only needed fields
        const items = await collection.find(
            { _id: { $ne: "latest_scan_summary" } },
            {
                projection: {
                    title: 1,
                    email: 1,
                    placeId: 1,
                    locationid: 1,
                    Cluster: 1,
                    Branch: 1,
                    primaryCategory: 1,
                    issues: 1,
                    updatedTime: 1,
                    status: 1
                }
            }
        ).toArray();

        // Find the summary doc
        const summary = await collection.findOne({ _id: "latest_scan_summary" });

        res.json({
            ok: true,
            summary: summary || null,
            items: items || []
        });
    } catch (error) {
        console.error("Error fetching critical GMB profiles:", error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// 12. Alerts Endpoints

// GET All Alerts (Hierarchical Filtering)
app.get('/api/alerts', async (req, res) => {
    const { email, role, cluster, branch } = req.query;
    try {
        let query = {};
        
        // Check if user is in Multiplier Team list (case-insensitive)
        const teamMembers = email ? await MultiplierTeam.find({ email: { $regex: new RegExp(`^${email}$`, 'i') } }) : [];
        const isMultiplier = teamMembers.length > 0;

        // Hierarchical Filtering Logic
        if (email === "harsh@multipliersolutions.com" && role === "Admin") {
            // Super Admin: Sees everything when logged in as Admin
            query = {};
        } else if (isMultiplier) {
            // Multiplier: Sees GMB ticket alerts for their clusters
            const allowedClusters = teamMembers.map(m => m.cluster).filter(Boolean);
            if (cluster) {
                allowedClusters.push(cluster);
            }
            const uniqueClusters = Array.from(new Set(allowedClusters));
            query = {
                cluster: { $in: uniqueClusters },
                type: { $regex: /^TICKET_/ }
            };
        } else if (role === "Admin") {
            // Admin: Sees all ticket alerts
            query = {
                type: { $regex: /^TICKET_/ }
            };
        } else if (role === "Cluster") {
            // Cluster: Sees GMB ticket alerts in their cluster
            query = {
                cluster: cluster,
                type: { $regex: /^TICKET_/ }
            };
        } else if (role === "Branch") {
            // Branch user: Sees GMB ticket alerts for their branch
            query = {
                location: branch || "",
                type: { $regex: /^TICKET_/ }
            };
        } else {
            // Default/Fallback: Return nothing
            query = { _id: null };
        }

        // Filter: If targetEmail is set on an alert, only show it to the matching user
        if (email && email !== "harsh@multipliersolutions.com") {
            query = {
                $and: [
                    query,
                    {
                        $or: [
                            { targetEmail: { $exists: false } },
                            { targetEmail: null },
                            { targetEmail: email.toLowerCase() }
                        ]
                    }
                ]
            };
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

// 13. GMB Postings Functionality

// Proxy for AI Post Generation
app.post('/api/generate-gmb-post', async (req, res) => {
    const { source_url, business_name } = req.body;
    try {
        const response = await axios.post('https://demo.gmbapi.multipliersolutions.in/generate_gmb_post', {
            source_url,
            business_name
        });
        res.json(response.data);
    } catch (error) {
        console.error("AI Generation Error:", error.message);
        res.status(500).json({ success: false, error: "Failed to generate post" });
    }
});

// Image Upload
app.post('/api/upload-image', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: "No file uploaded" });
    }
    // We construct the production backend URL because Google API cannot fetch from localhost or static frontend builds
    const isLocal = req.get('host').includes('localhost');
    const baseUrl = isLocal ? "https://smldatamanagement.multiplierai.co" : `${req.protocol}://${req.get('host')}`;
    const imageUrl = `${baseUrl}/uploads/GMB/${req.file.filename}`;
    res.json({ success: true, imageUrl, filename: req.file.filename });
});

// Save GMB Posting
app.post('/api/gmb-postings', async (req, res) => {
    try {
        const newPost = new GMBPost(req.body);
        await newPost.save();

        // If status is Approved and no schedule, trigger immediate post
        if (newPost.status === 'Approved' && !newPost.scheduledTime) {
            triggerActionPost(newPost);
        }

        res.json({ success: true, data: newPost });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get GMB Postings for Tracker
app.get('/api/gmb-postings', async (req, res) => {
    try {
        const posts = await GMBPost.find({}).sort({ createdAt: -1 });
        res.json({ success: true, data: posts });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Helper function to translate technical GMB API errors into user-friendly messages
function getFriendlyErrorMessage(techMsg) {
    if (!techMsg) return "An unexpected error occurred while posting.";
    
    const msg = techMsg.toLowerCase();
    
    if (msg.includes("image too small")) {
        // Extract dimensions if possible (e.g. "Got: 243px/174px (min: 250px/250px w/h)")
        const minMatch = techMsg.match(/min: (\d+px\/\d+px)/i);
        const minSize = minMatch ? minMatch[1].replace('/', 'x') : "250x250";
        return `The image you uploaded is too small. Please use an image of at least ${minSize} pixels.`;
    }
    
    if (msg.includes("photos.additional_photo_urls")) {
        return "There was an issue with the image you provided. Please ensure the image is valid and accessible.";
    }
    
    if (msg.includes("invalid argument")) {
        return "The post content contains invalid information. Please check the text and images and try again.";
    }
    
    if (msg.includes("quota exceeded")) {
        return "The daily limit for GMB postings has been reached. Please try again tomorrow.";
    }
    
    if (msg.includes("not verified")) {
        return "This GMB profile is not verified. You can only post to verified locations.";
    }

    if (msg.includes("permission denied") || msg.includes("do not have permission")) {
        return "The system does not have permission to post to this location. Please check account access.";
    }

    if (msg.includes("timeout") || msg.includes("econnreset")) {
        return "The connection to the posting service timed out. Please try again in a few minutes.";
    }

    // Fallback: Clean up the technical message slightly if no mapping found
    return techMsg.length > 150 ? techMsg.substring(0, 150) + "..." : techMsg;
}

// Helper function to trigger the external actionpost API
async function triggerActionPost(post) {
    try {
        let mediaUrl = post.imageUrl || "";

        const payload = {
            function: "actionpost",
            location: post.account, // Location ID from manipalfinaldatas 'account' field
            email: post.email,
            posts_text: post.postsText,
            post_action_type: "CALL"
        };

        if (mediaUrl) {
            payload.post_media_type = "Photo";
            payload.post_media_url = mediaUrl;
        }

        const response = await axios.post('http://multipliersolutions.in/gmbhospitals/gmb_api/api.php', payload);
        
        // Ensure we handle various success responses properly
        const resStr = JSON.stringify(response.data).toLowerCase();
        if (
            response.data.status === 'success' || 
            response.data.response === 'Success' || 
            response.data.status === true ||
            (response.status === 200 && !resStr.includes('error') && !resStr.includes('failed'))
        ) {
            post.status = 'Posted';
            post.errorMessage = undefined;
        } else {
            post.status = 'Failed';
            
            // Extract detailed error message from response
            let msg = "API Error";
            let data = response.data;

            // Robust JSON extraction from string (handles "Error creating post: { ... }")
            if (typeof data === 'string') {
                const startIdx = data.indexOf('{');
                const endIdx = data.lastIndexOf('}');
                if (startIdx !== -1 && endIdx !== -1) {
                    try {
                        const jsonPart = data.substring(startIdx, endIdx + 1);
                        data = JSON.parse(jsonPart);
                    } catch (e) { }
                }
            }
            
            if (data && typeof data === 'object') {
                if (data.error) {
                    msg = data.error.message || msg;
                    // Deep dive into GMB validation details
                    const details = data.error.details;
                    if (Array.isArray(details) && details[0]) {
                        if (Array.isArray(details[0].errorDetails) && details[0].errorDetails[0]) {
                            msg = details[0].errorDetails[0].message || msg;
                        } else if (details[0].message) {
                            msg = details[0].message;
                        }
                    }
                } else if (data.message) {
                    msg = data.message;
                }
            } else if (typeof data === 'string') {
                msg = data.length > 250 ? data.substring(0, 250) + "..." : data;
            }
            
            post.errorMessage = getFriendlyErrorMessage(msg);
            console.error("GMB API Error Response:", response.data);
            console.log("Extracted Error Message:", post.errorMessage);
        }
        await post.save();
        console.log(`Post ${post._id} processed with status: ${post.status}`);
    } catch (error) {
        console.error(`Error triggering actionpost for ${post._id}:`, error.message);
        post.status = 'Failed';
        
        let msg = error.message;
        if (error.response && error.response.data) {
            let data = error.response.data;
            
            // Robust JSON extraction from string in catch block too
            if (typeof data === 'string') {
                const startIdx = data.indexOf('{');
                const endIdx = data.lastIndexOf('}');
                if (startIdx !== -1 && endIdx !== -1) {
                    try {
                        const jsonPart = data.substring(startIdx, endIdx + 1);
                        data = JSON.parse(jsonPart);
                    } catch (e) { }
                }
            }

            if (data && typeof data === 'object') {
                if (data.error) {
                    msg = data.error.message || msg;
                    const details = data.error.details;
                    if (Array.isArray(details) && details[0]) {
                        if (Array.isArray(details[0].errorDetails) && details[0].errorDetails[0]) {
                            msg = details[0].errorDetails[0].message;
                        } else if (details[0].message) {
                            msg = details[0].message;
                        }
                    }
                } else if (data.message) {
                    msg = data.message;
                }
            }
        }
        
        post.errorMessage = getFriendlyErrorMessage(msg);
        await post.save();
    }
}

// Send Case Email Notification
app.post('/api/send-case-email', async (req, res) => {
    const { formType, formData, user } = req.body;

    if (!user || !user.email) {
        return res.status(400).json({ success: false, error: "User email is required" });
    }

    try {
        // Build table rows from formData ignoring empty values
        let tableRows = '';
        const skipKeys = ['images', 'drAccount', 'drEmail', 'aiResponse']; // Skip internal or bulky fields
        for (const [key, value] of Object.entries(formData)) {
            if (value && !skipKeys.includes(key)) {
                // Formatting key to Title Case (e.g. businessName -> Business Name)
                const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                
                // Truncate extremely long values (like AI post descriptions) just for the email display
                const displayValue = String(value).length > 300 ? String(value).substring(0, 300) + '...' : value;

                tableRows += `
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: bold; width: 35%; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word;">${formattedKey}</td>
                        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #334155; line-height: 1.5; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word;">${displayValue}</td>
                    </tr>
                `;
            }
        }

        const tableHtml = `
            <table style="width: 100%; table-layout: fixed; border-collapse: collapse; text-align: left; margin-top: 20px; font-size: 14px; background-color: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        `;

        // 1. Email to User (Sender's perspective)
        const userContent = `
            <div style="text-align: left; padding: 10px;">
                <h2 style="color: #10b981; margin-bottom: 8px; font-size: 22px;">Thank You, ${user.name}!</h2>
                <p style="color: #475569; font-size: 15px; margin-top: 0;">Your <strong>${formType}</strong> request has been successfully submitted. Our team is currently reviewing your submission and will process it shortly.</p>
                <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #f1f5f9;">
                    <h3 style="color: #1e293b; margin-bottom: 15px; font-size: 16px;">Submission Summary</h3>
                    ${tableHtml}
                </div>
            </div>
        `;
        
        // 2. Email to Team (Info perspective)
        const teamContent = `
            <div style="text-align: left; padding: 10px;">
                <h2 style="color: #217a74; margin-bottom: 8px; font-size: 22px;">New Case ID Raised</h2>
                <p style="color: #475569; font-size: 15px; margin-top: 0;">A new <strong>${formType}</strong> request was just submitted by <strong>${user.name}</strong> (<a href="mailto:${user.email}" style="color: #3b82f6; text-decoration: none;">${user.email}</a>).</p>
                <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #f1f5f9;">
                    <h3 style="color: #1e293b; margin-bottom: 15px; font-size: 16px;">Request Details</h3>
                    ${tableHtml}
                </div>
            </div>
        `;

        // Send emails concurrently
        await Promise.all([
            sendEmail(user.email, `Confirmation: Your ${formType} Request`, getEmailTemplate(userContent)),
            sendEmail('gmb@multipliersolutions.com', `New Request: ${formType} - ${user.name}`, getEmailTemplate(teamContent))
        ]);

        res.json({ success: true, message: "Emails sent successfully" });
    } catch (error) {
        console.error("Error sending case emails:", error);
        res.status(500).json({ success: false, error: "Failed to send emails" });
    }
});

// Scheduler: Check every minute for scheduled posts
cron.schedule('* * * * *', async () => {
    const now = new Date();
    try {
        // Find posts that are due or immediate (null scheduledTime) and still Pending
        const pendingPosts = await GMBPost.find({
            status: 'Pending',
            $or: [
                { scheduledTime: { $lte: now } },
                { scheduledTime: null }
            ]
        });

        for (const post of pendingPosts) {
            // Atomic lock: Try to update status from 'Pending' to 'Processing'
            // This ensures only one scheduler instance/worker processes this specific post
            const lockedPost = await GMBPost.findOneAndUpdate(
                { _id: post._id, status: 'Pending' },
                { $set: { status: 'Processing' } },
                { new: true }
            );

            if (lockedPost) {
                console.log(`Processing scheduled post: ${lockedPost._id}`);
                // Note: We don't 'await' here if we want parallel processing, 
                // but since it's a small scale and inside a loop, await is safer for now.
                await triggerActionPost(lockedPost);
            }
        }
    } catch (error) {
        console.error("Scheduler Error:", error.message);
    }
});

// Ticket and SLA Management Endpoints

// 1. Multiplier Team list
app.get('/api/multiplier-team', async (req, res) => {
    try {
        const team = await MultiplierTeam.find({});
        res.json({ success: true, data: team });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all users in the same cluster as the Multiplier Team member
app.get('/api/multiplier/users', async (req, res) => {
    const { email } = req.query;
    try {
        const member = await MultiplierTeam.findOne({ email });
        if (!member) {
            return res.status(403).json({ success: false, error: "Only Multiplier Team members can access this" });
        }
        // Fetch users belonging to this cluster (matching case-sensitive Cluster field)
        const users = await User.find({ Cluster: member.cluster }, { Name: 1, user: 1, mail: 1, orgEmail: 1, Branch: 1, Cluster: 1 });
        res.json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST Create ticket from Multiplier team member to Branch user
app.post('/api/multiplier/tickets', uploadTicket.fields([
    { name: 'attachments', maxCount: 10 }
]), async (req, res) => {
    try {
        const { category, ticketType, multiplierName, multiplierEmail, targetUserName, targetUserEmail, cluster, branch, description } = req.body;
        
        // Generate Sequential Ticket ID
        const currentYear = new Date().getFullYear();
        const latestTicket = await ManipalTicket.findOne({ ticketId: new RegExp(`TKT-${currentYear}-`) }).sort({ createdAt: -1 });
        let nextSeq = 1;
        if (latestTicket) {
            const parts = latestTicket.ticketId.split('-');
            const lastSeq = parseInt(parts[parts.length - 1]);
            if (!isNaN(lastSeq)) {
                nextSeq = lastSeq + 1;
            }
        }
        const ticketId = `TKT-${currentYear}-${String(nextSeq).padStart(5, '0')}`;
        
        // SLA: 7 days lifecycle
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7);
        
        let fileAttachments = [];
        if (req.files && req.files['attachments']) {
            fileAttachments = req.files['attachments'].map(file => ({
                filename: file.originalname,
                path: `/uploads/tickets/${file.filename}`
            }));
        }
        
        const initialLogs = [
            {
                user: multiplierName,
                email: multiplierEmail,
                action: "Created",
                remarks: "Request raised by Multiplier Team Member to Branch SPOC.",
                newValue: "Open",
                timestamp: new Date()
            },
            {
                user: "System",
                email: "system@manipal.com",
                action: "Ticket Assigned",
                remarks: `Assigned directly to Branch user: ${targetUserName}.`,
                newValue: targetUserEmail,
                timestamp: new Date()
            }
        ];
        
        const ticket = new ManipalTicket({
            ticketId,
            category,
            ticketType,
            raisedBy: { name: multiplierName, email: multiplierEmail, role: 'Multiplier' },
            assignedTo: { name: targetUserName, email: targetUserEmail, role: 'Branch' },
            cluster,
            branch,
            dueDate,
            description,
            attachments: fileAttachments,
            activityLogs: initialLogs,
            status: 'Open',
            priority: 'P5'
        });
        
        await ticket.save();
        
        // Create Dashboard Notification (Alert) for target user (Branch user)
        try {
            const ticketAlert = new Alert({
                user: multiplierName,
                role: 'Multiplier',
                location: branch,
                cluster: cluster,
                type: 'TICKET_ASSIGN',
                message: `Multiplier request ${ticketId} raised for you by ${multiplierName}.`
            });
            await ticketAlert.save();
        } catch (alertErr) {
            console.error("Failed to create multiplier request alert:", alertErr);
        }
        
        // Send email notification to Branch SPOC
        const spocMailHtml = getEmailTemplate(`
            <h2 style="color: #333; text-align: left;">New Action Required: GMB Optimization Request</h2>
            <p style="font-size: 15px; color: #555; text-align: left;">
                Hello <strong>${targetUserName}</strong>,<br/><br/>
                A new GMB optimization request has been raised for your unit (<strong>${branch}</strong>) by Multiplier manager <strong>${multiplierName}</strong>:
            </p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0; text-align: left; font-size: 14px;">
                <tr><th style="padding: 8px; border-bottom: 1px solid #ddd; width: 130px;">Request ID:</th><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>${ticketId}</strong></td></tr>
                <tr><th style="padding: 8px; border-bottom: 1px solid #ddd;">Category:</th><td style="padding: 8px; border-bottom: 1px solid #ddd;">${category}</td></tr>
                <tr><th style="padding: 8px; border-bottom: 1px solid #ddd;">Type:</th><td style="padding: 8px; border-bottom: 1px solid #ddd;">${ticketType}</td></tr>
                <tr><th style="padding: 8px; border-bottom: 1px solid #ddd;">Due Date:</th><td style="padding: 8px; border-bottom: 1px solid #ddd;">${dueDate.toDateString()}</td></tr>
                <tr><th style="padding: 8px; border-bottom: 1px solid #ddd;">Instructions:</th><td style="padding: 8px; border-bottom: 1px solid #ddd;">${description}</td></tr>
            </table>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${req.headers.origin || 'http://localhost:5173'}/#/tickets/details/${ticketId}" class="btn" style="background-color: transparent; color: #48BEB9; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; border: 2px solid #48BEB9; transition: all 0.3s ease;">Open Request Details</a>
            </div>
        `);
        await sendEmail(targetUserEmail, `Action Required: GMB Optimization Request - ${ticketId}`, spocMailHtml);
        
        res.json({ success: true, data: ticket });
    } catch (error) {
        console.error("Error creating multiplier ticket:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/multiplier-team', async (req, res) => {
    try {
        const member = new MultiplierTeam(req.body);
        await member.save();
        res.json({ success: true, data: member });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/multiplier-team/:id', async (req, res) => {
    try {
        await MultiplierTeam.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Member deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Fetch Tickets with Access Control
app.get('/api/tickets', async (req, res) => {
    const { email, role, cluster, branch } = req.query;
    try {
        let filter = {};
        
        // Check if user is in Multiplier Team list (case-insensitive) or has Multiplier role
        const teamMembers = email ? await MultiplierTeam.find({ email: { $regex: new RegExp(`^${email}$`, 'i') } }) : [];
        const isMultiplier = (role === "Multiplier" || teamMembers.length > 0);
        
        if (role === 'Admin') {
            filter = {};
        } else if (isMultiplier) {
            // Multiplier team members manage multiple clusters. They should see:
            // 1. Tickets assigned directly to them (case-insensitively).
            // 2. Tickets belonging to any cluster they manage.
            const allowedClusters = teamMembers.map(m => m.cluster).filter(Boolean);
            if (cluster) {
                allowedClusters.push(cluster);
            }
            const uniqueClusters = Array.from(new Set(allowedClusters));
            const emailFilter = email ? { $regex: new RegExp(`^${email}$`, 'i') } : "";
            filter = {
                $or: [
                    { "assignedTo.email": emailFilter },
                    { cluster: { $in: uniqueClusters } }
                ]
            };
        } else if (role === 'Branch' && branch) {
            filter = { branch: branch };
        } else if (role === 'Cluster' && cluster) {
            filter = { cluster: cluster };
        } else {
            // Fallback: match raisedBy/assignedTo email case-insensitively
            const emailFilter = email ? { $regex: new RegExp(`^${email}$`, 'i') } : "";
            filter = {
                $or: [
                    { "raisedBy.email": emailFilter },
                    { "assignedTo.email": emailFilter }
                ]
            };
        }
        
        const tickets = await ManipalTicket.find(filter).sort({ createdAt: -1 });
        res.json({ success: true, data: tickets });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. Create Ticket (Handles Sheet Template & optional attachments)
app.post('/api/tickets', uploadTicket.fields([
    { name: 'excelTemplate', maxCount: 1 },
    { name: 'attachments', maxCount: 10 }
]), async (req, res) => {
    try {
        const { category, ticketType, raisedByName, raisedByEmail, raisedByRole, cluster, branch, description, assignedToName, assignedToEmail } = req.body;
        
        // Generate Sequential Ticket ID
        const currentYear = new Date().getFullYear();
        const latestTicket = await ManipalTicket.findOne({ ticketId: new RegExp(`TKT-${currentYear}-`) }).sort({ createdAt: -1 });
        let nextSeq = 1;
        if (latestTicket) {
            const parts = latestTicket.ticketId.split('-');
            const lastSeq = parseInt(parts[parts.length - 1]);
            if (!isNaN(lastSeq)) {
                nextSeq = lastSeq + 1;
            }
        }
        const ticketId = `TKT-${currentYear}-${String(nextSeq).padStart(5, '0')}`;
        
        // Check if raiser is a Multiplier team member (case-insensitive email match)
        const isRaiserMultiplier = await MultiplierTeam.findOne({ email: { $regex: new RegExp(`^${raisedByEmail}$`, 'i') } });

        // Auto-assign Owner
        let assignee = { name: "Harsh", email: "harsh@multipliersolutions.com" }; // default fallback
        let assignedRole = 'Multiplier';
        let assignRemarks = '';

        if (isRaiserMultiplier && assignedToEmail && assignedToName) {
            assignee = { name: assignedToName, email: assignedToEmail };
            assignedRole = 'Branch';
            assignRemarks = `Assigned directly to Branch user: ${assignee.name}.`;
        } else {
            // Auto-assign Owner based on cluster mapping
            const teamMembers = await MultiplierTeam.find({ cluster: cluster });
            if (teamMembers && teamMembers.length > 0) {
                if (teamMembers.length === 1) {
                    assignee = { name: teamMembers[0].name, email: teamMembers[0].email };
                } else {
                    // Workout-based distribution: Assign to member with fewest active tickets
                    let minCount = Infinity;
                    let selectedMember = teamMembers[0];
                    for (const member of teamMembers) {
                        const count = await ManipalTicket.countDocuments({ "assignedTo.email": member.email, status: { $ne: 'Closed' } });
                        if (count < minCount) {
                            minCount = count;
                            selectedMember = member;
                        }
                    }
                    assignee = { name: selectedMember.name, email: selectedMember.email };
                }
            }
            assignRemarks = `Automatically assigned based on Cluster mapping to cluster owner: ${assignee.name}.`;
        }
        
        // SLA: 7 days lifecycle
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7);
        
        // Handle files
        let excelFile = null;
        if (req.files && req.files['excelTemplate'] && req.files['excelTemplate'][0]) {
            const file = req.files['excelTemplate'][0];
            excelFile = {
                filename: file.originalname,
                path: `/uploads/tickets/${file.filename}`
            };
        }
        
        let fileAttachments = [];
        if (req.files && req.files['attachments']) {
            fileAttachments = req.files['attachments'].map(file => ({
                filename: file.originalname,
                path: `/uploads/tickets/${file.filename}`
            }));
        }
        
        // Audit log entries
        const initialLogs = [
            {
                user: raisedByName,
                email: raisedByEmail,
                action: "Created",
                remarks: "Ticket created and template uploaded.",
                newValue: "Open",
                timestamp: new Date()
            },
            {
                user: "System",
                email: "system@manipal.com",
                action: "Ticket Assigned",
                remarks: assignRemarks,
                newValue: assignee.email,
                timestamp: new Date()
            }
        ];
        
        const ticket = new ManipalTicket({
            ticketId,
            category,
            ticketType,
            raisedBy: { name: raisedByName, email: raisedByEmail, role: raisedByRole || (isRaiserMultiplier ? 'Multiplier' : 'Branch') },
            assignedTo: { name: assignee.name, email: assignee.email, role: assignedRole },
            cluster,
            branch,
            dueDate,
            description,
            excelTemplate: excelFile,
            attachments: fileAttachments,
            activityLogs: initialLogs,
            status: 'Open',
            priority: 'P5'
        });
        
        await ticket.save();
        
        // Create Dashboard Notification (Alert)
        try {
            const ticketAlert = new Alert({
                user: raisedByName,
                role: 'Branch',
                location: branch,
                cluster: cluster,
                type: 'TICKET_ASSIGN',
                message: `New ticket ${ticketId} raised for ${branch} and assigned to ${assignee.name}.`
            });
            await ticketAlert.save();
        } catch (alertErr) {
            console.error("Failed to create ticket alert:", alertErr);
        }
        
        // Send email notifications
        const assigneeMailHtml = getEmailTemplate(`
            <h2 style="color: #333; text-align: left;">New GMB Ticket Assigned</h2>
            <p style="font-size: 15px; color: #555; text-align: left;">
                Hello <strong>${assignee.name}</strong>,<br/><br/>
                A new GMB operations ticket has been raised and assigned to you:
            </p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0; text-align: left; font-size: 14px;">
                <tr><th style="padding: 8px; border-bottom: 1px solid #ddd; width: 130px;">Ticket ID:</th><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>${ticketId}</strong></td></tr>
                <tr><th style="padding: 8px; border-bottom: 1px solid #ddd;">Category:</th><td style="padding: 8px; border-bottom: 1px solid #ddd;">${category}</td></tr>
                <tr><th style="padding: 8px; border-bottom: 1px solid #ddd;">Ticket Type:</th><td style="padding: 8px; border-bottom: 1px solid #ddd;">${ticketType}</td></tr>
                <tr><th style="padding: 8px; border-bottom: 1px solid #ddd;">Branch:</th><td style="padding: 8px; border-bottom: 1px solid #ddd;">${branch} (${cluster})</td></tr>
                <tr><th style="padding: 8px; border-bottom: 1px solid #ddd;">Priority:</th><td style="padding: 8px; border-bottom: 1px solid #ddd;"><span style="background-color: #f0fdf4; color: #166534; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${ticket.priority}</span></td></tr>
                <tr><th style="padding: 8px; border-bottom: 1px solid #ddd;">Due Date:</th><td style="padding: 8px; border-bottom: 1px solid #ddd;">${dueDate.toDateString()}</td></tr>
                <tr><th style="padding: 8px; border-bottom: 1px solid #ddd;">Description:</th><td style="padding: 8px; border-bottom: 1px solid #ddd;">${description}</td></tr>
            </table>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${req.headers.origin || 'http://localhost:5173'}/#/tickets/details/${ticketId}" class="btn" style="background-color: transparent; color: #48BEB9; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; border: 2px solid #48BEB9; transition: all 0.3s ease;">View Ticket Details</a>
            </div>
        `);
        
        await sendEmail(assignee.email, `New GMB Ticket: ${ticketId} - ${ticketType}`, assigneeMailHtml);
        
        const spocMailHtml = getEmailTemplate(`
            <h2 style="color: #333; text-align: left;">Ticket Raised Successfully</h2>
            <p style="font-size: 15px; color: #555; text-align: left;">
                Hello <strong>${raisedByName}</strong>,<br/><br/>
                Your GMB ticket <strong>${ticketId}</strong> has been raised successfully.
            </p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0; text-align: left; font-size: 14px;">
                <tr><th style="padding: 8px; border-bottom: 1px solid #ddd; width: 130px;">Ticket ID:</th><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>${ticketId}</strong></td></tr>
                <tr><th style="padding: 8px; border-bottom: 1px solid #ddd;">Ticket Type:</th><td style="padding: 8px; border-bottom: 1px solid #ddd;">${ticketType}</td></tr>
                <tr><th style="padding: 8px; border-bottom: 1px solid #ddd;">Due Date:</th><td style="padding: 8px; border-bottom: 1px solid #ddd;">${dueDate.toDateString()}</td></tr>
            </table>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${req.headers.origin || 'http://localhost:5173'}/#/tickets/details/${ticketId}" class="btn" style="background-color: transparent; color: #48BEB9; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; border: 2px solid #48BEB9; transition: all 0.3s ease;">Track Ticket</a>
            </div>
        `);
        await sendEmail(raisedByEmail, `Ticket Raised: ${ticketId}`, spocMailHtml);
        
        res.json({ success: true, data: ticket });
    } catch (error) {
        console.error("Error creating ticket:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 4. Fetch Single Ticket details
app.get('/api/tickets/:ticketId', async (req, res) => {
    try {
        const ticket = await ManipalTicket.findOne({ ticketId: req.params.ticketId });
        if (!ticket) return res.status(404).json({ success: false, error: "Ticket not found" });
        res.json({ success: true, data: ticket });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 5. Add Activity Log / Comment / Status transition
app.post('/api/tickets/:ticketId/logs', uploadTicket.array('attachments', 10), async (req, res) => {
    try {
        const { user, email, action, prevValue, newValue, remarks, isInternal, sendEmailNotify } = req.body;
        const ticket = await ManipalTicket.findOne({ ticketId: req.params.ticketId });
        if (!ticket) return res.status(404).json({ success: false, error: "Ticket not found" });
        
        let logAttachments = [];
        if (req.files && req.files.length > 0) {
            logAttachments = req.files.map(file => ({
                filename: file.originalname,
                path: `/uploads/tickets/${file.filename}`
            }));
            // Append to public attachments if not an internal note
            if (isInternal !== 'true') {
                ticket.attachments.push(...logAttachments);
            }
        }
        
        const newLog = {
            user,
            email,
            action,
            prevValue,
            newValue,
            remarks,
            isInternal: isInternal === 'true',
            attachments: logAttachments,
            timestamp: new Date()
        };
        
        ticket.activityLogs.push(newLog);
        
        if (action === "Status Changes" && newValue) {
            ticket.status = newValue;
        }
        
        await ticket.save();
        
        // Create Dashboard Notification (Alert)
        try {
            const msg = action === "Status Changes"
                ? `Ticket ${ticket.ticketId} status updated to ${newValue} by ${user}.`
                : `New comment added to ticket ${ticket.ticketId} by ${user}.`;
            const logAlert = new Alert({
                user,
                role: 'System',
                location: ticket.branch,
                cluster: ticket.cluster,
                type: 'TICKET_STATUS',
                message: msg
            });
            await logAlert.save();
        } catch (alertErr) {
            console.error("Failed to create log alert:", alertErr);
        }
        
        // Email trigger
        if (sendEmailNotify === 'true') {
            const isClient = email === ticket.raisedBy.email;
            const targetMail = isClient ? ticket.assignedTo.email : ticket.raisedBy.email;
            const updateMessage = action === "Status Changes"
                ? `The status of ticket <strong>${ticket.ticketId}</strong> has been updated to <strong>${newValue}</strong> by ${user}.`
                : `A new update has been logged on ticket <strong>${ticket.ticketId}</strong> by ${user}:<br/><em>${remarks}</em>`;
            
            const mailHtml = getEmailTemplate(`
                <div style="text-align: left; color: #333;">
                    <h2>Ticket Update Notification</h2>
                    <p style="font-size: 15px;">${updateMessage}</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${req.headers.origin || 'http://localhost:5173'}/#/tickets/details/${ticket.ticketId}" class="btn" style="background-color: transparent; color: #48BEB9; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; border: 2px solid #48BEB9; transition: all 0.3s ease;">View Updates</a>
                    </div>
                </div>
            `);
            
            await sendEmail(targetMail, `Update on Ticket: ${ticket.ticketId}`, mailHtml);
        }
        
        res.json({ success: true, data: ticket });
    } catch (error) {
        console.error("Error adding log:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 6. Transfer/Reassign Ticket
app.post('/api/tickets/:ticketId/transfer', async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { transferByName, transferByEmail, newAssigneeEmail, remarks } = req.body;
        
        const ticket = await ManipalTicket.findOne({ ticketId });
        if (!ticket) return res.status(404).json({ success: false, error: "Ticket not found" });
        
        const newAssignee = await MultiplierTeam.findOne({ email: newAssigneeEmail });
        if (!newAssignee) return res.status(400).json({ success: false, error: "New assignee not found in Multiplier Team" });
        
        const prevAssignee = ticket.assignedTo;
        ticket.assignedTo = { name: newAssignee.name, email: newAssignee.email };
        
        const log = {
            user: transferByName,
            email: transferByEmail,
            action: "Assignment Changes",
            prevValue: prevAssignee.email,
            newValue: newAssignee.email,
            remarks: remarks || `Ticket transferred from ${prevAssignee.name} to ${newAssignee.name}.`,
            timestamp: new Date()
        };
        
        ticket.activityLogs.push(log);
        ticket.updatedAt = new Date();
        await ticket.save();
        
        // Create Dashboard Notification (Alert)
        try {
            const transferAlert = new Alert({
                user: transferByName,
                role: 'Multiplier',
                location: ticket.branch,
                cluster: ticket.cluster,
                type: 'TICKET_TRANSFER',
                message: `Ticket ${ticketId} transferred from ${prevAssignee.name} to ${newAssignee.name}.`
            });
            await transferAlert.save();
        } catch (alertErr) {
            console.error("Failed to create transfer alert:", alertErr);
        }
        
        // Notify both parties
        const notifyNewHtml = getEmailTemplate(`
            <h2 style="color: #333; text-align: left;">GMB Ticket Transferred to You</h2>
            <p style="font-size: 15px; color: #555; text-align: left;">
                Hello <strong>${newAssignee.name}</strong>,<br/><br/>
                Ticket <strong>${ticketId}</strong> has been transferred to you by ${transferByName}.
            </p>
            <p style="font-size: 14px; color: #555;"><strong>Transfer Note:</strong> ${remarks || "None"}</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${req.headers.origin || 'http://localhost:5173'}/#/tickets/details/${ticketId}" class="btn" style="background-color: transparent; color: #48BEB9; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; border: 2px solid #48BEB9; transition: all 0.3s ease;">View Ticket</a>
            </div>
        `);
        await sendEmail(newAssignee.email, `Ticket Assigned (Transfer): ${ticketId}`, notifyNewHtml);
        
        const notifyOldHtml = getEmailTemplate(`
            <h2>Ticket Transferred Out</h2>
            <p>Ticket <strong>${ticketId}</strong> has been reassigned to <strong>${newAssignee.name}</strong> by ${transferByName}.</p>
        `);
        await sendEmail(prevAssignee.email, `Ticket Reassigned Out: ${ticketId}`, notifyOldHtml);
        
        res.json({ success: true, data: ticket });
    } catch (error) {
        console.error("Error transferring ticket:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 6.5 Manual SLA Reminder endpoint
app.post('/api/tickets/:ticketId/remind', async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { senderName } = req.body;
        const ticket = await ManipalTicket.findOne({ ticketId });
        if (!ticket) return res.status(404).json({ success: false, error: "Ticket not found" });

        // Create Dashboard Notification (Alert) for the assignee
        try {
            const reminderAlert = new Alert({
                user: senderName || 'System',
                role: 'System',
                location: ticket.branch,
                cluster: ticket.cluster,
                type: 'TICKET_SLA',
                targetEmail: ticket.assignedTo.email,
                message: `SLA Reminder for ticket ${ticketId}: Please resolve this ticket.`
            });
            await reminderAlert.save();
        } catch (alertErr) {
            console.error("Failed to create manual SLA reminder alert:", alertErr);
        }

        // Send Email notification to the assignee
        const mailHtml = getEmailTemplate(`
            <h2>Manual SLA Reminder</h2>
            <p>Hello <strong>${ticket.assignedTo.name}</strong>,</p>
            <p>A manual SLA reminder has been triggered by <strong>${senderName || 'system'}</strong> for ticket <strong>${ticketId}</strong>.</p>
            <p>Please review and resolve the request as soon as possible.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${req.headers.origin || 'http://localhost:5173'}/#/tickets/details/${ticketId}" class="btn" style="background-color: transparent; color: #48BEB9; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; border: 2px solid #48BEB9; transition: all 0.3s ease;">View Ticket Details</a>
            </div>
        `);
        await sendEmail(ticket.assignedTo.email, `SLA Reminder Alert: ${ticketId}`, mailHtml);

        // Record reminder event in the activity logs
        ticket.activityLogs.push({
            user: senderName || "System",
            email: "system@manipal.com",
            action: "Comments",
            remarks: `Manual SLA Reminder triggered. Email and dashboard notification sent to assignee: ${ticket.assignedTo.name}.`,
            timestamp: new Date()
        });
        await ticket.save();

        res.json({ success: true, data: ticket });
    } catch (error) {
        console.error("Error triggering manual reminder:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// SLA Check logic
const runSlaCheck = async () => {
    const now = new Date();
    const unresolvedTickets = await ManipalTicket.find({
        status: { $nin: ['Completed', 'Closed'] }
    });
    
    let updatedCount = 0;
    for (const ticket of unresolvedTickets) {
        // Calculate age of the ticket
        const diffTime = Math.abs(now - ticket.createdAt);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let priorityChanged = false;
        let emailSent = false;
        let escalationLogged = false;
        let oldPriority = ticket.priority;
        let newPriority = oldPriority;
        let remarks = "";
        let action = "";
        
        if (diffDays >= 8 && ticket.status !== 'Escalated') {
            // Day 8+: Escalation workflow
            ticket.status = 'Escalated';
            ticket.priority = 'P1';
            newPriority = 'P1';
            action = "Escalations";
            remarks = `Auto-escalated to Regional Marketing Head after 8 days of SLA breach.`;
            
            const regionalHeadEmail = 'regional.marketing.head@manipal.com';
            const escalHtml = getEmailTemplate(`
                <h2 style="color: #d32f2f;">SLA Breach Escalation Notice</h2>
                <p>The GMB operations ticket <strong>${ticket.ticketId}</strong> has been unresolved for 8+ days and is escalated to the Regional Marketing Head.</p>
                <p><strong>Assignee:</strong> ${ticket.assignedTo.name} (${ticket.assignedTo.email})</p>
                <p><strong>Branch:</strong> ${ticket.branch}</p>
            `);
            await sendEmail(regionalHeadEmail, `SLA BREACH ESCALATION: ${ticket.ticketId}`, escalHtml);
            await sendEmail('harsh@multipliersolutions.com', `SLA BREACH ESCALATION: ${ticket.ticketId}`, escalHtml);
            
            escalationLogged = true;
        } else if (diffDays === 7 && ticket.priority !== 'P1') {
            ticket.priority = 'P1';
            newPriority = 'P1';
            action = "Priority Changes";
            remarks = `Auto-increased priority to P1 (Day 7). Final SLA reminder logged.`;
            
            priorityChanged = true;
            emailSent = true;
        } else if (diffDays === 6 && ticket.priority !== 'P2') {
            ticket.priority = 'P2';
            newPriority = 'P2';
            action = "Priority Changes";
            remarks = `Auto-increased priority to P2 (Day 6). SLA reminder logged.`;
            
            priorityChanged = true;
            emailSent = true;
        } else if (diffDays === 5 && ticket.priority !== 'P2') {
            ticket.priority = 'P2';
            newPriority = 'P2';
            action = "Priority Changes";
            remarks = `Auto-increased priority to P2 (Day 5). SLA reminder logged.`;
            
            priorityChanged = true;
            emailSent = true;
        } else if (diffDays === 4 && ticket.priority !== 'P3') {
            ticket.priority = 'P3';
            newPriority = 'P3';
            action = "Priority Changes";
            remarks = `Auto-increased priority to P3 (Day 4).`;
            priorityChanged = true;
        } else if (diffDays === 3 && ticket.priority !== 'P4') {
            ticket.priority = 'P4';
            newPriority = 'P4';
            action = "Priority Changes";
            remarks = `Auto-increased priority to P4 (Day 3).`;
            priorityChanged = true;
        }
        
        if (priorityChanged || escalationLogged) {
            ticket.activityLogs.push({
                user: "System",
                email: "system@manipal.com",
                action: action,
                prevValue: oldPriority,
                newValue: newPriority,
                remarks: remarks,
                timestamp: new Date()
            });
            ticket.updatedAt = new Date();
            await ticket.save();

            // Create Dashboard Notification (Alert)
            try {
                const slaAlert = new Alert({
                    user: 'System',
                    role: 'System',
                    location: ticket.branch,
                    cluster: ticket.cluster,
                    type: 'TICKET_SLA',
                    targetEmail: ticket.assignedTo.email,
                    message: `Ticket ${ticket.ticketId} SLA Update: ${remarks}`
                });
                await slaAlert.save();
            } catch (alertErr) {
                console.error("Failed to create SLA check alert:", alertErr);
            }

            updatedCount++;
        }
    }
    return updatedCount;
};

// 7. Diagnostics endpoint to run SLA progression check instantly
app.get('/api/tickets/run-sla-check', async (req, res) => {
    try {
        const count = await runSlaCheck();
        res.json({ success: true, message: `SLA check triggered manually. Updated ${count} tickets.` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Daily Cron Job for SLA Check at 00:00
cron.schedule('0 0 * * *', async () => {
    console.log("Running scheduled daily SLA checker...");
    try {
        const count = await runSlaCheck();
        console.log(`Daily SLA check completed. Updated ${count} tickets.`);
    } catch (error) {
        console.error("Cron SLA Checker Error:", error);
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
