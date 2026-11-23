const dns = require('dns');
dns.setServers(['1.1.1.1', '8.8.8.8']);

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const app = express();
const PORT = process.env.PORT || 5000;

const authRoutes = require('./routes/auth.js');
const listingRoutes = require('./routes/listing.js');
const bookingRoutes = require('./routes/booking.js');
const userRoutes = require('./routes/user.js');
const reviewRoutes = require('./routes/review.js');
const messageRoutes = require('./routes/message.js');
const notificationRoutes = require('./routes/notification.js');
const adminRoutes = require('./routes/admin.js');
const configRoutes = require('./routes/config.js');
const supportRoutes = require('./routes/support.js');

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { message: 'Too many authentication attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 200,
    message: { message: 'Too many requests. Please slow down.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const fs = require('fs');
const UPLOADS_DIR = path.resolve(__dirname, 'public/uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const candidateDistPaths = [
    path.resolve(__dirname, '../frontend/dist'),
    path.resolve(__dirname, './dist'),
    path.resolve(__dirname, '../dist'),
    path.resolve(__dirname, 'public/dist')
];
const frontendDistPath = candidateDistPaths.find(p => fs.existsSync(path.join(p, 'index.html'))) || candidateDistPaths[0];
const indexHtmlPath = path.join(frontendDistPath, 'index.html');
const hasFrontendBuild = fs.existsSync(indexHtmlPath);

// Helper to determine if a request is a frontend browser page navigation
const isPageRequest = (req) => {
    if (req.method !== 'GET') return false;

    // Explicit static file extensions (e.g. .js, .css, .png, .jpg, .ico, etc.)
    if (path.extname(req.path)) return false;

    // Explicit uploaded files or public assets
    if (req.path.startsWith('/uploads') || req.path.startsWith('/public')) return false;

    // Exclude AJAX / XHR requests
    if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') return false;

    const accept = req.headers.accept || '';
    const secFetchDest = req.headers['sec-fetch-dest'];
    const secFetchMode = req.headers['sec-fetch-mode'];
    const isNavigation = secFetchDest === 'document' || secFetchMode === 'navigate';

    // If browser document navigation or accepts html
    if (isNavigation || accept.includes('text/html') || (!accept.includes('application/json') && req.path === '/')) {
        return true;
    }

    return false;
};

const uploadsPath = fs.existsSync(path.resolve(__dirname, 'public/uploads'))
    ? path.resolve(__dirname, 'public/uploads')
    : path.resolve(process.cwd(), 'public/uploads');

const frontendAssetsPath = [
    path.resolve(__dirname, '../frontend/public/assets'),
    path.resolve(process.cwd(), 'frontend/public/assets'),
    path.resolve(process.cwd(), '../frontend/public/assets')
].find(p => fs.existsSync(p));

// Serve uploads and static assets before apiLimiter so images are never rate-limited
app.use('/uploads', express.static(uploadsPath, { maxAge: '7d', etag: true }));
app.use('/public/uploads', express.static(uploadsPath, { maxAge: '7d', etag: true }));
if (frontendAssetsPath) {
    app.use('/assets', express.static(frontendAssetsPath, { maxAge: '7d', etag: true }));
    app.use('/public/assets', express.static(frontendAssetsPath, { maxAge: '7d', etag: true }));
}

app.use('/auth', authLimiter);
app.use(apiLimiter);

// Serve frontend static assets if built
if (hasFrontendBuild) {
    app.use(express.static(frontendDistPath, {
        index: false,
        maxAge: '1h',
    }));

    // Intercept browser page navigation for paths that overlap with API prefixes (/admin and /properties)
    app.use((req, res, next) => {
        if (isPageRequest(req)) {
            // Exclude API sub-endpoints
            const isApiSpecific = req.path.endsWith('/rating') || req.path.includes('/unavailable-dates') || req.path.endsWith('/duplicate');
            if (!isApiSpecific) {
                return res.sendFile(indexHtmlPath);
            }
        }
        next();
    });
}

// ROUTES  
app.use('/auth', authRoutes);
app.use('/properties', listingRoutes);
app.use('/bookings', bookingRoutes);
app.use('/users', userRoutes);
app.use('/reviews', reviewRoutes);
app.use('/messages', messageRoutes);
app.use('/notifications', notificationRoutes);
app.use('/admin', adminRoutes);
app.use('/config', configRoutes);
app.use('/support', supportRoutes);

// SPA Fallback for all valid frontend routes
if (hasFrontendBuild) {
    app.use((req, res, next) => {
        // Exclude API prefixes
        const apiPrefixes = ['/auth', '/bookings', '/users', '/reviews', '/messages', '/notifications', '/config', '/support', '/api'];
        if (apiPrefixes.some(prefix => req.path.startsWith(prefix))) {
            return next();
        }

        // Exclude static assets with extensions or uploads/public/assets
        if (path.extname(req.path) || req.path.startsWith('/uploads') || req.path.startsWith('/public') || req.path.startsWith('/assets')) {
            return next();
        }

        // Must be a GET request and must be a page navigation request
        if (req.method === 'GET' && isPageRequest(req)) {
            return res.sendFile(indexHtmlPath);
        }
        next();
    });
}

// 404 Handler for unmatched API routes and missing assets
app.use((req, res) => {
    if (hasFrontendBuild && req.method === 'GET' && isPageRequest(req)) {
        return res.sendFile(indexHtmlPath);
    }
    res.status(404).json({ message: 'Not Found' });
});

// Mongoose Connection
mongoose.
    connect(process.env.MONGO_URI, { dbName: 'Meetora' })
    .then(() => {
        app.listen(PORT, async () => {
            console.log(`MongoDB connected and Server port is ${PORT}`);

            // Clean up duplicate bookings in the database if any exist
            try {
                const Booking = require('./models/Booking.model');
                const bookings = await Booking.find({});
                const seen = new Set();
                const duplicates = [];

                for (const booking of bookings) {
                    if (!booking.customerId || !booking.listingId || !booking.startDate || !booking.endDate) continue;
                    const key = `${booking.customerId.toString()}_${booking.listingId.toString()}_${new Date(booking.startDate).toDateString()}_${new Date(booking.endDate).toDateString()}`;

                    if (seen.has(key)) {
                        duplicates.push(booking._id);
                    } else {
                        seen.add(key);
                    }
                }

                if (duplicates.length > 0) {
                    await Booking.deleteMany({ _id: { $in: duplicates } });
                }
            } catch (err) {
                console.error("Failed to run duplicate booking cleanup:", err);
            }

            // Migrate dealer role to host role
            try {
                const User = require('./models/User.model');
                const migrationResult = await User.updateMany({ role: "dealer" }, { $set: { role: "host" } });
                if (migrationResult.modifiedCount > 0) {
                    console.log(`Successfully migrated ${migrationResult.modifiedCount} users from dealer to host role.`);
                }
            } catch (err) {
                console.error("Failed to run role migration:", err);
            }

            // Seed / Sync Admin User
            try {
                const User = require('./models/User.model');
                const bcrypt = require('bcryptjs');
                const adminEmail = process.env.ADMIN_EMAIL || 'meetora@gmail.com';
                const adminPassword = process.env.ADMIN_PASSWORD;
                const adminExists = await User.findOne({ email: adminEmail });
                if (!adminExists && adminPassword) {
                    const salt = await bcrypt.genSalt(10);
                    const hashedPassword = await bcrypt.hash(adminPassword, salt);
                    const newAdmin = new User({
                        firstName: 'Meetora',
                        lastName: '',
                        email: adminEmail,
                        password: hashedPassword,
                        role: 'admin',
                        isVerified: true,
                        profileImagePath: ''
                    });
                    await newAdmin.save();
                    console.log("Admin user seeded successfully.");
                } else if (adminExists) {
                    let changed = false;
                    if (adminExists.role !== 'admin') {
                        adminExists.role = 'admin';
                        changed = true;
                    }
                    if (adminExists.firstName !== 'Meetora' || adminExists.lastName !== '') {
                        adminExists.firstName = 'Meetora';
                        adminExists.lastName = '';
                        changed = true;
                    }
                    if (changed) {
                        await adminExists.save();
                        console.log("Admin profile synced to Meetora (read-only).");
                    }
                }
            } catch (err) {
                console.error("Failed to seed admin user:", err);
            }

            try {
                const Coupon = require('./models/Coupon.model');
                const deleted = await Coupon.deleteMany({ code: 'DREAM20' });
                if (deleted.deletedCount > 0) {
                    console.log(`Cleaned up ${deleted.deletedCount} pre-existing coupons.`);
                }
            } catch (err) {
                console.error("Failed to run coupon cleanup:", err);
            }
        })
    })
    .catch((err) => console.log(`${err} did not connect`));
