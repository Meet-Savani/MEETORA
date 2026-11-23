const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

const extractToken = (req) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }
    return null;
};

const authenticate = async (req, res, next) => {
    try {
        const token = extractToken(req);
        if (!token) {
            return res.status(401).json({ message: 'Authentication required. Please log in.' });
        }

        if (!process.env.JWT_SECRET_KEY) {
            return res.status(500).json({ message: 'Server authentication is not configured.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return res.status(401).json({ message: 'User account no longer exists.' });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Session expired. Please log in again.' });
        }
        return res.status(401).json({ message: 'Invalid authentication token.' });
    }
};

const optionalAuth = async (req, res, next) => {
    try {
        const token = extractToken(req);
        if (!token || !process.env.JWT_SECRET_KEY) {
            return next();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        const user = await User.findById(decoded.id).select('-password');
        if (user) {
            req.user = user;
        }
        next();
    } catch {
        next();
    }
};

module.exports = { authenticate, optionalAuth };
