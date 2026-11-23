const mongoose = require('mongoose')

const userSchema = new mongoose.Schema(
    {
        firstName: {
            type: String,
            required: true,
        },
        lastName: {
            type: String,
            default: "",
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        password: {
            type: String,
            required: true,
        },
        profileImagePath: {
            type: String,
            default: "",
        },
        phone: {
            type: String,
            default: "",
        },
        bio: {
            type: String,
            default: "",
        },
        location: {
            type: String,
            default: "",
        },
        tripList: {
            type: Array,
            default: [],
        },
        wishList: {
            type: Array,
            default: [],
        },
        propertyList: {
            type: Array,
            default: [],
        },
        reservationList: {
            type: Array,
            default: [],
        },
        role: {
            type: String,
            enum: ["user", "admin", "host"],
            default: "user",
        },
        hostRequestStatus: {
            type: String,
            enum: ["none", "pending", "approved", "rejected"],
            default: "none",
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
        lastActive: {
            type: Date,
            default: Date.now,
        },
    }, 
    {
        timestamps: true,
    }
);

const User = mongoose.model("User", userSchema); 
module.exports = User; 
