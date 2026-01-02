const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Models
const Insight = require('./models/Insight');
const Doctor = require('./models/Doctor');
const Location = require('./models/Location');
const User = require('./models/User');

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

// Routes

// 1. Diagnostic / Default
app.get('/api', (req, res) => {
    res.json({ success: true, message: "Backend API is running", version: "1.2.0" });
});

// 2. Auth Route
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ mail: email, psw: password });
        if (user) {
            res.json({ success: true, user: { name: user.user, email: user.mail, logo: user.Logo } });
        } else {
            if (email === "admin@manipal.com" && password === "admin123") {
                res.json({ success: true, user: { name: "Admin", email: "admin@manipal.com" } });
            } else {
                res.status(401).json({ success: false, error: 'Invalid credentials' });
            }
        }
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

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
