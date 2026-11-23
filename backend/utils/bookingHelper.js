const Booking = require('../models/Booking.model');

/**
 * Accurately calculate the full total price of a booking including GST (Rent - Discount + SGST + CGST).
 */
const ensureBookingGST = (booking) => {
    if (!booking) return 0;
    const nights = Math.max(1, Math.round((new Date(booking.endDate) - new Date(booking.startDate)) / (1000 * 60 * 60 * 24))) || 1;
    const discount = Number(booking.discountAmount || 0);
    let baseRent = 0;
    if (booking.listingId && booking.listingId.price !== undefined) {
        baseRent = Math.round(Number(booking.listingId.price) * nights * 100) / 100;
    } else {
        baseRent = Math.round(((Number(booking.totalPrice || 0)) / 1.18 + discount) * 100) / 100;
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
 * Also ensures existing bookings have accurate totalPrice inclusive of GST.
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

        // 3. Self-healing: Ensure all bookings in MongoDB have their accurate totalPrice including GST
        const allBookings = await Booking.find({}).populate('listingId');
        for (const booking of allBookings) {
            const accurateTotal = ensureBookingGST(booking);
            if (accurateTotal > 0 && Math.abs((booking.totalPrice || 0) - accurateTotal) > 0.01) {
                booking.totalPrice = accurateTotal;
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

module.exports = { autoCompleteBookings, ensureBookingGST };
