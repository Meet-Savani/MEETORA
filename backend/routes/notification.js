const router = require('express').Router();
const Notification = require('../models/Notification.model');
const { authenticate } = require('../middleware/auth');
const { isSelf, isAdmin, isNotificationOwner } = require('../middleware/authorize');

router.get("/:userId", authenticate, isSelf('userId'), async (req, res) => {
    try {
        const { userId } = req.params;
        const notifications = await Notification.find({ userId }).sort({ createdAt: -1 });
        return res.status(200).json({ notifications });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

router.patch("/:userId/mark-read", authenticate, isSelf('userId'), async (req, res) => {
    try {
        const { userId } = req.params;
        await Notification.updateMany({ userId, isRead: false }, { isRead: true });
        return res.status(200).json({ message: "Notifications marked as read." });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

router.post("/broadcast", authenticate, isAdmin, async (req, res) => {
    try {
        const { title, message } = req.body;
        if (!title || !message) {
            return res.status(400).json({ message: "Title and message are required." });
        }

        const User = require('../models/User.model');
        const users = await User.find({});

        const notifs = users.map(user => ({
            userId: user._id,
            title,
            message,
            type: "promo"
        }));

        await Notification.insertMany(notifs);

        return res.status(200).json({ message: "Promotion broadcasted to all users!" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

router.delete("/:notifId", authenticate, isNotificationOwner, async (req, res) => {
    try {
        const { notifId } = req.params;
        await Notification.findByIdAndDelete(notifId);
        return res.status(200).json({ message: "Notification deleted successfully." });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

module.exports = router;
