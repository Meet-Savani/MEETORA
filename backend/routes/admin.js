const router = require('express').Router();
const User = require('../models/User.model');
const Listing = require('../models/Listing.model');
const Booking = require('../models/Booking.model');
const Notification = require('../models/Notification.model');
const Review = require('../models/Review.model');
const AuditLog = require('../models/AuditLog.model');
const Settings = require('../models/Settings.model');
const Coupon = require('../models/Coupon.model');
const Report = require('../models/Report.model');
const SupportTicket = require('../models/SupportTicket.model');
const { autoCompleteBookings } = require('../utils/bookingHelper');
const { authenticate } = require('../middleware/auth');
const { isAdmin } = require('../middleware/authorize');
const { logAdminAction } = require('../middleware/auditLog');

router.use(authenticate, isAdmin);

// 1. Get Analytics & Statistics
router.get("/stats", async (req, res) => {
    try {
        await autoCompleteBookings();
        const totalUsers = await User.countDocuments({ role: "user" });
        const totalHosts = await User.countDocuments({ role: "host" });
        const totalAdmins = await User.countDocuments({ role: "admin" });
        const userRoleStats = [
            { name: "Users", value: totalUsers },
            { name: "Hosts", value: totalHosts },
            { name: "Admins", value: totalAdmins }
        ];
        const uniqueCreators = await Listing.distinct("creator");
        const activeHostsCount = uniqueCreators.length;
        const totalProperties = await Listing.countDocuments({});

        // Calculate Revenue Analytics
        const bookings = await Booking.find({ status: { $nin: ["cancelled", "rejected"] } });
        const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
        const hostFeesCollected = bookings.reduce((sum, b) => sum + (b.hostFeeAmount || Math.round((b.totalPrice || 0) * 0.03)), 0);
        const netIncome = totalRevenue - hostFeesCollected;

        // Group revenue by category for charts
        const properties = await Listing.find({});
        const categoryMap = {};
        for (const booking of bookings) {
            const listing = properties.find(p => p._id.toString() === booking.listingId?.toString());
            const cat = listing ? listing.category : "Other";
            categoryMap[cat] = (categoryMap[cat] || 0) + (booking.totalPrice || 0);
        }

        const categoryStats = Object.keys(categoryMap).map(name => ({
            name,
            value: categoryMap[name]
        }));

        // Monthly Booking counts
        const monthlyStats = Array(12).fill(0).map((_, i) => ({ month: new Date(2026, i, 1).toLocaleString('default', { month: 'short' }), bookings: 0, revenue: 0, netRevenue: 0 }));
        for (const b of bookings) {
            const date = b.createdAt ? new Date(b.createdAt) : new Date();
            const m = isNaN(date.getMonth()) ? 0 : date.getMonth();
            monthlyStats[m].bookings += 1;
            monthlyStats[m].revenue += (b.totalPrice || 0);
            monthlyStats[m].netRevenue += ((b.totalPrice || 0) - (b.hostFeeAmount || Math.round((b.totalPrice || 0) * 0.03)));
        }

        const allBookings = await Booking.find({});
        const bookingStatusMap = { pending: 0, accepted: 0, rejected: 0, cancelled: 0, completed: 0 };
        for (const b of allBookings) {
            if (bookingStatusMap[b.status] !== undefined) {
                bookingStatusMap[b.status]++;
            }
        }
        const bookingStatusStats = Object.keys(bookingStatusMap).map(status => ({ name: status.toUpperCase(), value: bookingStatusMap[status] }));

        const propertyStatusMap = { pending: 0, approved: 0, rejected: 0, paused: 0 };
        const propertyTypeMap = {};
        const propertyCategoryMap = {};
        for (const p of properties) {
            const status = p.isApproved || 'pending';
            if (propertyStatusMap[status] !== undefined) {
                propertyStatusMap[status]++;
            }
            const pType = p.type || 'Other';
            propertyTypeMap[pType] = (propertyTypeMap[pType] || 0) + 1;

            const pCat = p.category || 'Other';
            propertyCategoryMap[pCat] = (propertyCategoryMap[pCat] || 0) + 1;
        }
        const propertyStatusStats = Object.keys(propertyStatusMap).map(status => ({ name: status.toUpperCase(), value: propertyStatusMap[status] }));
        const propertyTypeStats = Object.keys(propertyTypeMap).map(type => ({ name: type, value: propertyTypeMap[type] }));
        const propertyCategoryStats = Object.keys(propertyCategoryMap).map(cat => ({ name: cat, value: propertyCategoryMap[cat] }));

        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

        const calcGrowth = (current, previous) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return Math.round(((current - previous) / previous) * 1000) / 10;
        };

        const usersThisWeek = await User.countDocuments({ role: 'user', createdAt: { $gte: weekAgo } });
        const usersLastWeek = await User.countDocuments({ role: 'user', createdAt: { $gte: twoWeeksAgo, $lt: weekAgo } });
        const hostsThisWeek = await User.countDocuments({ role: 'host', createdAt: { $gte: weekAgo } });
        const hostsLastWeek = await User.countDocuments({ role: 'host', createdAt: { $gte: twoWeeksAgo, $lt: weekAgo } });
        const propsThisWeek = await Listing.countDocuments({ createdAt: { $gte: weekAgo } });
        const propsLastWeek = await Listing.countDocuments({ createdAt: { $gte: twoWeeksAgo, $lt: weekAgo } });

        const bookingsThisWeek = bookings.filter(b => b.createdAt && new Date(b.createdAt) >= weekAgo);
        const bookingsLastWeek = bookings.filter(b => {
            if (!b.createdAt) return false;
            const d = new Date(b.createdAt);
            return d >= twoWeeksAgo && d < weekAgo;
        });
        const revenueThisWeek = bookingsThisWeek.reduce((s, b) => s + (b.totalPrice || 0), 0);
        const revenueLastWeek = bookingsLastWeek.reduce((s, b) => s + (b.totalPrice || 0), 0);

        const usersThisMonth = await User.countDocuments({ role: 'user', createdAt: { $gte: monthAgo } });
        const usersLastMonth = await User.countDocuments({ role: 'user', createdAt: { $gte: twoMonthsAgo, $lt: monthAgo } });

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

        const bookingsToday = bookings.filter(b => b.createdAt && new Date(b.createdAt) >= todayStart);
        const bookingsYesterday = bookings.filter(b => b.createdAt && new Date(b.createdAt) >= yesterdayStart && new Date(b.createdAt) < todayStart);

        const revenueToday = bookingsToday.reduce((s, b) => s + (b.totalPrice || 0), 0);
        const revenueYesterday = bookingsYesterday.reduce((s, b) => s + (b.totalPrice || 0), 0);

        const netIncomeThisWeek = bookingsThisWeek.reduce((s, b) => s + ((b.totalPrice || 0) - (b.hostFeeAmount || Math.round((b.totalPrice || 0) * 0.03))), 0);
        const netIncomeLastWeek = bookingsLastWeek.reduce((s, b) => s + ((b.totalPrice || 0) - (b.hostFeeAmount || Math.round((b.totalPrice || 0) * 0.03))), 0);

        const growthStats = {
            users: { weekly: calcGrowth(usersThisWeek, usersLastWeek), monthly: calcGrowth(usersThisMonth, usersLastMonth), thisWeek: usersThisWeek },
            hosts: { weekly: calcGrowth(hostsThisWeek, hostsLastWeek), thisWeek: hostsThisWeek },
            properties: { weekly: calcGrowth(propsThisWeek, propsLastWeek), thisWeek: propsThisWeek },
            revenue: { weekly: calcGrowth(revenueThisWeek, revenueLastWeek), thisWeek: revenueThisWeek, lastWeek: revenueLastWeek },
            bookings: { weekly: calcGrowth(bookingsThisWeek.length, bookingsLastWeek.length), thisWeek: bookingsThisWeek.length },
            todayRevenue: { daily: calcGrowth(revenueToday, revenueYesterday) },
            todayBookings: { daily: calcGrowth(bookingsToday.length, bookingsYesterday.length) },
            netIncome: { weekly: calcGrowth(netIncomeThisWeek, netIncomeLastWeek) }
        };

        const todayBookings = await Booking.countDocuments({ createdAt: { $gte: todayStart }, status: { $nin: ['cancelled', 'rejected'] } });
        const todayUsers = await User.countDocuments({ createdAt: { $gte: todayStart } });
        const todayHosts = await User.countDocuments({ role: 'host', createdAt: { $gte: todayStart } });
        const todayRevenueBookings = await Booking.find({ createdAt: { $gte: todayStart }, status: { $nin: ['cancelled', 'rejected'] } });
        const todayRevenue = todayRevenueBookings.reduce((s, b) => s + (b.totalPrice || 0), 0);
        const pendingApprovals = await Listing.countDocuments({ isApproved: 'pending' });

        return res.status(200).json({
            stats: {
                totalUsers,
                totalHosts,
                totalProperties,
                totalRevenue,
                hostFeesCollected,
                netIncome,
                todayRevenue,
                todayBookings,
                todayUsers,
                todayHosts,
                pendingApprovals,
            },
            growthStats,
            categoryStats,
            userRoleStats,
            monthlyStats,
            bookingStatusStats,
            propertyStatusStats,
            propertyTypeStats,
            propertyCategoryStats
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// 2. Get Users List
router.get("/users", async (req, res) => {
    try {
        const users = await User.find({}).select("-password");
        return res.status(200).json({ users });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// 3. Update User Role (User <-> Host only) - Admin Panel Exclusive
router.patch("/users/:userId/role", logAdminAction('UPDATE_USER_ROLE', 'user'), async (req, res) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;

        if (role === 'admin') {
            return res.status(400).json({ 
                message: "Security restriction: Meetora operates with a single platform administrator whose credentials are configured strictly in .env. No other users can be granted the administrator role." 
            });
        }

        const validRoles = ["user", "host"];
        if (!role || !validRoles.includes(role)) {
            return res.status(400).json({ 
                message: `Invalid role. Allowed roles are: ${validRoles.join(", ")}.` 
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        // Primary admin cannot be modified
        if (user.role === 'admin' || user._id.toString() === req.user._id.toString()) {
            return res.status(400).json({ 
                message: "Security restriction: The primary administrator account cannot be modified." 
            });
        }

        const previousRole = user.role;
        if (previousRole === role) {
            return res.status(200).json({ 
                user, 
                message: `User is already assigned the '${role}' role.` 
            });
        }

        user.role = role;

        // Synchronize host application status
        if (role === "host") {
            user.hostRequestStatus = "approved";
        } else {
            user.hostRequestStatus = "none";
        }

        await user.save();

        // Craft tailored notification
        let notifTitle = "Account Role Updated";
        let notifMessage = `Your account role has been updated to '${role}' by the administrator.`;
        let notifType = "system";

        if (role === "host") {
            notifTitle = "You are now a Host!";
            notifMessage = "Congratulations! You have been granted Host status by the administrator and can now list properties.";
            notifType = "promo";
        } else if (role === "user" && previousRole === "host") {
            notifTitle = "Host Status Updated";
            notifMessage = "Your account has been switched from Host to regular User by the administrator.";
            notifType = "system";
        }

        await Notification.create({
            userId: user._id,
            title: notifTitle,
            message: notifMessage,
            type: notifType
        });

        const userObj = user.toObject();
        delete userObj.password;

        return res.status(200).json({ 
            user: userObj, 
            message: `User role successfully changed from '${previousRole}' to '${role}'.` 
        });
    } catch (error) {
        console.error("Error updating user role:", error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// 3b. Toggle User Host Role (legacy verify endpoint backward-compatibility)
router.patch("/users/:userId/verify", logAdminAction('TOGGLE_USER_ROLE', 'user'), async (req, res) => {
    try {
        const { userId } = req.params;
        const targetRole = req.body?.role;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        // If target role is explicitly provided, validate and apply
        if (targetRole && ["user", "host", "admin"].includes(targetRole)) {
            if (user._id.toString() === req.user._id.toString() && targetRole !== 'admin') {
                return res.status(400).json({ message: "Security restriction: You cannot demote your own admin account." });
            }
            user.role = targetRole;
            user.hostRequestStatus = targetRole === 'host' ? 'approved' : 'none';
        } else {
            // Otherwise toggle between host and user
            if (user.role === "host") {
                user.role = "user";
                user.hostRequestStatus = "none";
            } else {
                user.role = "host";
                user.hostRequestStatus = "approved";
            }
        }

        await user.save();

        await Notification.create({
            userId: user._id,
            title: user.role === "host" ? "You are now a Host!" : "Account Role Updated",
            message: user.role === "host"
                ? "Congratulations! You have been promoted to Host status by the administrator."
                : "Your account role has been updated to User by the administrator.",
            type: user.role === "host" ? "promo" : "system"
        });

        const userObj = user.toObject();
        delete userObj.password;

        return res.status(200).json({ 
            user: userObj, 
            message: `User role updated to '${user.role}' successfully.` 
        });
    } catch (error) {
        console.error("Error toggling user role:", error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// 4. Get Properties List
router.get("/properties", async (req, res) => {
    try {
        const properties = await Listing.find({}).populate("creator");
        return res.status(200).json({ properties });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// 5. Approve / Reject Property
router.patch("/properties/:listingId/approve", logAdminAction('PROPERTY_MODERATION', 'listing'), async (req, res) => {
    try {
        const { listingId } = req.params;
        const { action } = req.body; // "approved" or "rejected"

        if (!["approved", "rejected", "paused", "suspended"].includes(action || "")) {
            return res.status(400).json({ message: "Action must be approved, rejected, paused, or suspended." });
        }

        const listing = await Listing.findById(listingId);
        if (!listing) {
            return res.status(404).json({ message: "Listing not found." });
        }

        listing.isApproved = action;
        await listing.save();

        // Notify Creator
        await Notification.create({
            userId: listing.creator,
            title: `Property ${action ? action.charAt(0).toUpperCase() + action.slice(1) : ""}`,
            message: `Your property listing "${listing.title}" was ${action} by the administrator.`,
            type: "booking"
        });

        return res.status(200).json({ listing, message: `Property state updated to ${action}.` });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// 6. Toggle Featured Status
router.patch("/properties/:listingId/feature", logAdminAction('TOGGLE_FEATURED', 'listing'), async (req, res) => {
    try {
        const { listingId } = req.params;
        const listing = await Listing.findById(listingId);
        if (!listing) {
            return res.status(404).json({ message: "Listing not found." });
        }

        listing.isFeatured = !listing.isFeatured;
        await listing.save();

        return res.status(200).json({ listing, message: `Listing featured toggled to ${listing.isFeatured}` });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// 7. Get All Reservations / Bookings
router.get("/bookings", async (req, res) => {
    try {
        await autoCompleteBookings();
        const bookings = await Booking.find({}).populate("customerId hostId listingId");
        const bookingIds = bookings.map(b => b._id);
        const reviews = await Review.find({ bookingId: { $in: bookingIds } });
        const bookingsWithReviews = bookings.map(booking => {
            const bObj = booking.toObject();
            bObj.guestReview = reviews.find(r => r.bookingId?.toString() === booking._id.toString() && r.reviewerType === "guest") || null;
            bObj.hostReview = reviews.find(r => r.bookingId?.toString() === booking._id.toString() && r.reviewerType === "host") || null;
            return bObj;
        });
        return res.status(200).json({ bookings: bookingsWithReviews });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// 8. Admin Refund Booking
router.patch("/bookings/:bookingId/refund", logAdminAction('REFUND', 'booking'), async (req, res) => {
    try {
        await autoCompleteBookings();
        const { bookingId } = req.params;
        const booking = await Booking.findById(bookingId).populate("listingId customerId");
        if (!booking) {
            return res.status(404).json({ message: "Booking not found." });
        }

        if (booking.status === "completed") {
            return res.status(400).json({ message: "Completed bookings cannot be refunded or cancelled." });
        }

        const end = new Date(booking.endDate);
        end.setHours(23, 59, 59, 999);
        if (new Date() > end) {
            booking.status = "completed";
            await booking.save();
            return res.status(400).json({ message: "Trip stay has already concluded. Cancellation and refund are not permitted." });
        }

        booking.status = "cancelled";
        // CRITICAL: Preserve original cancellation role. Never overwrite if already cancelled by guest or host!
        if (!booking.cancelledBy) {
            booking.cancelledBy = "admin";
        }
        await booking.save();

        // Notify Guest
        await Notification.create({
            userId: booking.customerId._id,
            title: "Dispute Settled: Refund Issued",
            message: `An administrator has resolved a dispute and issued a full refund of $${booking.totalPrice} for your booking at ${booking.listingId?.title}.`,
            type: "payment"
        });

        // Notify Host
        await Notification.create({
            userId: booking.hostId,
            title: "Booking Refunded by Administrator",
            message: `The booking for ${booking.listingId?.title} from ${booking.startDate} to ${booking.endDate} has been refunded by administration.`,
            type: "booking"
        });

        return res.status(200).json({ booking, message: "Booking successfully cancelled and refunded by admin." });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// 9. Get Platform Settings
router.get("/settings", async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings({ platformFeePercent: 5, hostFeePercent: 3, guestFeePercent: 0 });
            await settings.save();
        }
        return res.status(200).json({ settings });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// 10. Update Platform Settings
router.put("/settings", logAdminAction('UPDATE_SETTINGS', 'settings'), async (req, res) => {
    try {
        const { platformFeePercent, hostFeePercent, guestFeePercent } = req.body;
        
        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings();
        }
        
        if (platformFeePercent !== undefined) settings.platformFeePercent = platformFeePercent;
        if (hostFeePercent !== undefined) settings.hostFeePercent = hostFeePercent;
        if (guestFeePercent !== undefined) settings.guestFeePercent = guestFeePercent;
        
        await settings.save();
        return res.status(200).json({ settings, message: "Settings updated successfully." });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// 11. Get Coupons
router.get("/coupons", async (req, res) => {
    try {
        // Auto-deactivate any coupons whose quantity/usage limit has been filled up
        await Coupon.updateMany(
            {
                usageLimit: { $ne: null },
                $expr: { $gte: ["$usageCount", "$usageLimit"] },
                isActive: true
            },
            { $set: { isActive: false } }
        );

        const coupons = await Coupon.find({}).sort({ createdAt: -1 });
        return res.status(200).json({ coupons });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// 12. Create Coupon
router.post("/coupons", logAdminAction('CREATE_COUPON', 'coupon'), async (req, res) => {
    try {
        const { code, discountType, discountValue, startDate, endDate, isActive, usageLimit } = req.body;
        if (!code || !discountType || discountValue === undefined || !startDate || !endDate) {
            return res.status(400).json({ message: "All coupon fields are required." });
        }

        let parsedLimit = null;
        if (usageLimit !== undefined && usageLimit !== null && usageLimit !== "") {
            parsedLimit = Number(usageLimit);
            if (isNaN(parsedLimit) || !Number.isInteger(parsedLimit) || parsedLimit <= 0) {
                return res.status(400).json({ message: "Coupon quantity must be a positive integer (minimum 1)." });
            }
            if (parsedLimit > 100) {
                return res.status(400).json({ message: "Coupon quantity cannot exceed 100. Maximum allowed is 100." });
            }
        }
        
        const existing = await Coupon.findOne({ code: code.toUpperCase() });
        if (existing) {
            return res.status(400).json({ message: "A coupon with this code already exists." });
        }
        
        const coupon = new Coupon({
            code: code.toUpperCase(),
            discountType,
            discountValue: parseFloat(discountValue),
            startDate,
            endDate,
            isActive: isActive !== undefined ? isActive : true,
            usageLimit: parsedLimit,
            usageCount: 0
        });
        await coupon.save();
        return res.status(201).json({ coupon, message: "Coupon created successfully." });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// 13. Update Coupon
router.put("/coupons/:couponId", logAdminAction('UPDATE_COUPON', 'coupon'), async (req, res) => {
    try {
        const { couponId } = req.params;
        const { code, discountType, discountValue, startDate, endDate, isActive, usageLimit } = req.body;
        
        const coupon = await Coupon.findById(couponId);
        if (!coupon) {
            return res.status(404).json({ message: "Coupon not found." });
        }
        
        if (code !== undefined) {
            const upperCode = String(code).trim().toUpperCase();
            if (upperCode !== coupon.code) {
                const existing = await Coupon.findOne({ code: upperCode });
                if (existing) {
                    return res.status(400).json({ message: "A coupon with this code already exists." });
                }
            }
            coupon.code = upperCode;
        }
        if (discountType !== undefined) coupon.discountType = discountType;
        if (discountValue !== undefined) coupon.discountValue = parseFloat(discountValue);
        if (startDate !== undefined) coupon.startDate = startDate;
        if (endDate !== undefined) coupon.endDate = endDate;
        if (isActive !== undefined) coupon.isActive = Boolean(isActive);
        if (usageLimit !== undefined) {
            if (usageLimit === null || usageLimit === "") {
                coupon.usageLimit = null;
            } else {
                const parsedLimit = Number(usageLimit);
                if (isNaN(parsedLimit) || !Number.isInteger(parsedLimit) || parsedLimit <= 0) {
                    return res.status(400).json({ message: "Coupon quantity must be a positive integer (minimum 1)." });
                }
                if (parsedLimit > 100) {
                    return res.status(400).json({ message: "Coupon quantity cannot exceed 100. Maximum allowed is 100." });
                }
                coupon.usageLimit = parsedLimit;
            }
        }
        
        if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
            coupon.isActive = false;
        }

        await coupon.save();
        return res.status(200).json({ coupon, message: "Coupon updated successfully." });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// 14. Delete Coupon
router.delete("/coupons/:couponId", logAdminAction('DELETE_COUPON', 'coupon'), async (req, res) => {
    try {
        const { couponId } = req.params;
        const coupon = await Coupon.findByIdAndDelete(couponId);
        if (!coupon) {
            return res.status(404).json({ message: "Coupon not found." });
        }
        return res.status(200).json({ message: "Coupon deleted successfully." });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// 15. Get Reports
router.get("/reports", async (req, res) => {
    try {
        const reports = await Report.find({})
            .populate("reporterId", "firstName lastName email")
            .sort({ createdAt: -1 });
            
        const reportsWithTargets = [];
        for (const report of reports) {
            const reportObj = report.toObject();
            if (report.targetType === 'listing') {
                reportObj.target = await Listing.findById(report.targetId).populate("creator", "firstName lastName email");
            } else if (report.targetType === 'review') {
                reportObj.target = await Review.findById(report.targetId).populate("customerId", "firstName lastName email");
            } else if (report.targetType === 'host' || report.targetType === 'guest') {
                reportObj.target = await User.findById(report.targetId).select("firstName lastName email phone bio");
            }
            reportsWithTargets.push(reportObj);
        }
        
        return res.status(200).json({ reports: reportsWithTargets });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// 16. Update Report Status
router.patch("/reports/:reportId", logAdminAction('RESOLVE_REPORT', 'report'), async (req, res) => {
    try {
        const { reportId } = req.params;
        const { status } = req.body;
        
        if (!['resolved', 'dismissed'].includes(status)) {
            return res.status(400).json({ message: "Status must be resolved or dismissed." });
        }
        
        const report = await Report.findById(reportId);
        if (!report) {
            return res.status(404).json({ message: "Report not found." });
        }
        
        report.status = status;
        await report.save();
        return res.status(200).json({ report, message: `Report updated to ${status}.` });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// 17. Get Host Requests
router.get("/host-requests", async (req, res) => {
    try {
        const requests = await User.find({ hostRequestStatus: "pending" }).select("-password");
        return res.status(200).json({ requests });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// 18. Approve Host Request
router.patch("/users/:userId/approve-host", logAdminAction('PROMOTE_HOST', 'user'), async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        user.role = "host";
        user.hostRequestStatus = "approved";
        await user.save();

        await Notification.create({
            userId: user._id,
            title: "Host Application Approved!",
            message: "Congratulations! Your application to become a Host has been approved. You can now start hosting your listings.",
            type: "promo"
        });

        return res.status(200).json({ user, message: "Host application approved successfully." });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// 19. Reject Host Request
router.patch("/users/:userId/reject-host", logAdminAction('REJECT_HOST', 'user'), async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        user.hostRequestStatus = "rejected";
        await user.save();

        await Notification.create({
            userId: user._id,
            title: "Host Application Rejected",
            message: "We regret to inform you that your application to become a Host was not approved at this time.",
            type: "promo"
        });

        return res.status(200).json({ user, message: "Host application rejected." });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// 20. Get All Reviews
router.get("/reviews", async (req, res) => {
    try {
        const reviews = await Review.find({})
            .populate("listingId", "title listingPhotoPaths city province country category type price")
            .populate("customerId", "firstName lastName email profileImagePath")
            .populate("hostId", "firstName lastName email")
            .sort({ createdAt: -1 });
        return res.status(200).json({ reviews });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// 21. Review Moderation (Protected - Author Only Can Edit/Delete)
router.delete("/reviews/:reviewId", async (req, res) => {
    return res.status(403).json({ 
        message: "Protected review: Admins and owners can only read reviews. Only the guest who authored the review can edit or delete it." 
    });
});

module.exports = router;
