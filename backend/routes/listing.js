const router = require('express').Router();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const Listing = require('../models/Listing.model');
const User = require('../models/User.model');
const Booking = require('../models/Booking.model');
const Review = require('../models/Review.model');
const Notification = require('../models/Notification.model');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { authorize, isListingOwner } = require('../middleware/authorize');
const { uploadMultipleToCloudinary } = require('../utils/cloudinary');

// Create Listing — hosts only
router.post("/create", authenticate, authorize('host', 'admin'), async (req, res) => {
    try {
        const { category, type, streetAddress, aptSuite, city, province, country, guestCount, bedroomCount, bedCount, bathroomCount, amenities, title, description, highlight, highlightDesc, price } = req.body;

        let rawPhotos = req.body.listingPhotos;
        if (typeof rawPhotos === 'string') {
            try {
                const parsed = JSON.parse(rawPhotos);
                rawPhotos = Array.isArray(parsed) ? parsed : [rawPhotos];
            } catch {
                rawPhotos = [rawPhotos];
            }
        }
        if (!Array.isArray(rawPhotos)) {
            rawPhotos = rawPhotos ? [rawPhotos] : [];
        }

        if (rawPhotos.length === 0) {
            return res.status(400).json({ message: "At least one property photo is required." });
        }

        // Deduplication safeguard: Prevent duplicate listings from rapid double-clicks
        const recentDuplicate = await Listing.findOne({
            creator: req.user._id,
            title: title ? title.trim() : "",
            createdAt: { $gte: new Date(Date.now() - 20000) }
        });
        if (recentDuplicate) {
            return res.status(200).json(recentDuplicate);
        }

        const listingPhotoPaths = await uploadMultipleToCloudinary(rawPhotos, 'dream_home/listings');

        let parsedAmenities = [];
        if (amenities) {
            if (Array.isArray(amenities)) {
                parsedAmenities = amenities.flatMap(a => typeof a === 'string' && a.includes(',') ? a.split(',') : a);
            } else if (typeof amenities === 'string') {
                try {
                    const parsed = JSON.parse(amenities);
                    parsedAmenities = Array.isArray(parsed) ? parsed : [amenities];
                } catch {
                    parsedAmenities = amenities.split(',');
                }
            }
            parsedAmenities = parsedAmenities.map(s => String(s).trim()).filter(Boolean);
        }

        const newListing = new Listing({
            creator: req.user._id,
            category,
            type,
            streetAddress,
            aptSuite,
            city,
            province,
            country,
            guestCount,
            bedroomCount,
            bedCount,
            bathroomCount,
            amenities: parsedAmenities,
            listingPhotoPaths,
            title,
            description,
            highlight,
            highlightDesc,
            price,
            isApproved: 'pending',
        });

        await newListing.save();

        const admins = await User.find({ role: 'admin' });
        for (const admin of admins) {
            await Notification.create({
                userId: admin._id,
                title: 'New Property Pending Review',
                message: `"${title}" in ${city} was submitted and awaits approval.`,
                type: 'booking',
            });
        }

        return res.status(201).json({ newListing, message: "Property submitted for review!" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error.message || "Internal Server Error", error: error.message });
    }
});

