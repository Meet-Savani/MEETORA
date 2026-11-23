import React, { useEffect, useState } from 'react'
import '../../styles/List.scss'
import Loader from '../../components/Loader/Loader';
import { useDispatch, useSelector } from 'react-redux';
import { setTripList, setToast } from '../../redux/state';
import { CalendarMonth, Payment, Receipt, Star, Cancel, StarBorder, Edit, Delete, FilterList, KeyboardArrowDown } from '@mui/icons-material';
import useCurrency from '../../hooks/useCurrency';
import { apiFetch, apiPatch, apiPost, apiPut, apiDelete, openAuthenticatedPdf } from '../../utils/api';
import { BACKEND_BASE_URL } from '../../config/constants';
import { resolveImageUrl } from '../../utils/image';

const TripList = () => {
    const userId = useSelector((state) => state.user.user?._id);
    const tripList = useSelector((state) => state.user.user?.tripList || []);
    const { formatPrice } = useCurrency();
    const [activeTab, setActiveTab] = useState("all");
    const [loading, setLoading] = useState(tripList.length === 0);

    // Modal state for Reviews
    const [reviewModalOpen, setReviewModalOpen] = useState(false);
    const [editingReview, setEditingReview] = useState(null);
    const [selectedTrip, setSelectedTrip] = useState(null);
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState("");

    // Modal state for Cancellations
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [tripToCancel, setTripToCancel] = useState(null);

    const dispatch = useDispatch();

    const getTripList = async () => {
        if (!userId) return;
        try {
            const response = await apiFetch(`/users/${userId}/trips`);
            const data = await response.json();
            dispatch(setTripList(data.trips || []));
            setLoading(false);
        } catch (error) {
            console.log("Trip List fetch failed!", error);
            setLoading(false);
        }
    }

    useEffect(() => {
        getTripList();

        // Real-time synchronization
        const pollInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                getTripList();
            }
        }, 6000);

        const handleFocus = () => {
            getTripList();
        };
        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleFocus);

        return () => {
            clearInterval(pollInterval);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleFocus);
        };
    }, [userId]);

    // Tab categories filter
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const tripCounts = {
        all: tripList.length,
        upcoming: tripList.filter(t => t.status === "accepted" && new Date(t.endDate) >= now).length,
        pending: tripList.filter(t => t.status === "pending").length,
        completed: tripList.filter(t => t.status === "completed" || (t.status === "accepted" && new Date(t.endDate) < now)).length,
        cancelled: tripList.filter(t => t.status === "cancelled" || t.status === "rejected").length
    };

    const filterTrips = () => {
        return tripList.filter(trip => {
            const endDate = new Date(trip.endDate);
            endDate.setHours(23, 59, 59, 999);
            const isPast = endDate < now;
            const isCompleted = trip.status === "completed" || (trip.status === "accepted" && isPast);
            const isCancelled = trip.status === "cancelled" || trip.status === "rejected";
            const isPending = trip.status === "pending";
            const isUpcoming = trip.status === "accepted" && !isPast;

            if (activeTab === "all") return true;
            if (activeTab === "upcoming") return isUpcoming;
            if (activeTab === "pending") return isPending;
            if (activeTab === "completed") return isCompleted;
            if (activeTab === "cancelled") return isCancelled;
            return true;
        });
    };

    // Cancel Trip handler
    const handleCancelTrip = async () => {
        if (!tripToCancel) return;
        try {
            const response = await apiPatch(`/bookings/${tripToCancel._id}/cancel`, { cancelledBy: "guest" });

            if (response.ok) {
                dispatch(setToast({ message: "Trip cancelled successfully. Refund has been initiated.", type: "success" }));
                setCancelModalOpen(false);
                setTripToCancel(null);
                getTripList();
            } else {
                const data = await response.json();
                dispatch(setToast({ message: data.message || "Failed to cancel trip.", type: "error" }));
            }
        } catch (error) {
            console.error(error);
            dispatch(setToast({ message: "Error cancelling trip.", type: "error" }));
        }
    };

    // Review submit handler (supports both creating and editing reviews)
    const handleSubmitReview = async (e) => {
        e.preventDefault();
        if (!selectedTrip) return;

        try {
            let response;
            if (editingReview) {
                const reviewId = editingReview._id || editingReview.id;
                const endpoint = reviewId ? `/reviews/${reviewId}` : '/reviews';
                response = await apiPut(endpoint, {
                    reviewId,
                    bookingId: selectedTrip._id,
                    listingId: selectedTrip.listingId?._id || selectedTrip.listingId,
                    rating,
                    comment
                });
            } else {
                response = await apiPost('/reviews/create', {
                    listingId: selectedTrip.listingId._id || selectedTrip.listingId,
                    customerId: userId,
                    hostId: selectedTrip.hostId._id || selectedTrip.hostId,
                    rating,
                    comment,
                    reviewerType: "guest",
                    bookingId: selectedTrip._id
                });
            }

            if (response.ok) {
                dispatch(setToast({ 
                    message: editingReview ? "Review updated successfully!" : "Thank you for your review!", 
                    type: "success" 
                }));
                setReviewModalOpen(false);
                setEditingReview(null);
                setComment("");
                setRating(5);
                setSelectedTrip(null);
                getTripList();
            } else {
                const data = await response.json().catch(() => ({}));
                dispatch(setToast({ message: data.message || "Failed to submit review.", type: "error" }));
            }
        } catch (error) {
            console.error(error);
            dispatch(setToast({ message: "Error saving review.", type: "error" }));
        }
    };

    // Delete review handler (Author only)
    const handleDeleteReview = async (reviewId, bookingId) => {
        if (!window.confirm("Are you sure you want to delete your review?")) return;
        try {
            const endpoint = reviewId ? `/reviews/${reviewId}` : '/reviews';
            const response = await apiDelete(endpoint, { reviewId, bookingId });
            if (response.ok) {
                dispatch(setToast({ message: "Review deleted successfully.", type: "success" }));
                getTripList();
            } else {
                const data = await response.json().catch(() => ({}));
                dispatch(setToast({ message: data.message || "Failed to delete review.", type: "error" }));
            }
        } catch (error) {
            console.error(error);
            dispatch(setToast({ message: "Error deleting review.", type: "error" }));
        }
    };

    // Download / Print Invoice
    const handleDownloadInvoice = (trip) => {
        const printWindow = window.open("", "_blank");
        const nights = Math.max(1, Math.round((new Date(trip.endDate) - new Date(trip.startDate)) / (1000 * 60 * 60 * 24))) || 1;
        const discount = trip.discountAmount || 0;
        const subTotal = trip.listingId?.price 
            ? Math.round(trip.listingId.price * nights * 100) / 100
            : Math.round(((trip.totalPrice || 0) + discount) * 100) / 100;
        const ratePerNight = trip.listingId?.price || Math.round((subTotal / nights) * 100) / 100;
        const netRent = Math.max(0, Math.round((subTotal - discount) * 100) / 100);

        // SGST & CGST added into rent
        let sgst = 0;
        let cgst = 0;
        let finalTotal = 0;

        if (trip.totalPrice && trip.totalPrice > netRent) {
            const taxDiff = Math.round((trip.totalPrice - netRent) * 100) / 100;
            sgst = Math.round((taxDiff / 2) * 100) / 100;
            cgst = Math.round((taxDiff - sgst) * 100) / 100;
            finalTotal = trip.totalPrice;
        } else {
            sgst = Math.round((netRent * 0.09) * 100) / 100;
            cgst = Math.round((netRent * 0.09) * 100) / 100;
            finalTotal = Math.round((netRent + sgst + cgst) * 100) / 100;
        }

        printWindow.document.write(`
            <html>
            <head>
                <title>Invoice - MEETORA</title>
                <style>
                    body { font-family: 'Outfit', 'Segoe UI', Arial, sans-serif; color: #2d3748; padding: 40px; line-height: 1.6; background-color: #ffffff; }
                    .invoice-container { max-width: 800px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
                    .invoice-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #edf2f7; padding-bottom: 24px; margin-bottom: 30px; }
                    .brand-name { font-size: 26px; font-weight: 800; color: #22c55e; text-decoration: none; }
                    .invoice-label { font-size: 28px; font-weight: 700; text-transform: uppercase; color: #4a5568; letter-spacing: 1px; }
                    .invoice-details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 40px; }
                    .detail-block h3 { margin-top: 0; color: #718096; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
                    .detail-block p { margin: 4px 0; font-size: 15px; color: #1a202c; }
                    .invoice-table { width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 30px; }
                    .invoice-table th { background-color: #0f172a; color: #ffffff; font-weight: 600; font-size: 14px; text-transform: uppercase; padding: 14px; text-align: left; }
                    .invoice-table td { padding: 14px; border-bottom: 1px solid #edf2f7; font-size: 15px; color: #2d3748; }
                    .summary-section { display: flex; flex-direction: column; align-items: flex-end; margin-top: 20px; }
                    .summary-row { display: flex; justify-content: space-between; width: 340px; font-size: 15px; margin: 6px 0; color: #475569; }
                    .summary-row.discount-row { color: #16a34a; font-weight: 600; }
                    .summary-banner { background-color: #1e293b; color: #ffffff; display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; border-radius: 6px; width: 100%; box-sizing: border-box; margin-top: 14px; }
                    .note-footer { text-align: center; margin-top: 60px; font-size: 13px; color: #a0aec0; border-top: 1px solid #edf2f7; padding-top: 20px; }
                </style>
            </head>
            <body>
                <div class="invoice-container">
                    <div class="invoice-header">
                        <div class="brand-name">MEETORA</div>
                        <div class="invoice-label">Invoice</div>
                    </div>
                    
                    <div class="invoice-details-grid">
                        <div class="detail-block">
                            <h3>Billed To</h3>
                            <p><strong>${trip.customerId?.firstName || ''} ${trip.customerId?.lastName || ''}</strong></p>
                            <p>${trip.customerId?.email || ''}</p>
                        </div>
                        <div class="detail-block" style="text-align: right;">
                            <h3>Booking Summary</h3>
                            <p><strong>Invoice ID:</strong> ${trip.invoiceRef || ('INV-' + trip._id.toString().slice(-6).toUpperCase())}</p>
                            <p><strong>Date Issued:</strong> ${new Date(trip.createdAt || Date.now()).toLocaleDateString()}</p>
                            <p><strong>Reference ID:</strong> ${trip.paymentId || ('PAY-' + trip._id.toString().slice(-8).toUpperCase())}</p>
                        </div>
                    </div>

                    <div class="invoice-details-grid" style="border-top: 1px solid #edf2f7; padding-top: 20px;">
                        <div class="detail-block">
                            <h3>Accommodations</h3>
                            <div style="display: flex; gap: 16px; align-items: center; margin-top: 8px;">
                                <img 
                                    src="${resolveImageUrl(trip.listingId?.listingPhotoPaths?.[0], '/assets/default.jpg')}" 
                                    onerror="this.onerror=null;this.src='/assets/default.jpg'" 
                                    style="width: 80px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid #e2e8f0;" 
                                    alt="${trip.listingId?.title || 'Accommodation'}" 
                                />
                                <div>
                                    <p style="margin: 0; font-size: 15px;"><strong>${trip.listingId?.title || 'Listing Stay'}</strong></p>
                                    <p style="margin: 2px 0; color: #718096; font-size: 14px;">${trip.listingId?.city || ''}, ${trip.listingId?.province || ''}, ${trip.listingId?.country || ''}</p>
                                    <p style="margin: 2px 0; color: #a0aec0; font-size: 13px;">${trip.listingId?.category || ''} &bull; ${trip.listingId?.type || ''}</p>
                                </div>
                            </div>
                        </div>
                        <div class="detail-block" style="text-align: right;">
                            <h3>Stay Dates</h3>
                            <p><strong>Check-In:</strong> ${new Date(trip.startDate).toLocaleDateString()}</p>
                            <p><strong>Check-Out:</strong> ${new Date(trip.endDate).toLocaleDateString()}</p>
                            <p><strong>Total Nights:</strong> ${nights} Night${nights > 1 ? 's' : ''}</p>
                        </div>
                    </div>

                    <table class="invoice-table">
                        <thead>
                            <tr>
                                <th>Billing Item Description</th>
                                <th style="text-align: right;">Rate / Night</th>
                                <th style="text-align: center;">Nights</th>
                                <th style="text-align: right;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>${trip.listingId?.title || 'Property Stay'}</td>
                                <td style="text-align: right;">${formatPrice(ratePerNight)}</td>
                                <td style="text-align: center;">${nights}</td>
                                <td style="text-align: right;">${formatPrice(subTotal)}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div class="summary-section">
                        <div class="summary-row">
                            <span>Subtotal</span>
                            <span>${formatPrice(subTotal)}</span>
                        </div>
                        ${discount > 0 ? `
                        <div class="summary-row discount-row">
                            <span>Coupon (${trip.couponCode || 'Promo'}):</span>
                            <span>-${formatPrice(discount)}</span>
                        </div>` : ''}
                        <div class="summary-row">
                            <span>SGST (9%):</span>
                            <span>+${formatPrice(sgst)}</span>
                        </div>
                        <div class="summary-row">
                            <span>CGST (9%):</span>
                            <span>+${formatPrice(cgst)}</span>
                        </div>
                        <div class="summary-banner">
                            <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">TOTAL AMOUNT</div>
                            <div style="font-size: 24px; font-weight: 800;">${formatPrice(finalTotal)}</div>
                        </div>
                    </div>
                </div>
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(() => window.close(), 600);
                    }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    const currentFilteredTrips = filterTrips();

    return loading ? <Loader /> : (
        <div className='list-page'>
            <h1 className='title-list'>Your Trip List</h1>

            {/* Desktop Navigation Tabs */}
            <div className="trip-tabs desktop-only">
                <button 
                    className={activeTab === "all" ? "tab-btn active" : "tab-btn"} 
                    onClick={() => setActiveTab("all")}>
                    All Trips <span className="tab-pill">{tripCounts.all}</span>
                </button>
                <button 
                    className={activeTab === "upcoming" ? "tab-btn active" : "tab-btn"} 
                    onClick={() => setActiveTab("upcoming")}>
                    Upcoming <span className="tab-pill">{tripCounts.upcoming}</span>
                </button>
                <button 
                    className={activeTab === "pending" ? "tab-btn active" : "tab-btn"} 
                    onClick={() => setActiveTab("pending")}>
                    Pending <span className="tab-pill">{tripCounts.pending}</span>
                </button>
                <button 
                    className={activeTab === "completed" ? "tab-btn active" : "tab-btn"} 
                    onClick={() => setActiveTab("completed")}>
                    Completed <span className="tab-pill">{tripCounts.completed}</span>
                </button>
                <button 
                    className={activeTab === "cancelled" ? "tab-btn active" : "tab-btn"} 
                    onClick={() => setActiveTab("cancelled")}>
                    Cancelled <span className="tab-pill">{tripCounts.cancelled}</span>
                </button>
            </div>

            {/* Mobile Filter Dropdown (Zero horizontal scroll) */}
            <div className="mobile-status-filter-container mobile-only">
                <div className="status-select-card">
                    <div className="select-label">
                        <FilterList sx={{ fontSize: 18 }} />
                        <span>Status</span>
                    </div>
                    <div className="select-input-wrapper">
                        <select
                            value={activeTab}
                            onChange={(e) => setActiveTab(e.target.value)}
                            className="status-dropdown-select"
                        >
                            <option value="all">All Trips ({tripCounts.all})</option>
                            <option value="upcoming">Upcoming ({tripCounts.upcoming})</option>
                            <option value="pending">Pending ({tripCounts.pending})</option>
                            <option value="completed">Completed ({tripCounts.completed})</option>
                            <option value="cancelled">Cancelled ({tripCounts.cancelled})</option>
                        </select>
                        <KeyboardArrowDown className="select-arrow-icon" />
                    </div>
                </div>
            </div>

            <div className="list">
                {currentFilteredTrips.length > 0 ? (
                    currentFilteredTrips.map((trip) => {
                        const { _id, listingId, hostId, startDate, endDate, totalPrice, status } = trip;
                        if (!listingId) return null;
                        
                        const getListingPhoto = (listing) => {
                            if (!listing) return "/assets/default.jpg";
                            let photos = listing.listingPhotoPaths;
                            if (typeof photos === 'string') {
                                try { photos = JSON.parse(photos); } catch { photos = [photos]; }
                            }
                            const first = Array.isArray(photos) ? photos[0] : photos;
                            return resolveImageUrl(first, "/assets/default.jpg");
                        };

                        const isCompleted = status === "completed" || new Date(endDate) < now;

                        return (
                            <div key={_id} className="trip-card">
                                <img 
                                    className="property-image" 
                                    src={getListingPhoto(listingId)} 
                                    alt={listingId.title} 
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = "/assets/default.jpg";
                                    }}
                                />
                                
                                <div className="trip-details">
                                    <h3>{listingId.title}</h3>
                                    <p className="location">{listingId.city}, {listingId.province}, {listingId.country}</p>
                                    <p className="category">{listingId.category} • {listingId.type}</p>
                                    
                                    <div className="dates-info">
                                        <CalendarMonth sx={{ fontSize: "16px", color: "var(--text-color)" }} />
                                        <span>
                                            {new Date(startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} - {new Date(endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                    </div>

                                    <div className="price-info">
                                        <Payment sx={{ fontSize: "16px", color: "var(--text-color)" }} />
                                        <span>Total Price Paid: </span>{formatPrice(totalPrice)}
                                    </div>

                                    <div className="status-badge-container">
                                        Status: <span className={`status-badge ${status}`}>{(status || "").toUpperCase()}</span>
                                    </div>

                                    {trip.guestReview && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                                            <div className="review-box guest-review-box" style={{ padding: "10px", border: "1px solid rgba(34, 197, 94, 0.2)", borderRadius: "8px", background: "rgba(34, 197, 94, 0.02)" }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <strong style={{ fontSize: '13px', color: 'var(--text-color)' }}>Your Review:</strong>
                                                        <div style={{ display: 'flex' }}>
                                                            {[1, 2, 3, 4, 5].map((num) => (
                                                                num <= trip.guestReview.rating ? 
                                                                <Star key={num} sx={{ color: "#f59e0b", fontSize: 14 }} /> : 
                                                                <StarBorder key={num} sx={{ color: "#ccc", fontSize: 14 }} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="review-action-btns">
                                                        <button 
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedTrip(trip);
                                                                setEditingReview(trip.guestReview);
                                                                setRating(trip.guestReview.rating);
                                                                setComment(trip.guestReview.comment);
                                                                setReviewModalOpen(true);
                                                            }}>
                                                            <Edit sx={{ fontSize: 12 }} /> Edit
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            className="delete"
                                                            onClick={() => handleDeleteReview(trip.guestReview._id, trip._id)}>
                                                            <Delete sx={{ fontSize: 12 }} /> Delete
                                                        </button>
                                                    </div>
                                                </div>
                                                <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--secondary-text-color)", fontStyle: 'italic' }}>"{trip.guestReview.comment}"</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="trip-actions">
                                        {status === "cancelled" && (
                                            <span style={{ fontSize: "13px", fontWeight: "600", color: "#64748b" }}>
                                                {trip.cancelledBy === 'host'
                                                    ? 'Cancelled by Property Owner (Full Refund Issued)'
                                                    : trip.cancelledBy === 'admin'
                                                    ? 'Cancelled by Administrator (Refunded)'
                                                    : 'Cancelled by You'}
                                            </span>
                                        )}
                                        {/* Cancellation is strictly permitted ONLY before/during stay, NEVER once completed */}
                                        {status === "accepted" && new Date(endDate) >= now && (
                                            <button 
                                                className="cancel-btn"
                                                onClick={() => {
                                                    setTripToCancel(trip);
                                                    setCancelModalOpen(true);
                                                }}>
                                                <Cancel sx={{ fontSize: 15 }} /> Cancel Booking
                                            </button>
                                        )}
                                        {status !== "cancelled" && status !== "rejected" && (
                                            <button 
                                                className="invoice-btn"
                                                onClick={() => openAuthenticatedPdf(`/bookings/${_id}/invoice`)}>
                                                <Receipt sx={{ fontSize: 15 }} /> View Invoice
                                            </button>
                                        )}
                                        {isCompleted && status !== "cancelled" && status !== "rejected" && !trip.guestReview && (
                                            <button 
                                                className="review-btn"
                                                onClick={() => {
                                                    setSelectedTrip(trip);
                                                    setEditingReview(null);
                                                    setRating(5);
                                                    setComment("");
                                                    setReviewModalOpen(true);
                                                }}>
                                                <Star sx={{ fontSize: 15 }} /> Rate Host / Property
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <p className="no-trips" style={{ color: "var(--secondary-text-color)", fontSize: "18px", marginTop: "20px" }}>
                        No trips found in this category. Start booking properties to see them here!
                    </p>
                )}
            </div>

            {/* Custom Modal for Cancellations */}
            {cancelModalOpen && (
                <div className="custom-modal-overlay">
                    <div className="custom-modal">
                        <h2>Cancel Booking</h2>
                        <p>Are you sure you want to cancel your stay at <strong>{tripToCancel?.listingId?.title}</strong>?</p>
                        <p className="refund-notice">A full refund of {formatPrice(tripToCancel?.totalPrice)} will be processed back to your original payment method.</p>
                        <div className="modal-actions">
                            <button className="modal-cancel-btn" onClick={() => setCancelModalOpen(false)}>Keep Booking</button>
                            <button className="modal-confirm-btn" onClick={handleCancelTrip}>Confirm Cancellation</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Modal for Reviews */}
            {reviewModalOpen && (
                <div className="custom-modal-overlay">
                    <div className="custom-modal review-modal">
                        <h2>{editingReview ? "Edit Your Review" : "Rate & Review Stay"}</h2>
                        <p>{editingReview ? "Update your experience for " : "Share your experience at "}<strong>{selectedTrip?.listingId?.title}</strong></p>
                        <form onSubmit={handleSubmitReview}>
                            <div className="rating-select">
                                <label>Rating:</label>
                                <div className="stars">
                                    {[1, 2, 3, 4, 5].map((num) => (
                                        <span key={num} onClick={() => setRating(num)} style={{ cursor: "pointer" }}>
                                            {num <= rating ? (
                                                <Star sx={{ color: "#f59e0b", fontSize: 30 }} />
                                            ) : (
                                                <StarBorder sx={{ color: "#ccc", fontSize: 30 }} />
                                            )}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="comment-input">
                                <label>Your Review:</label>
                                <textarea 
                                    required 
                                    rows="4" 
                                    placeholder="What did you love about this place? How was the host?"
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="modal-cancel-btn" onClick={() => { setReviewModalOpen(false); setEditingReview(null); }}>Cancel</button>
                                <button type="submit" className="modal-confirm-btn">{editingReview ? "Save Changes" : "Submit Review"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default TripList
