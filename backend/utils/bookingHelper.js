const Booking = require('../models/Booking.model');

/**
 * Accurately calculate the true number of nights for a booking.
 * 1. Checks difference between check-in and check-out dates (midnight-normalized).
 * 2. Cross-checks against totalPrice, listing price, and discounts.
 * 3. Falls back safely to dayCount (if valid) or minimum 1 night.
 */
const calculateBookingNights = (booking) => {
    if (!booking) return 1;
    let nights = 0;

    // 1. Calculate from startDate and endDate
    if (booking.startDate && booking.endDate) {
        const s = new Date(booking.startDate);
        const e = new Date(booking.endDate);
        if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
            s.setHours(0, 0, 0, 0);
            e.setHours(0, 0, 0, 0);
            const diffDays = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays > 0) {
                nights = diffDays;
            }
        }
    }

    // 2. Cross-check against historical price per night and total price
    const listingPrice = Number(
        booking.pricePerNight !== undefined && booking.pricePerNight !== null && Number(booking.pricePerNight) > 0
            ? booking.pricePerNight
            : (booking.listingId?.price !== undefined ? booking.listingId.price : (booking.listing?.price || 0))
    );
    const totalPrice = Number(booking.totalPrice || 0);
    const discount = Number(booking.discountAmount || 0);

    if (listingPrice > 0 && totalPrice > 0) {
        const netBeforeTax = totalPrice / 1.18;
        const impliedBase = netBeforeTax + discount;
        const impliedNights = Math.round(impliedBase / listingPrice);

        if (impliedNights > 0) {
            if (!nights) {
                nights = impliedNights;
            } else if (Math.abs(impliedNights - nights) >= 1) {
                const testNet = Math.max(0, listingPrice * impliedNights - discount);
                const testTotal = Math.round((testNet * 1.18) * 100) / 100;
                if (Math.abs(testTotal - totalPrice) <= 1) {
                    nights = impliedNights;
                }
            }
        }
    }

    // 3. Fallback to dayCount only if dates produced 0 or invalid and no price match
    if (!nights && booking.dayCount && Number(booking.dayCount) > 0) {
        nights = Number(booking.dayCount);
    }

    return Math.max(1, nights || 1);
};

/**
 * Accurately calculate the full total price of a booking including GST (Rent - Discount + SGST + CGST).
 */
const ensureBookingGST = (booking) => {
    if (!booking) return 0;
    const nights = calculateBookingNights(booking);
    const discount = Number(booking.discountAmount || 0);
    let baseRent = 0;
    if (booking.pricePerNight !== undefined && booking.pricePerNight !== null && Number(booking.pricePerNight) > 0) {
        baseRent = Math.round(Number(booking.pricePerNight) * nights * 100) / 100;
    } else if (booking.subTotal && Number(booking.subTotal) > 0) {
        baseRent = Number(booking.subTotal);
    } else if (booking.totalPrice && Number(booking.totalPrice) > 0) {
        baseRent = Math.round(((Number(booking.totalPrice) / 1.18) + discount) * 100) / 100;
    } else if (booking.listingId && booking.listingId.price !== undefined) {
        baseRent = Math.round(Number(booking.listingId.price) * nights * 100) / 100;
    }
    const netRent = Math.max(0, Math.round((baseRent - discount) * 100) / 100);
    const sgst = Math.round(netRent * 0.09 * 100) / 100;
    const cgst = Math.round(netRent * 0.09 * 100) / 100;
    const totalWithGst = Math.round((netRent + sgst + cgst) * 100) / 100;

    return totalWithGst;
};

/**
 * Scan bookings and handle completion transitions accurately based on stay end date.
 * A booking is completed ONLY after its entire end date has passed (end of day).
 * Also self-heals existing bookings in MongoDB so dayCount and snapshotted prices are accurate.
 */
const autoCompleteBookings = async () => {
    try {
        const now = new Date();

        // 1. Transition 'accepted' bookings to 'completed' if the end date has fully passed
        const activeBookings = await Booking.find({ status: { $in: ['accepted', 'pending'] } });
        let completedCount = 0;

        for (const booking of activeBookings) {
            const end = new Date(booking.endDate);
            end.setHours(23, 59, 59, 999);

            if (now > end) {
                if (booking.status === 'accepted') {
                    booking.status = 'completed';
                    await booking.save();
                    completedCount++;
                } else if (booking.status === 'pending') {
                    // Expire unapproved pending requests once stay dates have elapsed
                    booking.status = 'rejected';
                    await booking.save();
                }
            }
        }

        // 2. Self-healing: Revert any bookings prematurely marked 'completed' back to 'accepted' if end date hasn't passed
        const prematurelyCompleted = await Booking.find({ status: 'completed' });
        let revertedCount = 0;

        for (const booking of prematurelyCompleted) {
            const end = new Date(booking.endDate);
            end.setHours(23, 59, 59, 999);

            if (now <= end) {
                booking.status = 'accepted';
                await booking.save();
                revertedCount++;
            }
        }

        // 3. Self-healing: Ensure all bookings preserve their accurate dayCount, pricePerNight, and subTotal
        const allBookings = await Booking.find({}).populate('listingId');
        for (const booking of allBookings) {
            let changed = false;
            const accurateNights = calculateBookingNights(booking);
            if (booking.dayCount !== accurateNights) {
                booking.dayCount = accurateNights;
                changed = true;
            }
            if (booking.pricePerNight === undefined || booking.pricePerNight === null || Number(booking.pricePerNight) === 0) {
                const discount = Number(booking.discountAmount || 0);
                const impliedPrice = accurateNights > 0
                    ? Math.round((((booking.totalPrice || 0) / 1.18 + discount) / accurateNights) * 100) / 100
                    : Number(booking.listingId?.price || 0);
                booking.pricePerNight = impliedPrice;
                booking.subTotal = Math.round(impliedPrice * accurateNights * 100) / 100;
                changed = true;
            }
            if (changed) {
                await booking.save();
            }
        }
        
        if (completedCount > 0 || revertedCount > 0) {
            console.log(`[Auto-Complete] ${completedCount} transitioned to completed, ${revertedCount} restored to accepted.`);
        }
    } catch (err) {
        console.error('Error auto-completing bookings:', err.message);
    }
};

module.exports = { autoCompleteBookings, ensureBookingGST, calculateBookingNights };
