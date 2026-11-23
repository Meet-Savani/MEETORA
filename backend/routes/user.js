const router = require('express').Router();
const mongoose = require('mongoose');
const Booking = require('../models/Booking.model');
const User = require('../models/User.model');
const Listing = require('../models/Listing.model');
const Review = require('../models/Review.model');
const { authenticate } = require('../middleware/auth');
const { isSelf, authorize } = require('../middleware/authorize');
const path = require('path');
const fs = require('fs');
const { autoCompleteBookings } = require('../utils/bookingHelper');
const { uploadToCloudinary } = require('../utils/cloudinary');

router.get("/:userId/trips", authenticate, isSelf('userId'), async (req, res) => {
    try {
        const { userId } = req.params;

        await autoCompleteBookings();

        const trips = await Booking.find({ customerId: userId }).populate("customerId hostId listingId");

        const uniqueTrips = [];
        const seen = new Set();
        for (const trip of trips) {
            if (!trip.customerId || !trip.listingId) continue;
            const key = `${trip.customerId._id.toString()}_${trip.listingId._id.toString()}_${new Date(trip.startDate).toDateString()}_${new Date(trip.endDate).toDateString()}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueTrips.push(trip);
            }
        }

        const bookingIds = uniqueTrips.map(t => t._id);
        const listingIds = uniqueTrips.map(t => t.listingId?._id || t.listingId).filter(Boolean);
        const reviews = await Review.find({
            $or: [
                { bookingId: { $in: bookingIds } },
                { customerId: userId, listingId: { $in: listingIds } }
            ]
        });
        const uniqueTripsWithReviews = uniqueTrips.map(trip => {
            const tripObj = trip.toObject();
            const tripListingIdStr = (trip.listingId?._id || trip.listingId)?.toString();
            tripObj.guestReview = reviews.find(r => 
                r.reviewerType === "guest" && (
                    (r.bookingId && r.bookingId.toString() === trip._id.toString()) ||
                    (!r.bookingId && r.listingId?.toString() === tripListingIdStr)
                )
            ) || null;
            tripObj.hostReview = reviews.find(r => r.bookingId?.toString() === trip._id.toString() && r.reviewerType === "host") || null;
            return tripObj;
        });

        return res.status(200).json({ trips: uniqueTripsWithReviews, message: "Trips details fetched successfully!" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error.message || "Internal Server Error", error: error.message });
    }
});

router.patch("/:userId/update", authenticate, isSelf('userId'), async (req, res) => {
    try {
        const { userId } = req.params;
        const { firstName, lastName, phone, bio, location, profileImage } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.role === 'admin') {
            // Admin name is permanently locked to 'Meetora'
            user.firstName = 'Meetora';
            user.lastName = '';
        } else {
            if (firstName !== undefined) user.firstName = firstName;
            if (lastName !== undefined) user.lastName = lastName;
        }
        if (phone !== undefined) user.phone = phone;
        if (bio !== undefined) user.bio = bio;
        if (location !== undefined) user.location = location;

        if (profileImage && typeof profileImage === 'string' && profileImage.trim().length > 0) {
            user.profileImagePath = await uploadToCloudinary(profileImage, 'dream_home/users');
        }

        await user.save();

        const userObj = user.toObject();
        delete userObj.password;

        return res.status(200).json({ message: "Profile updated successfully!", user: userObj });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error.message || "Internal Server Error", error: error.message });
    }
});

router.patch("/:userId/:listingId", authenticate, isSelf('userId'), async (req, res) => {
    try {
        const { userId, listingId } = req.params;
        const user = await User.findById(userId);
        const listing = await Listing.findById(listingId).populate("creator", "firstName lastName profileImagePath");

        if (!listing) {
            return res.status(404).json({ message: "Listing not found." });
        }

        const creatorId = listing.creator._id ? listing.creator._id.toString() : listing.creator.toString();
        if (creatorId === userId.toString()) {
            return res.status(400).json({ message: "Owners cannot add their own listing to wishlist." });
        }

        const favoriteListing = user.wishList.find((item) => item._id.toString() === listingId);

        if (favoriteListing) {
            user.wishList = user.wishList.filter((item) => item._id.toString() !== listingId);
            await user.save();
            return res.status(200).json({ message: "Listing is removed from wishlist.", wishList: user.wishList });
        }

        user.wishList.push(listing);
        await user.save();
        return res.status(200).json({ message: "Listing is added to wishlist.", wishList: user.wishList });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error.message || "Internal Server Error", error: error.message });
    }
});

router.get("/:userId/properties", authenticate, isSelf('userId'), authorize('host', 'admin'), async (req, res) => {
    try {
        const { userId } = req.params;
        const properties = await Listing.find({ creator: userId }).populate("creator", "firstName lastName profileImagePath").sort({ createdAt: -1 });

        if (properties.length > 0) {
            const propertyIds = properties.map(p => p._id);
            const reviewStats = await Review.aggregate([
                { $match: { listingId: { $in: propertyIds }, reviewerType: "guest" } },
                {
                    $group: {
                        _id: "$listingId",
                        avgRating: { $avg: "$rating" },
                        reviewCount: { $sum: 1 }
                    }
                }
            ]);
            const ratingMap = new Map();
            reviewStats.forEach(stat => {
                ratingMap.set(stat._id.toString(), {
                    avgRating: Math.round(stat.avgRating * 10) / 10,
                    reviewCount: stat.reviewCount
                });
            });
            const propertiesWithRatings = properties.map(p => {
                const doc = p.toObject();
                const stats = ratingMap.get(doc._id.toString()) || { avgRating: 0, reviewCount: 0 };
                doc.avgRating = stats.avgRating;
                doc.reviewCount = stats.reviewCount;
                return doc;
            });
            return res.status(200).json({ properties: propertiesWithRatings, message: "Properties details fetched successfully!" });
        }

        return res.status(200).json({ properties, message: "Properties details fetched successfully!" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error.message || "Internal Server Error", error: error.message });
    }
});

router.get("/:userId/reservations", authenticate, isSelf('userId'), authorize('host', 'admin'), async (req, res) => {
    try {
        const { userId } = req.params;

        await autoCompleteBookings();

        const reservations = await Booking.find({ hostId: userId }).populate("customerId hostId listingId");

        const uniqueReservations = [];
        const seen = new Set();
        for (const resv of reservations) {
            if (!resv.customerId || !resv.listingId) continue;
            const key = `${resv.customerId._id.toString()}_${resv.listingId._id.toString()}_${new Date(resv.startDate).toDateString()}_${new Date(resv.endDate).toDateString()}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueReservations.push(resv);
            }
        }

        const bookingIds = uniqueReservations.map(r => r._id);
        const reviews = await Review.find({ bookingId: { $in: bookingIds } });
        const uniqueReservationsWithReviews = uniqueReservations.map(resv => {
            const resvObj = resv.toObject();
            resvObj.guestReview = reviews.find(r => r.bookingId?.toString() === resv._id.toString() && r.reviewerType === "guest") || null;
            resvObj.hostReview = reviews.find(r => r.bookingId?.toString() === resv._id.toString() && r.reviewerType === "host") || null;
            return resvObj;
        });

        return res.status(200).json({ reservations: uniqueReservationsWithReviews, message: "Reservations details fetched successfully!" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error.message || "Internal Server Error", error: error.message });
    }
});

