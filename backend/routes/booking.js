const router = require('express').Router();
const Booking = require('../models/Booking.model');
const Listing = require('../models/Listing.model');
const Notification = require('../models/Notification.model');
const Settings = require('../models/Settings.model');
const Coupon = require('../models/Coupon.model');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const { isBookingCustomer, isBookingHost, isBookingParticipant } = require('../middleware/authorize');
const { autoCompleteBookings } = require('../utils/bookingHelper');

// Helper to resolve accommodation image for PDF invoice with multi-layer fallback
const resolveListingImageBuffer = async (listing) => {
    try {
        if (listing?.listingPhotoPaths && Array.isArray(listing.listingPhotoPaths)) {
            for (const rawPath of listing.listingPhotoPaths) {
                if (!rawPath || typeof rawPath !== 'string') continue;
                const cleanPath = rawPath.replaceAll('\\', '/').replace(/^\/+/, '');
                const filename = path.basename(cleanPath);

                // 1. Try local candidate paths
                const candidatePaths = [
                    path.resolve(__dirname, '../public/uploads', filename),
                    path.resolve(process.cwd(), 'backend/public/uploads', filename),
                    path.resolve(__dirname, '../../frontend/public/uploads', filename),
                    path.resolve(process.cwd(), 'frontend/public/uploads', filename),
                    path.resolve(process.cwd(), 'public/uploads', filename),
                    path.resolve(__dirname, '..', cleanPath),
                    path.resolve(cleanPath),
                    path.resolve(process.cwd(), cleanPath),
                    path.resolve(process.cwd(), 'backend', cleanPath)
                ];

                for (const cand of candidatePaths) {
                    if (fs.existsSync(cand)) {
                        const ext = (path.extname(cand) || '').toLowerCase();
                        if (['.jpg', '.jpeg', '.png'].includes(ext)) {
                            const buf = fs.readFileSync(cand);
                            if (buf && buf.length > 0) return buf;
                        }
                    }
                }

                // 2. Try fetching from remote URL if available
                const backendBase = (process.env.BACKEND_URL || 'https://meetora-backend-4mjl.onrender.com').replace(/\/+$/, '');
                const remoteUrl = cleanPath.startsWith('http') 
                    ? cleanPath 
                    : `${backendBase}/${cleanPath.replace(/^public\//, '')}`;

                try {
                    const res = await fetch(remoteUrl, { signal: AbortSignal.timeout(2500) });
                    if (res.ok) {
                        const ct = res.headers.get('content-type') || '';
                        if (ct.includes('image/jpeg') || ct.includes('image/png') || ct.includes('image/jpg')) {
                            const arrayBuf = await res.arrayBuffer();
                            const buf = Buffer.from(arrayBuf);
                            if (buf && buf.length > 0) return buf;
                        }
                    }
                } catch {}
            }
        }

        // 3. Category image fallback
        const category = (listing?.category || '').toLowerCase();
        const categoryMap = {
            beach: 'beach_cat.jpg',
            camping: 'camping_cat.jpg',
            cave: 'cave_cat.jpg',
            skiing: 'skiing_cat.jpg',
            lux: 'lux_cat.jpg',
            barn: 'barn_cat.jpg',
            pool: 'pool_cat.jpg',
            arctic: 'skiing_cat.jpg'
        };
        const catFile = categoryMap[category];
        if (catFile) {
            const catCandidates = [
                path.resolve(__dirname, '../../frontend/public/assets', catFile),
                path.resolve(process.cwd(), 'frontend/public/assets', catFile),
                path.resolve(process.cwd(), '../frontend/public/assets', catFile)
            ];
            for (const cp of catCandidates) {
                if (fs.existsSync(cp)) {
                    const buf = fs.readFileSync(cp);
                    if (buf && buf.length > 0) return buf;
                }
            }
        }

        // 4. Guaranteed default asset fallback
        const defaultCandidates = [
            path.resolve(__dirname, '../../frontend/public/assets/default.jpg'),
            path.resolve(process.cwd(), 'frontend/public/assets/default.jpg'),
            path.resolve(__dirname, '../../frontend/public/assets/slide.jpg'),
            path.resolve(process.cwd(), 'frontend/public/assets/slide.jpg')
        ];
        for (const dp of defaultCandidates) {
            if (fs.existsSync(dp)) {
                const buf = fs.readFileSync(dp);
                if (buf && buf.length > 0) return buf;
            }
        }
    } catch (err) {
        console.error("Error resolving listing image buffer:", err);
    }
    return null;
};

