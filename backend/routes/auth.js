const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const User = require('../models/User.model');
const { uploadToCloudinary } = require('../utils/cloudinary');

// USER REGISTER 
router.post("/register", async (req, res) => {
    try {
        const { firstName, lastName, email, password, profileImage } = req.body;

        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanFirstName = (firstName || '').trim();
        const cleanLastName = (lastName || '').trim();

        if (!cleanEmail || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const escapedEmail = cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const existingUser = await User.findOne({
            email: { $regex: new RegExp(`^${escapedEmail}$`, 'i') }
        });
        if (existingUser) {
            return res.status(400).json({ message: "An account with this email already exists" });
        }

        let profileImagePath = "";
        if (profileImage && typeof profileImage === 'string' && profileImage.trim().length > 0) {
            profileImagePath = await uploadToCloudinary(profileImage, 'dream_home/users');
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            firstName: cleanFirstName,
            lastName: cleanLastName,
            email: cleanEmail, 
            password: hashedPassword,
            profileImagePath,
            role: "user"
        });

        await newUser.save();

        const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET_KEY, {
            expiresIn: '36000m',
        });
        const userObj = newUser.toObject();
        delete userObj.password;

        res.status(201).json({ message: "User registered successfully", user: userObj, token });
    } catch (error) {
        return res.status(500).json({ message: error.message || "Internal Server error", error: error.message });
    }
});

// USER LOGIN 
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const cleanEmail = (email || '').trim().toLowerCase();

        if (!cleanEmail || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }
        
        // Find user by email case-insensitively to prevent spurious failures from casing or whitespace
        const escapedEmail = cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const user = await User.findOne({
            email: { $regex: new RegExp(`^${escapedEmail}$`, 'i') }
        });

        if (!user) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        let isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY, {
            expiresIn: '36000m',
        })
        const userObj = user.toObject();
        delete userObj.password;

        res.status(200).json({ user: userObj, token, message: "User logged in successfully" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

module.exports = router; 