// Helper to attach ratings to an array of listings in a single batch aggregation
const attachRatingsToListings = async (listings) => {
    if (!listings || listings.length === 0) return listings;
    try {
        const listingIds = listings.map(l => l._id).filter(Boolean);
        const objIds = listingIds.map(id => mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id);
        const allIds = Array.from(new Set([...listingIds, ...objIds]));

        const reviewStats = await Review.aggregate([
            { $match: { listingId: { $in: allIds }, reviewerType: "guest" } },
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

        return listings.map(l => {
            const doc = l.toObject ? l.toObject() : { ...l };
            const stats = ratingMap.get(doc._id.toString()) || { avgRating: 0, reviewCount: 0 };
            doc.avgRating = stats.avgRating;
            doc.reviewCount = stats.reviewCount;
            return doc;
        });
    } catch {
        return listings;
    }
};

// Public: browse approved listings
router.get('/', async (req, res) => {
    const qCategory = req.query.category;

    try {
        const filter = { isApproved: "approved", isArchived: { $ne: true } };
        if (qCategory) {
            filter.category = qCategory;
        }

        const rawListings = await Listing.find(filter)
            .populate("creator", "firstName lastName profileImagePath")
            .sort({ createdAt: -1 });

        const listings = await attachRatingsToListings(rawListings);

        return res.status(200).json({ listings, message: "Listing Fetched Successfully!" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error.message || "Internal Server Error", error: error.message });
    }
});

router.get('/search/:search', async (req, res) => {
    const { search } = req.params;

    try {
        let filter = { isApproved: "approved", isArchived: { $ne: true } };
        if (search && search !== "all") {
            const trimmed = search.trim();
            const escapedSearch = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.$or = [
                { title: { $regex: escapedSearch, $options: "i" } },
                { category: { $regex: escapedSearch, $options: "i" } },
                { type: { $regex: escapedSearch, $options: "i" } },
                { city: { $regex: escapedSearch, $options: "i" } },
                { province: { $regex: escapedSearch, $options: "i" } },
                { country: { $regex: escapedSearch, $options: "i" } },
                { description: { $regex: escapedSearch, $options: "i" } },
            ];
        }

        const rawListings = await Listing.find(filter)
            .populate("creator", "firstName lastName profileImagePath")
            .sort({ createdAt: -1 });

        const listings = await attachRatingsToListings(rawListings);

        return res.status(200).json({ listings, message: "Listing Fetched Successfully!" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error.message || "Internal Server Error", error: error.message });
    }
});

router.get('/:listingId/rating', async (req, res) => {
    try {
        const { listingId } = req.params;
        const ids = [listingId];
        if (mongoose.Types.ObjectId.isValid(listingId)) {
            ids.push(new mongoose.Types.ObjectId(listingId));
        }
        const reviews = await Review.find({ listingId: { $in: ids }, reviewerType: "guest" });
        const reviewCount = reviews.length;
        const totalRating = reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0);
        const avgRating = reviewCount > 0
            ? Math.round((totalRating / reviewCount) * 10) / 10
            : 0;
        return res.status(200).json({ avgRating, reviewCount });
    } catch (error) {
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

router.get('/:listingId', optionalAuth, async (req, res) => {
    try {
        const { listingId } = req.params;
        const listing = await Listing.findById(listingId).populate("creator", "firstName lastName profileImagePath bio location isVerified");

        if (!listing) {
            return res.status(404).json({ message: "Listing not found." });
        }

        const isOwner = req.user && listing.creator && (
            listing.creator._id ? listing.creator._id.toString() === req.user._id.toString() : listing.creator.toString() === req.user._id.toString()
        );
        const isAdmin = req.user && req.user.role === 'admin';

        if (!isOwner && !isAdmin && (listing.isApproved !== "approved" || listing.isArchived)) {
            return res.status(403).json({ message: "This property is not available for public viewing." });
        }

        if (!isOwner && !isAdmin) {
            listing.viewCount = (listing.viewCount || 0) + 1;
            await listing.save();
        }

        const bookings = await Booking.find({ listingId, status: { $nin: ["cancelled", "rejected"] } });
        const reviews = await Review.find({ listingId, reviewerType: "guest" }).populate("customerId", "firstName lastName profileImagePath");
        return res.status(200).json({ listing, bookings, reviews, message: "Listing Details Fetched Successfully!" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error.message || "Internal Server Error", error: error.message });
    }
});

// Dedicated endpoint to fetch listing for edit
router.get('/:listingId/edit', authenticate, isListingOwner, async (req, res) => {
    try {
        const listing = req.listing || await Listing.findById(req.params.listingId).populate("creator", "firstName lastName profileImagePath");
        if (!listing) {
            return res.status(404).json({ message: "Listing not found." });
        }
        return res.status(200).json({ listing, message: "Listing fetched for edit." });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error.message || "Internal Server Error", error: error.message });
    }
});

router.post("/:listingId/unavailable-dates", authenticate, isListingOwner, async (req, res) => {
    try {
        const { listingId } = req.params;
        const { startDate, endDate } = req.body;
        const start = new Date(startDate);
        const end = new Date(endDate);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const maxBookingDate = new Date();
        maxBookingDate.setFullYear(maxBookingDate.getFullYear() + 2);
        maxBookingDate.setHours(23, 59, 59, 999);

        if (start < today || end < today) {
            return res.status(400).json({ message: "Blocked dates cannot be in the past." });
        }
        if (start > maxBookingDate || end > maxBookingDate) {
            return res.status(400).json({ message: "Blocked dates cannot be more than 2 years in the future." });
        }
        if (end < start) {
            return res.status(400).json({ message: "End date cannot be before start date." });
        }

        const listing = req.listing || await Listing.findById(listingId);
        if (!listing) {
            return res.status(404).json({ message: "Listing not found." });
        }

        const existingBookings = await Booking.find({ listingId, status: { $nin: ["cancelled", "rejected"] } });
        const overlappingBooking = existingBookings.find(booking => {
            const bStart = new Date(booking.startDate);
            const bEnd = new Date(booking.endDate);
            return start <= bEnd && end >= bStart;
        });
        if (overlappingBooking) {
            return res.status(400).json({ message: "Cannot block dates that have existing bookings." });
        }

        listing.unavailableDates.push({ startDate: start, endDate: end });
        await listing.save();
        await listing.populate("creator");

        return res.status(200).json({ listing, message: "Dates blocked successfully!" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error.message || "Internal Server Error", error: error.message });
    }
});

router.put("/:listingId/unavailable-dates/:rangeId", authenticate, isListingOwner, async (req, res) => {
    try {
        const { listingId, rangeId } = req.params;
        const { startDate, endDate } = req.body;
        const start = new Date(startDate);
        const end = new Date(endDate);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const maxBookingDate = new Date();
        maxBookingDate.setFullYear(maxBookingDate.getFullYear() + 2);
        maxBookingDate.setHours(23, 59, 59, 999);

        if (start < today || end < today) {
            return res.status(400).json({ message: "Blocked dates cannot be in the past." });
        }
        if (start > maxBookingDate || end > maxBookingDate) {
            return res.status(400).json({ message: "Blocked dates cannot be more than 2 years in the future." });
        }
        if (end < start) {
            return res.status(400).json({ message: "End date cannot be before start date." });
        }

        const listing = req.listing || await Listing.findById(listingId);
        if (!listing) {
            return res.status(404).json({ message: "Listing not found." });
        }

        const existingBookings = await Booking.find({ listingId, status: { $nin: ["cancelled", "rejected"] } });
        const overlappingBooking = existingBookings.find(booking => {
            const bStart = new Date(booking.startDate);
            const bEnd = new Date(booking.endDate);
            return start <= bEnd && end >= bStart;
        });
        if (overlappingBooking) {
            return res.status(400).json({ message: "Cannot block dates that have existing bookings." });
        }

        const range = listing.unavailableDates.find(r => r._id && r._id.toString() === rangeId);
        if (!range) {
            return res.status(404).json({ message: "Blocked range not found." });
        }

        range.startDate = start;
        range.endDate = end;
        await listing.save();
        await listing.populate("creator");

        return res.status(200).json({ listing, message: "Blocked dates updated successfully!" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error.message || "Internal Server Error", error: error.message });
    }
});

router.delete("/:listingId/unavailable-dates/:rangeId", authenticate, isListingOwner, async (req, res) => {
    try {
        const { listingId, rangeId } = req.params;

        const listing = req.listing || await Listing.findById(listingId);
        if (!listing) {
            return res.status(404).json({ message: "Listing not found." });
        }

        listing.unavailableDates = listing.unavailableDates.filter(
            (range) => range._id && range._id.toString() !== rangeId
        );
        await listing.save();
        await listing.populate("creator");

        return res.status(200).json({ listing, message: "Blocked dates removed successfully!" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error.message || "Internal Server Error", error: error.message });
    }
});

// Update listing — host owner only
router.put("/:listingId", authenticate, isListingOwner, async (req, res) => {
    try {
        const listing = req.listing || await Listing.findById(req.params.listingId);
        if (!listing) {
            return res.status(404).json({ message: "Listing not found." });
        }

        const numericFields = ['guestCount', 'bedroomCount', 'bedCount', 'bathroomCount', 'price'];
        numericFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                const val = Number(req.body[field]);
                if (!isNaN(val)) {
                    listing[field] = val;
                }
            }
        });

        const stringFields = [
            'category', 'type', 'streetAddress', 'aptSuite', 'city', 'province', 'country',
            'title', 'description', 'highlight', 'highlightDesc', 'bookingType'
        ];
        stringFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                listing[field] = req.body[field];
            }
        });

        // Normalize amenities cleanly
        if (req.body.amenities !== undefined) {
            let parsedAmenities = [];
            if (Array.isArray(req.body.amenities)) {
                parsedAmenities = req.body.amenities.flatMap(a => typeof a === 'string' && a.includes(',') ? a.split(',') : a);
            } else if (typeof req.body.amenities === 'string') {
                try {
                    const parsed = JSON.parse(req.body.amenities);
                    parsedAmenities = Array.isArray(parsed) ? parsed : [req.body.amenities];
                } catch {
                    parsedAmenities = req.body.amenities.split(',');
                }
            }
            listing.amenities = parsedAmenities.map(s => String(s).trim()).filter(Boolean);
        }

        // Handle existing photos + new uploaded photos
        let existingPhotos = [];
        if (req.body.existingPhotos !== undefined) {
            if (Array.isArray(req.body.existingPhotos)) {
                existingPhotos = req.body.existingPhotos;
            } else {
                try {
                    const parsed = JSON.parse(req.body.existingPhotos);
                    existingPhotos = Array.isArray(parsed) ? parsed : [req.body.existingPhotos];
                } catch {
                    existingPhotos = req.body.existingPhotos ? [req.body.existingPhotos] : [];
                }
            }
            existingPhotos = existingPhotos.filter(Boolean);
        } else {
            existingPhotos = listing.listingPhotoPaths || [];
        }

        let rawNewPhotos = req.body.newPhotos || req.body.listingPhotos || [];
        if (typeof rawNewPhotos === 'string') {
            try {
                const parsed = JSON.parse(rawNewPhotos);
                rawNewPhotos = Array.isArray(parsed) ? parsed : [rawNewPhotos];
            } catch {
                rawNewPhotos = [rawNewPhotos];
            }
        }
        if (!Array.isArray(rawNewPhotos)) {
            rawNewPhotos = rawNewPhotos ? [rawNewPhotos] : [];
        }

        const uploadedNewPhotos = await uploadMultipleToCloudinary(rawNewPhotos, 'dream_home/listings');
        const combinedPhotos = [...existingPhotos, ...uploadedNewPhotos];

        if (combinedPhotos.length === 0) {
            return res.status(400).json({ message: "At least one property photo is required." });
        }

        listing.listingPhotoPaths = combinedPhotos;

        // Keep current approval status (if already approved, remain approved so edits reflect immediately across all pages)
        // If unassigned, default to approved
        if (!listing.isApproved) {
            listing.isApproved = 'approved';
        }

        await listing.save();
        await listing.populate("creator");

        return res.status(200).json({ listing, message: "Property updated successfully!" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error.message || "Internal Server Error", error: error.message });
    }
});

