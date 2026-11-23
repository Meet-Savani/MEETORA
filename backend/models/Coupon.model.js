const mongoose = require('mongoose');

const CouponSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true },
    discountType: { type: String, enum: ['percentage', 'flat'], default: 'percentage' },
    discountValue: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    usageLimit: { 
        type: Number, 
        default: null,
        min: [1, 'Coupon quantity must be a positive number (minimum 1).'],
        max: [100, 'Coupon quantity cannot exceed 100.']
    },
    usageCount: { type: Number, default: 0 },
}, { timestamps: true });

CouponSchema.pre('save', function (next) {
    if (this.usageLimit !== null && this.usageLimit !== undefined && this.usageCount >= this.usageLimit) {
        this.isActive = false;
    }
    next();
});

module.exports = mongoose.model('Coupon', CouponSchema);
