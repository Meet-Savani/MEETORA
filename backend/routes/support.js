const router = require('express').Router();
const Report = require('../models/Report.model');
const { authenticate } = require('../middleware/auth');
const { uploadToCloudinary } = require('../utils/cloudinary');

// 1. Submit a report (flag listing, review, host, or guest)
router.post('/reports', authenticate, async (req, res) => {
    try {
        let { targetType, targetId, reason, description, screenshot } = req.body;
        if (!targetType || !targetId || !reason) {
            return res.status(400).json({ message: "Target type, target ID, and reason are required." });
        }

        // Normalize aliases
        if (targetType === 'property') targetType = 'listing';
        if (targetType === 'user') targetType = 'host';

        if (!['listing', 'review', 'host', 'guest'].includes(targetType)) {
            return res.status(400).json({ message: "Invalid target type. Must be listing, review, host, or guest." });
        }

        let imagePath = "";
        if (screenshot && typeof screenshot === 'string' && screenshot.trim().length > 0) {
            imagePath = await uploadToCloudinary(screenshot, 'dream_home/reports');
        }

        const report = new Report({
            reporterId: req.user._id,
            targetType,
            targetId,
            reason,
            description,
            imagePath,
            status: 'pending'
        });
        await report.save();

        return res.status(201).json({ report, message: "Report submitted successfully. Thank you for your feedback." });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error.message || "Internal Server Error", error: error.message });
    }
});

module.exports = router;
