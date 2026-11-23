const router = require('express').Router();
const mongoose = require('mongoose');
const Review = require('../models/Review.model');
const Notification = require('../models/Notification.model');
const Listing = require('../models/Listing.model');
const Booking = require('../models/Booking.model');
const { authenticate } = require('../middleware/auth');
const { isSelf } = require('../middleware/authorize');

router.post("/create", authenticate, async (req, res) => {
    try {
        const { listingId, rating, comment, reviewerType, bookingId } = req.body;
        const customerId = req.user._id;
        const hostId = req.body.hostId;

        if (!listingId || !hostId || !rating || !comment || !reviewerType) {
            return res.status(400).json({ message: "All fields are required." });
        }

        if (reviewerType === "host") {
            return res.status(400).json({ message: "Hosts are not permitted to rate or review guests." });
        }

        if (!bookingId) {
            return res.status(400).json({ message: "A completed booking is required to leave a review." });
        }

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({ message: "Booking not found." });
        }

        if (booking.customerId.toString() !== customerId.toString()) {
            return res.status(403).json({ message: "You can only review your own bookings." });
        }

        const endDate = new Date(booking.endDate);
        const isStayComplete = booking.status === "completed" || (endDate < new Date() && booking.status === "accepted");
        if (!isStayComplete) {
            return res.status(400).json({ message: "Reviews can only be submitted after the stay is completed." });
        }

        const existingReview = await Review.findOne({ bookingId, reviewerType: "guest" });
        if (existingReview) {
            return res.status(400).json({ message: "You have already reviewed this stay." });
        }

        const newReview = new Review({
            listingId,
            customerId,
            hostId,
            rating,
            comment,
            reviewerType,
            bookingId
        });
        await newReview.save();

        const listing = await Listing.findById(listingId);

        await Notification.create({
            userId: hostId,
            title: "New Review Received",
            message: `You received a ${rating}-star review for ${listing ? listing.title : "your property"}.`,
            type: "booking"
        });

        return res.status(200).json({ newReview, message: "Review submitted successfully!" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

router.get("/listing/:listingId", async (req, res) => {
    try {
        const { listingId } = req.params;
        const reviews = await Review.find({ listingId, reviewerType: "guest" }).populate("customerId", "firstName lastName profileImagePath");
        return res.status(200).json({ reviews });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

router.get("/host/:hostId", async (req, res) => {
    try {
        const { hostId } = req.params;
        const reviews = await Review.find({ hostId, reviewerType: "guest" }).populate("customerId", "firstName lastName profileImagePath");
        return res.status(200).json({ reviews });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

router.get("/user/:userId/given", authenticate, isSelf('userId'), async (req, res) => {
    try {
        const { userId } = req.params;
        const reviews = await Review.find({ customerId: userId }).populate("listingId hostId");
        return res.status(200).json({ reviews });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// 4. Update Review (Author Only - with multi-identifier lookup fallback)
const handleUpdateReview = async (req, res) => {
    try {
        const reviewId = req.params.reviewId || req.body.reviewId || req.body._id;
        const bookingId = req.body.bookingId;
        const listingId = req.body.listingId;
        const { rating, comment } = req.body;

        let review = null;
        if (reviewId && mongoose.Types.ObjectId.isValid(reviewId)) {
            review = await Review.findById(reviewId);
        }

        if (!review && bookingId && mongoose.Types.ObjectId.isValid(bookingId)) {
            review = await Review.findOne({ bookingId, reviewerType: "guest" });
        }

        if (!review && listingId) {
            review = await Review.findOne({ 
                listingId, 
                customerId: req.user._id, 
                reviewerType: "guest" 
            });
        }

        if (!review) {
            return res.status(404).json({ message: "Review not found." });
        }

        if (review.customerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Access denied. Only the author can edit this review." });
        }

        if (rating !== undefined && rating !== null) review.rating = Number(rating);
        if (comment !== undefined && comment !== null) review.comment = comment.trim();
        await review.save();

        return res.status(200).json({ review, message: "Review updated successfully!" });
    } catch (error) {
        console.error("Error updating review:", error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};

router.put("/:reviewId", authenticate, handleUpdateReview);
router.patch("/:reviewId", authenticate, handleUpdateReview);
router.put("/", authenticate, handleUpdateReview);
router.patch("/", authenticate, handleUpdateReview);
router.post("/edit/:reviewId", authenticate, handleUpdateReview);
router.post("/update/:reviewId", authenticate, handleUpdateReview);

// 5. Delete Review (Author Only - with multi-identifier fallback)
const handleDeleteReview = async (req, res) => {
    try {
        const reviewId = req.params.reviewId || req.body.reviewId || req.body._id;
        const bookingId = req.body.bookingId;

        let review = null;
        if (reviewId && mongoose.Types.ObjectId.isValid(reviewId)) {
            review = await Review.findById(reviewId);
        }

        if (!review && bookingId && mongoose.Types.ObjectId.isValid(bookingId)) {
            review = await Review.findOne({ bookingId, reviewerType: "guest" });
        }

        if (!review) {
            return res.status(404).json({ message: "Review not found." });
        }

        if (review.customerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Access denied. Only the author can delete this review." });
        }

        await Review.findByIdAndDelete(review._id);
        return res.status(200).json({ message: "Review deleted successfully." });
    } catch (error) {
        console.error("Error deleting review:", error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};

router.delete("/:reviewId", authenticate, handleDeleteReview);
router.delete("/", authenticate, handleDeleteReview);

module.exports = router;