// Generates unique alphanumeric references mixing uppercase letters and numbers
const generateAlphanumericCode = (prefix, length = 8) => {
    const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let code = "";
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${prefix}-${code}`;
};

router.post("/create", authenticate, async (req, res) => {
    try {
        await autoCompleteBookings();
        const { hostId, listingId, startDate, endDate, couponCode, paymentId } = req.body;
        const customerId = req.user._id.toString();

        if (customerId === hostId) {
            return res.status(400).json({ message: "You cannot book your own property." });
        }

        const listing = await Listing.findById(listingId);
        if (!listing) {
            return res.status(404).json({ message: "Listing not found." });
        }

        if (listing.isApproved !== 'approved') {
            return res.status(400).json({ message: "This property is not available for booking." });
        }

        if (listing.creator.toString() === customerId) {
            return res.status(400).json({ message: "You cannot book your own property." });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const maxBookingDate = new Date();
        maxBookingDate.setFullYear(maxBookingDate.getFullYear() + 2);
        maxBookingDate.setHours(23, 59, 59, 999);

        if (start < today) {
            return res.status(400).json({ message: "Check-in date cannot be in the past." });
        }

        if (start > maxBookingDate || end > maxBookingDate) {
            return res.status(400).json({ message: "Booking dates cannot be more than 2 years in the future." });
        }

        if (end <= start) {
            return res.status(400).json({ message: "Check-out date must be after check-in date (minimum 1 night stay)." });
        }

        const existingBookings = await Booking.find({ listingId, status: { $nin: ["cancelled", "rejected"] } });
        const overlappingBooking = existingBookings.find(booking => {
            const bStart = new Date(booking.startDate);
            const bEnd = new Date(booking.endDate);
            bStart.setHours(0, 0, 0, 0);
            bEnd.setHours(0, 0, 0, 0);
            return start < bEnd && end > bStart;
        });

        if (overlappingBooking) {
            return res.status(400).json({ message: "Selected dates overlap with an existing booking." });
        }

        const hasBlockedOverlap = listing.unavailableDates.some(range => {
            const blockStart = new Date(range.startDate);
            const blockEnd = new Date(range.endDate);
            blockStart.setHours(0, 0, 0, 0);
            blockEnd.setHours(0, 0, 0, 0);
            return start < blockEnd && end > blockStart;
        });

        if (hasBlockedOverlap) {
            return res.status(400).json({ message: "Selected dates overlap with owner-blocked/unavailable dates." });
        }

        // Accommodation is priced per NIGHT (check-out date minus check-in date)
        const diffMs = end.getTime() - start.getTime();
        const nights = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
        const dayCount = nights;
        let basePrice = listing.price * dayCount;
        let discountAmount = 0;

        if (couponCode) {
            const couponDoc = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
            if (!couponDoc) {
                return res.status(400).json({ message: "Invalid or inactive promo code." });
            }

            const now = new Date();
            if (now < new Date(couponDoc.startDate) || now > new Date(couponDoc.endDate)) {
                return res.status(400).json({ message: "This promo code is not active or has expired." });
            }

            if (couponDoc.usageLimit !== null && couponDoc.usageCount >= couponDoc.usageLimit) {
                couponDoc.isActive = false;
                await couponDoc.save();
                return res.status(400).json({ message: "This promo code has reached its usage limit." });
            }

            if (couponDoc.discountType === "percentage") {
                discountAmount = Math.round(basePrice * (couponDoc.discountValue / 100));
            } else if (couponDoc.discountType === "flat") {
                discountAmount = Math.min(couponDoc.discountValue, basePrice);
            }

            couponDoc.usageCount += 1;
            if (couponDoc.usageLimit !== null && couponDoc.usageCount >= couponDoc.usageLimit) {
                couponDoc.isActive = false;
            }
            await couponDoc.save();
        }

        const netRent = Math.max(0, basePrice - discountAmount);
        const sgst = Math.round(netRent * 0.09 * 100) / 100;
        const cgst = Math.round(netRent * 0.09 * 100) / 100;
        const calculatedTotalPrice = Math.round((netRent + sgst + cgst) * 100) / 100;
        const totalPrice = (req.body.totalPrice && Number(req.body.totalPrice) >= calculatedTotalPrice)
            ? Number(req.body.totalPrice)
            : calculatedTotalPrice;

        let settings = await Settings.findOne();
        if (!settings) {
            settings = { platformFeePercent: 5, hostFeePercent: 3, guestFeePercent: 0 };
        }

        const hostFeeRate = settings.hostFeePercent;
        const guestFeeRate = settings.guestFeePercent;
        const platformFeeRate = settings.platformFeePercent;

        const hostFeeAmount = Math.round(totalPrice * (hostFeeRate / 100));
        const guestFeeAmount = Math.round(totalPrice * (guestFeeRate / 100));
        const platformFeeAmount = Math.round(totalPrice * (platformFeeRate / 100));

        const status = listing.bookingType === "request" ? "pending" : "accepted";

        const generatedInvoiceRef = generateAlphanumericCode("INV", 8);
        const generatedPaymentId = paymentId && paymentId.startsWith("pay_") && !paymentId.includes("mock")
            ? paymentId
            : generateAlphanumericCode("PAY", 10);

        const newBooking = new Booking({
            customerId,
            hostId,
            listingId,
            startDate,
            endDate,
            dayCount,
            totalPrice,
            status,
            couponCode: couponCode || "",
            discountAmount,
            invoiceRef: generatedInvoiceRef,
            paymentId: generatedPaymentId,
            hostFeeRate,
            guestFeeRate,
            platformFeeRate,
            hostFeeAmount,
            guestFeeAmount,
            platformFeeAmount
        });
        await newBooking.save();

        const promoText = couponCode ? ` (Coupon Applied: ${couponCode})` : "";
        await Notification.create({
            userId: customerId,
            title: status === "accepted" ? "Booking Confirmed!" : "Booking Request Sent",
            message: `Your booking for ${listing.title} from ${startDate} to ${endDate} has been created.${promoText}`,
            type: "booking"
        });

        await Notification.create({
            userId: hostId,
            title: status === "accepted" ? "New Booking Received" : "New Booking Request",
            message: `${status === "accepted" ? "A booking" : "A reservation request"} has been placed for ${listing.title} from ${startDate} to ${endDate}.`,
            type: "booking"
        });

        return res.status(200).json({ newBooking, message: status === "accepted" ? "Booking Confirmed!" : "Booking Request Sent!" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

router.patch("/:bookingId/cancel", authenticate, isBookingParticipant, async (req, res) => {
    try {
        const booking = req.booking || await Booking.findById(req.params.bookingId).populate("listingId customerId hostId");
        if (!booking) {
            return res.status(404).json({ message: "Booking not found." });
        }

        if (booking.status === "cancelled") {
            return res.status(400).json({ message: "Booking is already cancelled." });
        }

        if (booking.status === "completed") {
            return res.status(400).json({ message: "Completed bookings cannot be cancelled or refunded." });
        }

        const end = new Date(booking.endDate);
        end.setHours(23, 59, 59, 999);
        if (new Date() > end) {
            booking.status = "completed";
            await booking.save();
            return res.status(400).json({ message: "Trip stay date has already concluded. Cancellation and refund are not permitted." });
        }

        const hostIdStr = (booking.hostId?._id || booking.hostId || "").toString();
        const customerIdStr = (booking.customerId?._id || booking.customerId || "").toString();
        const currentUserId = req.user._id.toString();

        booking.status = "cancelled";

        // CRITICAL: Preserve the original cancellation role.
        // Once a booking is cancelled by a guest, host, or admin, that original role is NEVER overwritten by subsequent changes.
        if (!booking.cancelledBy) {
            if (req.body?.cancelledBy && ["guest", "host", "admin"].includes(req.body.cancelledBy)) {
                booking.cancelledBy = req.body.cancelledBy;
            } else if (currentUserId === hostIdStr) {
                booking.cancelledBy = "host";
            } else if (currentUserId === customerIdStr) {
                booking.cancelledBy = "guest";
            } else if (req.user.role === "admin") {
                booking.cancelledBy = "admin";
            } else {
                booking.cancelledBy = "guest";
            }
        }
        await booking.save();

        if (booking.cancelledBy === "host") {
            await Notification.create({
                userId: customerIdStr,
                title: "Reservation Cancelled by Host",
                message: `Your reservation for ${booking.listingId?.title} from ${booking.startDate} to ${booking.endDate} was cancelled by the host. A full refund of $${booking.totalPrice} has been processed.`,
                type: "payment"
            });

            await Notification.create({
                userId: hostIdStr,
                title: "Reservation Cancelled & Refunded",
                message: `You cancelled the booking for ${booking.listingId?.title} (${booking.startDate} to ${booking.endDate}). Full refund of $${booking.totalPrice} has been issued to the guest.`,
                type: "booking"
            });

            return res.status(200).json({ booking, message: "Reservation cancelled successfully and refund initiated for guest." });
        } else if (booking.cancelledBy === "admin") {
            await Notification.create({
                userId: customerIdStr,
                title: "Dispute Settled: Refund Issued",
                message: `An administrator has resolved a dispute and issued a full refund of $${booking.totalPrice} for your booking at ${booking.listingId?.title}.`,
                type: "payment"
            });

            await Notification.create({
                userId: hostIdStr,
                title: "Booking Refunded by Administrator",
                message: `The booking for ${booking.listingId?.title} from ${booking.startDate} to ${booking.endDate} has been refunded by administration.`,
                type: "booking"
            });

            return res.status(200).json({ booking, message: "Booking cancelled and refunded by administration." });
        } else {
            await Notification.create({
                userId: customerIdStr,
                title: "Booking Cancelled",
                message: `You cancelled your trip to ${booking.listingId?.title}. Refund of $${booking.totalPrice} is being processed.`,
                type: "payment"
            });

            await Notification.create({
                userId: hostIdStr,
                title: "Reservation Cancelled by Guest",
                message: `The booking for ${booking.listingId?.title} from ${booking.startDate} to ${booking.endDate} was cancelled by the guest.`,
                type: "booking"
            });

            return res.status(200).json({ booking, message: "Booking cancelled successfully and refund initiated." });
        }
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

router.patch("/:bookingId/status", authenticate, isBookingHost, async (req, res) => {
    try {
        const { status } = req.body;

        if (!["accepted", "rejected", "completed"].includes(status || "")) {
            return res.status(400).json({ message: "Invalid status value." });
        }

        const booking = req.booking || await Booking.findById(req.params.bookingId).populate("listingId customerId");
        if (!booking) {
            return res.status(404).json({ message: "Booking not found." });
        }

        booking.status = status;
        await booking.save();

        await Notification.create({
            userId: booking.customerId._id || booking.customerId,
            title: `Reservation ${status ? status.charAt(0).toUpperCase() + status.slice(1) : ""}`,
            message: `Your booking request for ${booking.listingId?.title} has been ${status} by the host.`,
            type: "booking"
        });

        if (status === "rejected") {
            await Notification.create({
                userId: booking.customerId._id || booking.customerId,
                title: "Refund Initiated",
                message: `Refund of $${booking.totalPrice} was credited for your rejected stay.`,
                type: "payment"
            });
        }

        return res.status(200).json({ booking, message: `Booking status updated to ${status}.` });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

router.get("/:bookingId/invoice", authenticate, isBookingParticipant, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.bookingId).populate("customerId hostId listingId");
        if (!booking) {
            return res.status(404).send("Booking not found");
        }

        if (!booking.paymentId || booking.status === "pending" || booking.status === "rejected") {
            return res.status(400).send("Invoice is only generated once payment has been completed.");
        }

        const doc = new PDFDocument({ size: "LETTER", margin: 50 });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename=invoice-${req.params.bookingId}.pdf`);

        doc.pipe(res);

        doc.rect(0, 0, 612, 15).fill("#22c55e");

        // Brand logo or styled header (use logo-dark.png)
        const logoCandidates = [
            path.resolve(__dirname, '../../frontend/public/assets/logo-dark.png'),
            path.resolve(process.cwd(), 'frontend/public/assets/logo-dark.png'),
            path.resolve(process.cwd(), '../frontend/public/assets/logo-dark.png')
        ];
        const logoPath = logoCandidates.find(p => fs.existsSync(p));
        if (logoPath) {
            try {
                doc.image(logoPath, 50, 36, { height: 38 });
            } catch {
                doc.fillColor("#22c55e").fontSize(26).font("Helvetica-Bold").text("MEETORA", 50, 45);
            }
        } else {
            doc.fillColor("#22c55e").fontSize(26).font("Helvetica-Bold").text("MEETORA", 50, 45);
        }

        doc.fillColor("#0f172a").fontSize(20).font("Helvetica-Bold").text("INVOICE", 400, 38, { align: "right" });
        doc.fillColor("#16a34a").fontSize(8.5).font("Helvetica-Bold").text("OFFICIAL RECEIPT • PAID", 400, 60, { align: "right" });

        doc.strokeColor("#e2e8f0").lineWidth(1).moveTo(50, 85).lineTo(562, 85).stroke();

        const detailsY = 105;
        doc.roundedRect(50, detailsY, 512, 80, 6).fill("#f8fafc");

        doc.fillColor("#475569").fontSize(9).font("Helvetica-Bold").text("BILLED TO", 70, detailsY + 15);
        doc.fillColor("#0f172a").fontSize(12).font("Helvetica-Bold").text(`${booking.customerId?.firstName || 'Guest'} ${booking.customerId?.lastName || ''}`, 70, detailsY + 28);
        doc.fillColor("#475569").fontSize(10).font("Helvetica").text(booking.customerId?.email || '', 70, detailsY + 45);

        const invoiceRef = booking.invoiceRef || (`INV-${booking._id.toString().slice(-6).toUpperCase()}`);
        const paymentRef = booking.paymentId || (`PAY-${booking._id.toString().slice(-8).toUpperCase()}`);

        doc.fillColor("#475569").fontSize(9).font("Helvetica-Bold").text("INVOICE INFO", 350, detailsY + 15);
        doc.fillColor("#0f172a").fontSize(11).font("Helvetica-Bold").text(`Invoice Ref: ${invoiceRef}`, 350, detailsY + 28);
        doc.fillColor("#475569").fontSize(10).font("Helvetica").text(`Date Issued: ${new Date(booking.createdAt).toLocaleDateString()}`, 350, detailsY + 43);
        doc.fillColor("#475569").fontSize(10).font("Helvetica").text(`Payment Ref: ${paymentRef}`, 350, detailsY + 56);

        const stayY = 205;
        doc.roundedRect(50, stayY, 512, 80, 6).fill("#f8fafc");

        // Resolve listing image with robust multi-layer fallback
        const imgBuffer = await resolveListingImageBuffer(booking.listingId);

        if (imgBuffer) {
            try {
                doc.save();
                doc.roundedRect(65, stayY + 10, 80, 60, 4).clip();
                doc.image(imgBuffer, 65, stayY + 10, {
                    width: 80,
                    height: 60,
                    fit: [80, 60],
                    align: 'center',
                    valign: 'center'
                });
                doc.restore();
                // Thin border around the image
                doc.roundedRect(65, stayY + 10, 80, 60, 4).lineWidth(1).strokeColor("#e2e8f0").stroke();
            } catch (err) {
                console.error("PDF Image rendering failed:", err);
                doc.roundedRect(65, stayY + 10, 80, 60, 4).fillAndStroke("#f1f5f9", "#cbd5e1");
                doc.fillColor("#64748b").fontSize(9).font("Helvetica-Bold").text("MEETORA", 75, stayY + 34);
            }
        } else {
            doc.roundedRect(65, stayY + 10, 80, 60, 4).fillAndStroke("#f1f5f9", "#cbd5e1");
            doc.fillColor("#64748b").fontSize(9).font("Helvetica-Bold").text("MEETORA", 75, stayY + 34);
        }

        doc.fillColor("#475569").fontSize(9).text("ACCOMMODATION", 160, stayY + 15);
        doc.fillColor("#0f172a").fontSize(11).text(booking.listingId?.title || 'Listing Stay', 160, stayY + 28, { width: 180, height: 15, ellipsis: true });
        doc.fillColor("#475569").fontSize(10).text(`${booking.listingId?.city || ''}, ${booking.listingId?.country || ''}`, 160, stayY + 45);

        const rawNights = Math.max(1, Math.round((new Date(booking.endDate) - new Date(booking.startDate)) / (1000 * 60 * 60 * 24))) || 1;
        let nights = booking.dayCount || rawNights;
        if (!booking.dayCount && booking.listingId?.price && booking.totalPrice) {
            const netPaid = Math.round((booking.totalPrice / 1.18) * 100) / 100;
            const impliedNights = Math.round(netPaid / booking.listingId.price);
            if (impliedNights > 0 && Math.abs(impliedNights - nights) === 1) {
                nights = impliedNights;
            }
        }

        const discount = booking.discountAmount || 0;
        const ratePerNight = booking.listingId?.price || (nights > 0 ? Math.round(((booking.totalPrice || 0) / nights) * 100) / 100 : 0);
        const subTotal = Math.round(ratePerNight * nights * 100) / 100;
        const netRent = Math.max(0, Math.round((subTotal - discount) * 100) / 100);
        const sgst = Math.round(netRent * 0.09 * 100) / 100;
        const cgst = Math.round(netRent * 0.09 * 100) / 100;
        const finalTotal = booking.totalPrice || Math.round((netRent + sgst + cgst) * 100) / 100;

        doc.fillColor("#475569").fontSize(9).text("STAY SCHEDULE", 360, stayY + 15);
        doc.fillColor("#0f172a").fontSize(11).text(`${new Date(booking.startDate).toLocaleDateString()} - ${new Date(booking.endDate).toLocaleDateString()}`, 360, stayY + 28);
        doc.fillColor("#475569").fontSize(10).text(`Duration: ${nights} Night${nights > 1 ? 's' : ''}`, 360, stayY + 45);

        const tableTop = 315;
        doc.rect(50, tableTop, 512, 24).fill("#0f172a");

        doc.fillColor("#ffffff").fontSize(10).font("Helvetica-Bold").text("Description", 65, tableTop + 7);
        doc.text("Rate / Night", 280, tableTop + 7, { width: 80, align: "right" });
        doc.text("Nights", 380, tableTop + 7, { width: 50, align: "center" });
        doc.text("Amount", 450, tableTop + 7, { width: 100, align: "right" });

        const itemY = tableTop + 36;
        const descWidth = 205;
        const descText = booking.listingId?.title || 'Property Stay';
        const descHeight = doc.fontSize(10).font("Helvetica").heightOfString(descText, { width: descWidth });

        doc.fillColor("#334155").fontSize(10).font("Helvetica").text(descText, 65, itemY, { width: descWidth });
        doc.text(`$${ratePerNight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 280, itemY, { width: 80, align: "right" });
        doc.text(`${nights}`, 380, itemY, { width: 50, align: "center" });
        doc.text(`$${subTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 450, itemY, { width: 100, align: "right" });

        const rowHeight = Math.max(descHeight, 20);
        const lineY = itemY + rowHeight + 10;
        doc.strokeColor("#e2e8f0").lineWidth(1).moveTo(50, lineY).lineTo(562, lineY).stroke();

        const ROW_H = 20;
        const GAP = 6;
        const LX = 350;
        const VX = 480;
        const VW = 82;
        let currentY = lineY + 14;

        const summaryRow = (label, value, labelColor, valueColor, fontSize) => {
            doc.fillColor(labelColor || "#64748b").fontSize(fontSize || 10).font("Helvetica")
                .text(label, LX, currentY, { width: 125, align: "right" });
            doc.fillColor(valueColor || "#1e293b").fontSize(fontSize || 10).font("Helvetica")
                .text(value, VX, currentY, { width: VW, align: "right" });
            currentY += ROW_H;
        };

        summaryRow("Subtotal", `$${subTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "#64748b", "#1e293b");

        if (discount > 0) {
            summaryRow(
                booking.couponCode ? `Coupon (${booking.couponCode})` : "Discount",
                `-$${discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                "#16a34a", "#16a34a"
            );
        }

        summaryRow("SGST (9%)", `+$${sgst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "#64748b", "#1e293b");
        summaryRow("CGST (9%)", `+$${cgst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "#64748b", "#1e293b");

        currentY += GAP;
        doc.strokeColor("#cbd5e1").lineWidth(0.5)
            .moveTo(LX, currentY).lineTo(562, currentY).stroke();
        currentY += GAP + 2;

        const dueH = 38;
        doc.rect(50, currentY, 512, dueH).fill("#1e293b");

        doc.fillColor("#ffffff").fontSize(11).font("Helvetica-Bold")
            .text("TOTAL AMOUNT", 70, currentY + 13);

        doc.fillColor("#ffffff").fontSize(22).font("Helvetica-Bold")
            .text(`$${finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, LX, currentY + 7, { width: 178, align: "right" });

        doc.end();
    } catch (error) {
        console.error(error);
        res.status(500).send("Error generating PDF invoice: " + error.message);
    }
});

// 4. Validate Coupon (public endpoint)
router.get("/coupons/validate/:code", authenticate, async (req, res) => {
    try {
        const { code } = req.params;
        const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
        if (!coupon) {
            return res.status(404).json({ message: "Invalid or inactive promo code." });
        }
        
        const now = new Date();
        if (now < new Date(coupon.startDate) || now > new Date(coupon.endDate)) {
            return res.status(400).json({ message: "This promo code is not active or has expired." });
        }
        
        if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
            coupon.isActive = false;
            await coupon.save();
            return res.status(400).json({ message: "This promo code has reached its usage limit." });
        }
        
        return res.status(200).json({ coupon });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

module.exports = router;
