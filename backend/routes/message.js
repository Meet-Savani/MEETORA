const router = require('express').Router();
const Message = require('../models/Message.model');
const fs = require('fs');
const mongoose = require('mongoose');
const { authenticate } = require('../middleware/auth');
const { isMessageParticipant } = require('../middleware/authorize');
const { uploadToCloudinary } = require('../utils/cloudinary');

router.post('/create', authenticate, async (req, res) => {
    try {
        const { receiverId, bookingId, text, image, fileName: origName, fileType: incomingFileType } = req.body;
        const senderId = req.user._id.toString();

        if (!receiverId) {
            return res.status(400).json({ error: "Receiver is required." });
        }

        let fileType = incomingFileType || "";
        let fileName = origName || "";
        let imagePath = "";

        if (image && typeof image === 'string' && image.trim().length > 0) {
            imagePath = await uploadToCloudinary(image, 'dream_home/media');
            if (!fileType) {
                fileType = "image";
            }
            if (!fileName) {
                fileName = "uploaded-image";
            }
        }

        let validBookingId = null;
        if (bookingId && mongoose.Types.ObjectId.isValid(bookingId)) {
            validBookingId = bookingId;
        }

        const newMessage = new Message({
            senderId,
            receiverId,
            bookingId: validBookingId,
            text: text || "",
            imagePath,
            fileType,
            fileName,
            deletedForUsers: []
        });

        await newMessage.save();
        res.status(200).json(newMessage);
    } catch (err) {
        console.error("Error creating message:", err);
        res.status(500).json({ error: err.message || "Failed to create message." });
    }
});

router.get("/thread/:user1Id/:user2Id", authenticate, isMessageParticipant('user1Id'), async (req, res) => {
    try {
        const { user1Id, user2Id } = req.params;
        const messages = await Message.find({
            $or: [
                { senderId: user1Id, receiverId: user2Id },
                { senderId: user2Id, receiverId: user1Id }
            ],
            deletedForUsers: { $ne: user1Id }
        })
        .populate("senderId", "firstName lastName profileImagePath")
        .populate("receiverId", "firstName lastName profileImagePath")
        .sort({ createdAt: 1 });

        res.status(200).json({ messages });
    } catch (err) {
        console.error("Error fetching message thread:", err);
        res.status(500).json({ error: "Failed to retrieve thread history." });
    }
});

router.get("/inbox/:userId", authenticate, isMessageParticipant('userId'), async (req, res) => {
    try {
        const { userId } = req.params;

        const messages = await Message.find({
            $or: [{ senderId: userId }, { receiverId: userId }],
            deletedForUsers: { $ne: userId }
        })
        .populate("senderId", "firstName lastName profileImagePath lastActive role")
        .populate("receiverId", "firstName lastName profileImagePath lastActive role")
        .sort({ createdAt: -1 });

        const partnerMap = new Map();

        for (const msg of messages) {
            if (!msg.senderId || !msg.receiverId) continue;

            const senderStr = msg.senderId._id.toString();
            const partner = senderStr === userId ? msg.receiverId : msg.senderId;
            const partnerIdStr = partner._id.toString();

            if (!partnerMap.has(partnerIdStr)) {
                partnerMap.set(partnerIdStr, {
                    partner: partner,
                    lastMessage: {
                        text: msg.text,
                        imagePath: msg.imagePath,
                        fileType: msg.fileType,
                        fileName: msg.fileName,
                        createdAt: msg.createdAt
                    }
                });
            }
        }

        const inbox = Array.from(partnerMap.values());
        res.status(200).json({ inbox });
    } catch (err) {
        console.error("Error fetching inbox:", err);
        res.status(500).json({ error: "Failed to retrieve inbox list." });
    }
});

router.delete("/thread/:userId/:partnerId", authenticate, isMessageParticipant('userId'), async (req, res) => {
    try {
        const { userId, partnerId } = req.params;

        await Message.updateMany(
            {
                $or: [
                    { senderId: userId, receiverId: partnerId },
                    { senderId: partnerId, receiverId: userId }
                ]
            },
            {
                $addToSet: { deletedForUsers: userId }
            }
        );

        res.status(200).json({ message: "Conversation deleted successfully." });
    } catch (err) {
        console.error("Error deleting conversation:", err);
        res.status(500).json({ error: "Failed to delete conversation." });
    }
});

module.exports = router;
