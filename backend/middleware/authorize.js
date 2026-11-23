const Listing = require('../models/Listing.model');
const Booking = require('../models/Booking.model');
const Notification = require('../models/Notification.model');

const authorize = (...roles) => (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required.' });
    }
    if (roles.length > 0 && !roles.includes(req.user.role)) {
        return res.status(403).json({ message: 'You do not have permission to perform this action.' });
    }
    next();
};

const isAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required.' });
    }
    next();
};

const isSelf = (paramName = 'userId') => (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required.' });
    }
    if (req.user.role === 'admin') {
        return next();
    }
    const targetId = req.params[paramName] || req.body[paramName];
    if (!targetId || targetId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied. You can only access your own data.' });
    }
    next();
};

const isListingOwner = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required.' });
        }
        if (req.user.role === 'admin') {
            return next();
        }

        const listingId = req.params.listingId;
        const listing = await Listing.findById(listingId);
        if (!listing) {
            return res.status(404).json({ message: 'Listing not found.' });
        }
        if (listing.creator.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'You can only manage your own properties.' });
        }
        req.listing = listing;
        next();
    } catch (error) {
        return res.status(500).json({ message: 'Authorization check failed.', error: error.message });
    }
};

const isBookingParticipant = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required.' });
        }
        if (req.user.role === 'admin') {
            return next();
        }

        const booking = await Booking.findById(req.params.bookingId);
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found.' });
        }

        const userId = req.user._id.toString();
        const isCustomer = booking.customerId.toString() === userId;
        const isHost = booking.hostId.toString() === userId;

        if (!isCustomer && !isHost) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        req.booking = booking;
        req.isBookingCustomer = isCustomer;
        req.isBookingHost = isHost;
        next();
    } catch (error) {
        return res.status(500).json({ message: 'Authorization check failed.', error: error.message });
    }
};

const isBookingCustomer = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required.' });
        }
        if (req.user.role === 'admin') {
            return next();
        }

        const booking = await Booking.findById(req.params.bookingId);
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found.' });
        }
        if (booking.customerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Only the guest can perform this action.' });
        }
        req.booking = booking;
        next();
    } catch (error) {
        return res.status(500).json({ message: 'Authorization check failed.', error: error.message });
    }
};

const isBookingHost = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required.' });
        }
        if (req.user.role === 'admin') {
            return next();
        }

        const booking = await Booking.findById(req.params.bookingId);
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found.' });
        }
        if (booking.hostId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Only the host can perform this action.' });
        }
        req.booking = booking;
        next();
    } catch (error) {
        return res.status(500).json({ message: 'Authorization check failed.', error: error.message });
    }
};

const isMessageParticipant = (paramName) => async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required.' });
        }
        if (req.user.role === 'admin') {
            return next();
        }

        const userId = req.params[paramName];
        if (userId !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Access denied.' });
        }
        next();
    } catch (error) {
        return res.status(500).json({ message: 'Authorization check failed.', error: error.message });
    }
};

const isNotificationOwner = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required.' });
        }
        if (req.user.role === 'admin') {
            return next();
        }

        const notification = await Notification.findById(req.params.notifId);
        if (!notification) {
            return res.status(404).json({ message: 'Notification not found.' });
        }
        if (notification.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Access denied.' });
        }
        next();
    } catch (error) {
        return res.status(500).json({ message: 'Authorization check failed.', error: error.message });
    }
};

module.exports = {
    authorize,
    isAdmin,
    isSelf,
    isListingOwner,
    isBookingParticipant,
    isBookingCustomer,
    isBookingHost,
    isMessageParticipant,
    isNotificationOwner,
};
