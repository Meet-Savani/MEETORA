const mongoose = require('mongoose')

const ListingSchema = new mongoose.Schema(
    {
        creator: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        category: {
            type: String,
            required: true, 
        },
        type: {
            type: String,
            required: true, 
        },
        streetAddress: {
            type: String,
            required: true, 
        },
        aptSuite: {
            type: String,
        },
        city: {
            type: String,
            required: true, 
        },
        province: {
            type: String,
            required: true, 
        },
        country: {
            type: String,
            required: true, 
        },
        guestCount: {
            type: Number,
            required: true, 
        },
        bedroomCount: {
            type: Number,
            required: true, 
        },
        bedCount: {
            type: Number,
            required: true, 
        },
        bathroomCount: {
            type: Number,
            required: true, 
        },
        amenities: {
            type: Array,
            default: [],
        },
        listingPhotoPaths: [{
            type: String,
        }],
        title: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
        highlight: {
            type: String,
            required: true,
        },
        highlightDesc: {
            type: String,
            required: true,
        },
        price: {
            type: Number,
            required: true,
        },
        unavailableDates: {
            type: [
                {
                    startDate: { type: Date, required: true },
                    endDate: { type: Date, required: true }
                }
            ],
            default: []
        },
        bookingType: {
            type: String,
            enum: ["instant", "request"],
            default: "instant",
        },
        isApproved: {
            type: String,
            enum: ["pending", "approved", "rejected", "paused", "suspended", "archived"],
            default: "pending",
        },
        isFeatured: {
            type: Boolean,
            default: false,
        },
        isArchived: {
            type: Boolean,
            default: false,
        },
        viewCount: {
            type: Number,
            default: 0,
        },
    }, 
    {
        timestamps: true,
    }
);

ListingSchema.index({ isApproved: 1, isArchived: 1, category: 1 });
ListingSchema.index({ creator: 1 });
ListingSchema.index({ createdAt: -1 });
ListingSchema.index({ price: 1 });

const Listing = mongoose.model("Listing", ListingSchema); 
module.exports = Listing; 