router.post("/:userId/heartbeat", authenticate, isSelf('userId'), async (req, res) => {
    try {
        const { userId } = req.params;
        const now = new Date();
        const result = await User.updateOne({ _id: userId }, { $set: { lastActive: now } });
        if (result.matchedCount === 0) {
            return res.status(404).json({ message: "User not found" });
        }
        return res.status(200).json({ success: true, lastActive: now });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error.message || "Internal Server Error", error: error.message });
    }
});

router.get("/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: "Invalid user ID" });
        }
        const user = await User.findById(userId).select("-password -email");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        return res.status(200).json({ user });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error.message || "Internal Server Error", error: error.message });
    }
});

router.post("/:userId/request-host", authenticate, isSelf('userId'), async (req, res) => {
    try {
        const { userId } = req.params;
        const { phone, bio } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.role === 'host' || user.role === 'admin') {
            return res.status(400).json({ message: "User is already a host or administrator." });
        }

        user.hostRequestStatus = "pending";
        if (phone) user.phone = phone;
        if (bio) user.bio = bio;

        await user.save();
        
        const userObj = user.toObject();
        delete userObj.password;

        return res.status(200).json({ message: "Host request submitted successfully!", user: userObj });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error.message || "Internal Server Error", error: error.message });
    }
});

module.exports = router;
