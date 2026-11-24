const mongoose = require('mongoose')

const BookingSchema = new mongoose.Schema(
    {
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        hostId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        listingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Listing",
        },
        startDate: {
            type: String,
            required: true,
        },
        endDate: {
            type: String,
            required: true,
        },
        dayCount: {
            type: Number,
            default: 1,
        },
        pricePerNight: {
            type: Number,
            default: 0,
        },
        subTotal: {
            type: Number,
            default: 0,
        },
        totalPrice: {
            type: Number,
            required: true,
        },
        status: {
            type: String,
            enum: ["pending", "accepted", "rejected", "cancelled", "completed"],
            default: "pending",
        },
        cancelledBy: {
            type: String,
            enum: ["", "guest", "host", "admin"],
            default: "",
        },
        couponCode: {
            type: String,
            default: "",
        },
        discountAmount: {
            type: Number,
            default: 0,
        },
        invoiceRef: {
            type: String,
            default: "",
        },
        paymentId: {
            type: String,
            default: "",
        },
        hostFeeRate: {
            type: Number,
            default: 3,
        },
        guestFeeRate: {
            type: Number,
            default: 0,
        },
        platformFeeRate: {
            type: Number,
            default: 5,
        },
        hostFeeAmount: {
            type: Number,
            default: 0,
        },
        guestFeeAmount: {
            type: Number,
            default: 0,
        },
        platformFeeAmount: {
            type: Number,
            default: 0,
        }
    }, 
    {
        timestamps: true,
    }
);

BookingSchema.index({ customerId: 1, status: 1 });
BookingSchema.index({ hostId: 1, status: 1 });
BookingSchema.index({ listingId: 1, status: 1 });

const Booking = mongoose.model("Booking", BookingSchema);
module.exports = Booking;