// Duplicate listing — host owner only
router.post("/:listingId/duplicate", authenticate, isListingOwner, async (req, res) => {
    try {
        const source = req.listing || await Listing.findById(req.params.listingId);
        if (!source) {
            return res.status(404).json({ message: "Listing not found." });
        }

        const duplicate = new Listing({
            creator: req.user._id,
            category: source.category,
            type: source.type,
            streetAddress: source.streetAddress,
            aptSuite: source.aptSuite,
            city: source.city,
            province: source.province,
            country: source.country,
            guestCount: source.guestCount,
            bedroomCount: source.bedroomCount,
            bedCount: source.bedCount,
            bathroomCount: source.bathroomCount,
            amenities: [...(source.amenities || [])],
            listingPhotoPaths: [...(source.listingPhotoPaths || [])],
            title: `${source.title} (Copy)`,
            description: source.description,
            highlight: source.highlight,
            highlightDesc: source.highlightDesc,
            price: source.price,
            bookingType: source.bookingType,
            isApproved: 'pending',
            isFeatured: false,
            isArchived: false,
        });

        await duplicate.save();
        return res.status(201).json({ listing: duplicate, message: "Property duplicated successfully." });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error.message || "Internal Server Error", error: error.message });
    }
});

// Archive / unarchive listing
router.patch("/:listingId/archive", authenticate, isListingOwner, async (req, res) => {
    try {
        const listing = req.listing || await Listing.findById(req.params.listingId);
        if (!listing) {
            return res.status(404).json({ message: "Listing not found." });
        }

        listing.isArchived = !listing.isArchived;
        if (listing.isArchived) {
            listing.isApproved = 'archived';
        } else if (listing.isApproved === 'archived') {
            listing.isApproved = 'pending';
        }

        await listing.save();
        return res.status(200).json({
            listing,
            message: listing.isArchived ? "Property archived." : "Property restored from archive.",
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error.message || "Internal Server Error", error: error.message });
    }
});

// Delete listing — host owner only
router.delete("/:listingId", authenticate, isListingOwner, async (req, res) => {
    try {
        const listing = req.listing || await Listing.findById(req.params.listingId);
        if (!listing) {
            return res.status(404).json({ message: "Listing not found." });
        }

        const activeBookings = await Booking.countDocuments({
            listingId: listing._id,
            status: { $in: ['pending', 'accepted'] },
        });

        if (activeBookings > 0) {
            return res.status(400).json({ message: "Cannot delete a property with active bookings." });
        }

        await Listing.findByIdAndDelete(listing._id);
        return res.status(200).json({ message: "Property deleted successfully." });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error.message || "Internal Server Error", error: error.message });
    }
});

module.exports = router;
