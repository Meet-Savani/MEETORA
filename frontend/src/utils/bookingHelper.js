/**
 * Accurately calculate the true number of nights for a booking in the frontend.
 * 1. Checks difference between check-in and check-out dates (midnight-normalized).
 * 2. Cross-checks against totalPrice, listing price, and discounts.
 * 3. Falls back safely to dayCount (if valid) or minimum 1 night.
 */
export const calculateBookingNights = (booking) => {
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
