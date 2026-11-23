import React, { useEffect, useState } from 'react'
import '../../styles/ListingDetails.scss'
import { useParams, useNavigate } from 'react-router-dom';
import { facilities } from '../../data';
import "react-date-range/dist/styles.css"
import "react-date-range/dist/theme/default.css"
import { DateRange } from "react-date-range"
import Navbar from '../../components/Navbar/Navbar';
import { useSelector, useDispatch } from 'react-redux';
import { setToast } from '../../redux/state';
import ReportDialog from '../../components/ReportDialog/ReportDialog';

import { EventBusy, Edit, Delete, CalendarMonth, ArrowBackIos, ArrowForwardIos, Star, StarBorder, Chat as ChatIcon, CheckCircle, Cancel } from '@mui/icons-material';
import { createPortal } from 'react-dom';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button as MuiButton } from '@mui/material';
import ConfirmationModal from '../../components/ConfirmationModal/ConfirmationModal';
import useCurrency from '../../hooks/useCurrency';
import { apiFetch, apiPatch, apiPost, apiPut, apiDelete } from '../../utils/api';
import { BACKEND_BASE_URL } from '../../config/constants';
import { resolveImageUrl } from '../../utils/image';
import { normalizeAmenities } from '../../utils/amenities';

const resolvePhotoUrl = (photo) => {
    return resolveImageUrl(photo, '/assets/default.jpg');
};

const ListingDetails = () => {

    const { formatPrice } = useCurrency();

    const { listingId } = useParams();
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [listing, setListing] = useState(null);
    const [bookings, setBookings] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [editRangeId, setEditRangeId] = useState(null);
    const [bookingInProgress, setBookingInProgress] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [popupImageIndex, setPopupImageIndex] = useState(null);
    const [reportState, setReportState] = useState({ open: false, targetType: 'listing', targetId: '' });

    const dispatch = useDispatch();

    const navigate = useNavigate();

    const photosRef = React.useRef(null);

    const scrollPrev = (e) => {
        if (e) e.stopPropagation();
        if (photosRef.current) {
            const width = photosRef.current.clientWidth;
            photosRef.current.scrollBy({ left: -width * 0.85, behavior: 'smooth' });
        }
    };

    const scrollNext = (e) => {
        if (e) e.stopPropagation();
        if (photosRef.current) {
            const width = photosRef.current.clientWidth;
            photosRef.current.scrollBy({ left: width * 0.85, behavior: 'smooth' });
        }
    };

    const [popupState, setPopupState] = useState({
        isOpen: false,
        title: "",
        message: "",
        type: "alert",
        onConfirm: null,
        onCancel: null
    });

    const showCustomAlert = (message, title = "Notification") => {
        setPopupState({
            isOpen: true,
            title,
            message,
            type: "alert",
            onConfirm: () => setPopupState(prev => ({ ...prev, isOpen: false })),
            onCancel: () => setPopupState(prev => ({ ...prev, isOpen: false }))
        });
    };

    const showCustomConfirm = (message, confirmCallback, title = "Confirm Action") => {
        setPopupState({
            isOpen: true,
            title,
            message,
            type: "confirm",
            onConfirm: () => {
                setPopupState(prev => ({ ...prev, isOpen: false }));
                confirmCallback();
            },
            onCancel: () => setPopupState(prev => ({ ...prev, isOpen: false }))
        });
    };

    const goToPrevPopupImage = (e) => {
        if (e) e.stopPropagation();
        if (!listing?.listingPhotoPaths?.length) return;
        setPopupImageIndex(prev => (prev > 0 ? prev - 1 : listing.listingPhotoPaths.length - 1));
    };

    const goToNextPopupImage = (e) => {
        if (e) e.stopPropagation();
        if (!listing?.listingPhotoPaths?.length) return;
        setPopupImageIndex(prev => (prev < listing.listingPhotoPaths.length - 1 ? prev + 1 : 0));
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (popupImageIndex === null) return;
            if (e.key === "ArrowLeft") {
                goToPrevPopupImage();
            } else if (e.key === "ArrowRight") {
                goToNextPopupImage();
            } else if (e.key === "Escape") {
                setPopupImageIndex(null);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [popupImageIndex, listing]);

    // Freeze page scroll when modal is open so screen is not scrollable until closed
    useEffect(() => {
        if (popupImageIndex !== null) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [popupImageIndex]);

    const getListingDetails = async () => {
        setLoading(true);
        setNotFound(false);
        try {
            const response = await apiFetch(`/properties/${listingId}`);

            if (!response.ok) {
                setNotFound(true);
                return;
            }

            const data = await response.json();
            if (!data.listing) {
                setNotFound(true);
                return;
            }
            setListing(data.listing);
            setBookings(data.bookings || []);
            setReviews(data.reviews || []);
        } catch (error) {
            console.log(error);
            setNotFound(true);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        getListingDetails();
    }, []);

    // Booking Calendar 
    const [dateRange, setDateRange] = useState([
        {
            startDate: new Date(),
            endDate: new Date(),
            key: "selection",
        }
    ]);

    const handleSelect = (ranges) => {
        // Update the selected date range when user makes a selection 
        setDateRange([ranges.selection])
    }

    const start = new Date(dateRange[0].startDate);
    const end = new Date(dateRange[0].endDate);

    let dayCount = 1;
    let baseRent = 0;
    let sgst = 0;
    let cgst = 0;
    let totalPrice = 0;

    if (listing) {
        dayCount = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
        if (dayCount < 1) dayCount = 1;
        baseRent = listing.price * dayCount;
        sgst = Math.round(baseRent * 0.09 * 100) / 100;
        cgst = Math.round(baseRent * 0.09 * 100) / 100;
        totalPrice = Math.round((baseRent + sgst + cgst) * 100) / 100;
    }

    const getDatesInRange = (startDate, endDate) => {
        const start = new Date(startDate);
        const end = new Date(endDate);

        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);

        const dates = [];
        let current = new Date(start);
        while (current <= end) {
            dates.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }
        return dates;
    };

    const disabledDates = [];
    bookings.forEach(booking => {
        if (booking.status === "cancelled" || booking.status === "rejected") {
            return;
        }
        const dates = getDatesInRange(booking.startDate, booking.endDate);
        disabledDates.push(...dates);
    });

    if (listing && listing.unavailableDates) {
        listing.unavailableDates.forEach(range => {
            // Exclude the blocked range currently being edited from disabled dates
            if (editRangeId && range._id?.toString() === editRangeId.toString()) {
                return;
            }
            const dates = getDatesInRange(range.startDate, range.endDate);
            disabledDates.push(...dates);
        });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maxBookingDate = new Date();
    maxBookingDate.setFullYear(maxBookingDate.getFullYear() + 2);
    maxBookingDate.setHours(23, 59, 59, 999);

    const user = useSelector(state => state.user.user);
    const customerId = user?._id;
    const creatorId = listing?.creator?._id || listing?.creator;
    const isOwner = customerId && creatorId && customerId.toString() === creatorId.toString();

    const [fetchedCreator, setFetchedCreator] = useState(null);

    useEffect(() => {
        const creator = listing?.creator;
        if (!creator) return;
        if (typeof creator === 'object' && (creator.firstName || creator.profileImagePath)) {
            setFetchedCreator(creator);
            return;
        }
        const cId = typeof creator === 'object' ? creator._id : creator;
        if (!cId || typeof cId !== 'string') return;

        let isMounted = true;
        apiFetch(`/users/${cId}`)
            .then(res => res.json())
            .then(data => {
                if (isMounted) {
                    if (data?.user) setFetchedCreator(data.user);
                    else if (data) setFetchedCreator(data);
                }
            })
            .catch(err => console.error("Error fetching creator:", err));

        return () => { isMounted = false; };
    }, [listing?.creator]);

    const activeHost = fetchedCreator || (typeof listing?.creator === 'object' ? listing.creator : null);
    const hostFirstName = activeHost?.firstName?.trim() || '';
    const hostLastName = activeHost?.lastName?.trim() || '';
    const hostFullName = [hostFirstName, hostLastName].filter(Boolean).join(' ') || 'Property Host';
    const hostInitials = (hostFirstName && hostLastName)
        ? `${hostFirstName[0]}${hostLastName[0]}`.toUpperCase()
        : (hostFirstName ? hostFirstName.slice(0, 2).toUpperCase() : 'PH');

    const [hostImgError, setHostImgError] = useState(false);
    const hostProfileImgUrl = resolveImageUrl(activeHost?.profileImagePath, null);

    useEffect(() => {
        setHostImgError(false);
    }, [activeHost?.profileImagePath]);

    // Admin property moderation handler
    const handleAdminModeration = async (action) => {
        try {
            const res = await apiPatch(`/admin/properties/${listingId}/approve`, { action });
            if (res.ok) {
                setListing(prev => ({ ...prev, isApproved: action }));
                showCustomAlert(`Property successfully ${action === 'approved' ? 'approved and is now live' : action}!`, "Success");
            } else {
                const data = await res.json();
                showCustomAlert(data.message || `Failed to ${action} property.`, "Error");
            }
        } catch (err) {
            console.error(err);
            showCustomAlert("Error updating property status.", "Error");
        }
    };

    // Owner blocked dates handlers
    const handleBlockDates = async () => {
        if (bookingInProgress) return;

        const start = new Date(dateRange[0].startDate);
        const end = new Date(dateRange[0].endDate);
        if (start < today || end < today) {
            showCustomAlert("Blocked dates cannot be in the past.", "Validation Error");
            return;
        }
        if (start > maxBookingDate || end > maxBookingDate) {
            showCustomAlert("Blocked dates cannot be more than 2 years in the future.", "Validation Error");
            return;
        }

        setBookingInProgress(true);
        try {
            const response = await apiPost(`/properties/${listingId}/unavailable-dates`, {
                startDate: dateRange[0].startDate.toDateString(),
                endDate: dateRange[0].endDate.toDateString(),
            });
            const data = await response.json();
            if (response.ok) {
                setListing(data.listing);
                showCustomAlert("Dates blocked successfully!", "Success");
            } else {
                showCustomAlert(data.message || "Failed to block dates.", "Error");
            }
        } catch (error) {
            console.error("Error blocking dates:", error);
        } finally {
            setBookingInProgress(false);
        }
    };

    const handleUpdateBlock = async () => {
        if (bookingInProgress) return;

        const start = new Date(dateRange[0].startDate);
        const end = new Date(dateRange[0].endDate);
        if (start < today || end < today) {
            showCustomAlert("Blocked dates cannot be in the past.", "Validation Error");
            return;
        }
        if (start > maxBookingDate || end > maxBookingDate) {
            showCustomAlert("Blocked dates cannot be more than 2 years in the future.", "Validation Error");
            return;
        }

        setBookingInProgress(true);
        try {
            const response = await apiPut(`/properties/${listingId}/unavailable-dates/${editRangeId}`, {
                startDate: dateRange[0].startDate.toDateString(),
                endDate: dateRange[0].endDate.toDateString(),
            });
            const data = await response.json();
            if (response.ok) {
                setListing(data.listing);
                setEditRangeId(null);
                showCustomAlert("Blocked dates updated successfully!", "Success");
            } else {
                showCustomAlert(data.message || "Failed to update blocked dates.", "Error");
            }
        } catch (error) {
            console.error("Error updating blocked dates:", error);
        } finally {
            setBookingInProgress(false);
        }
    };

    const handleRemoveBlock = async (rangeId) => {
        if (bookingInProgress) return;
        setBookingInProgress(true);
        try {
            const response = await apiDelete(`/properties/${listingId}/unavailable-dates/${rangeId}`);
            const data = await response.json();
            if (response.ok) {
                setListing(data.listing);
                showCustomAlert("Blocked dates removed successfully!", "Success");
            } else {
                showCustomAlert(data.message || "Failed to remove blocked dates.", "Error");
            }
        } catch (error) {
            console.error("Error removing blocked dates:", error);
        } finally {
            setBookingInProgress(false);
        }
    };

    const handleSubmit = async () => {
        if (bookingInProgress) return;
        if (!customerId) {
            setPopupState({
                isOpen: true,
                title: "Authentication Required",
                message: "Please login first to book a property.",
                type: "alert",
                onConfirm: () => {
                    setPopupState(prev => ({ ...prev, isOpen: false }));
                    navigate("/login");
                },
                onCancel: () => setPopupState(prev => ({ ...prev, isOpen: false }))
            });
            return;
        }

        const bookingStart = new Date(dateRange[0].startDate);
        const bookingEnd = new Date(dateRange[0].endDate);

        if (bookingStart < today || bookingEnd < today) {
            showCustomAlert("Booking dates cannot be in the past.", "Validation Error");
            return;
        }

        if (bookingStart > maxBookingDate || bookingEnd > maxBookingDate) {
            showCustomAlert("Booking dates cannot be more than 2 years in the future.", "Validation Error");
            return;
        }

        if (bookingEnd < bookingStart) {
            showCustomAlert("End date cannot be before start date.", "Validation Error");
            return;
        }

        const overlapsBookings = bookings.some(booking => {
            if (booking.status === "cancelled" || booking.status === "rejected") {
                return false;
            }
            const bStart = new Date(booking.startDate);
            const bEnd = new Date(booking.endDate);
            return bookingStart <= bEnd && bookingEnd >= bStart;
        });

        if (overlapsBookings) {
            showCustomAlert("Selected dates overlap with an existing booking.", "Overlap Warning");
            return;
        }

        const overlapsBlocked = (listing.unavailableDates || []).some(range => {
            const blockStart = new Date(range.startDate);
            const blockEnd = new Date(range.endDate);
            return bookingStart <= blockEnd && bookingEnd >= blockStart;
        });

        if (overlapsBlocked) {
            showCustomAlert("Selected dates overlap with unavailable dates set by the owner.", "Overlap Warning");
            return;
        }

        try {
            const bookingForm = {
                customerId,
                listingId,
                hostId: listing.creator._id || listing.creator,
                startDate: dateRange[0].startDate.toDateString(),
                endDate: dateRange[0].endDate.toDateString(),
                totalPrice: totalPrice,
                dayCount: dayCount
            };
            navigate("/checkout", {
                state: {
                    bookingForm,
                    listing
                }
            });
        } catch (error) {
            console.log("Redirect to checkout failed.", error);
        }
    }

    if (loading) {
        return (
            <div className="listing-skeleton">
                <div className="skeleton-shimmer skeleton-title" />
                <div className="skeleton-shimmer skeleton-photos" />
                <div className="skeleton-shimmer skeleton-line" />
                <div className="skeleton-shimmer skeleton-line short" />
            </div>
        );
    }

    if (notFound || !listing) {
        return (
            <div className="listing-not-found">
                <h2>Property doesn't exist</h2>
                <p>We couldn't find the property you're looking for. It may have been removed or the link is invalid.</p>
            </div>
        );
    }
    return (
        <>
            <div className='listing-details'>
                <button 
                    className="back-btn" 
                    onClick={() => {
                        if (user?.role === 'admin') {
                            navigate('/admin/properties');
                        } else {
                            navigate(-1);
                        }
                    }}
                >
                    <ArrowBackIos sx={{ fontSize: '16px' }} />
                    {user?.role === 'admin' ? 'Back to Admin Approvals' : 'Back'}
                </button>

                {/* Admin Verification & Moderation Banner */}
                {user?.role === 'admin' && (
                    <div className="admin-moderation-banner" style={{
                        backgroundColor: 'var(--card-bg)',
                        border: `1.5px solid ${listing.isApproved === 'approved' ? 'rgba(34, 197, 94, 0.4)' : listing.isApproved === 'pending' ? 'rgba(245, 158, 11, 0.4)' : listing.isApproved === 'paused' ? 'var(--border-color)' : 'rgba(239, 68, 68, 0.4)'}`,
                        borderRadius: '12px',
                        padding: '16px 20px',
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '14px',
                        color: 'var(--text-color)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <span style={{
                                fontSize: '12px',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                padding: '5px 14px',
                                borderRadius: '20px',
                                backgroundColor: listing.isApproved === 'approved' ? '#16a34a' : listing.isApproved === 'pending' ? '#d97706' : listing.isApproved === 'paused' ? '#64748b' : '#dc2626',
                                color: '#fff',
                                letterSpacing: '0.5px'
                            }}>
                                {listing.isApproved ? listing.isApproved.toUpperCase() : 'PENDING'}
                            </span>
                            <div>
                                <div style={{ fontSize: '15px', color: 'var(--text-color)', fontWeight: 700 }}>
                                    {listing.isApproved === 'pending'
                                        ? 'Property Approval Required'
                                        : `Moderation Status: ${(listing.isApproved || 'pending').toUpperCase()}`}
                                </div>
                                <div style={{ color: 'var(--secondary-text-color)', fontSize: '13px', marginTop: '2px' }}>
                                    Submitted by Owner: <strong>{hostFullName}</strong> {activeHost?.email ? `(${activeHost.email})` : ''} {activeHost?.isVerified ? '• Verified Host' : ''}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            {listing.isApproved !== 'approved' && (
                                <button
                                    onClick={() => handleAdminModeration('approved')}
                                    style={{
                                        background: '#16a34a',
                                        color: '#fff',
                                        border: 'none',
                                        padding: '9px 18px',
                                        borderRadius: '8px',
                                        fontWeight: 700,
                                        fontSize: '13.5px',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <CheckCircle sx={{ fontSize: 18 }} /> Accept & Approve Property
                                </button>
                            )}
                            {listing.isApproved === 'approved' && (
                                <button
                                    onClick={() => handleAdminModeration('paused')}
                                    style={{
                                        background: '#f59e0b',
                                        color: '#fff',
                                        border: 'none',
                                        padding: '9px 16px',
                                        borderRadius: '8px',
                                        fontWeight: 700,
                                        fontSize: '13.5px',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    Pause Listing
                                </button>
                            )}
                            {listing.isApproved !== 'rejected' && (
                                <button
                                    onClick={() => handleAdminModeration('rejected')}
                                    style={{
                                        background: '#ef4444',
                                        color: '#fff',
                                        border: 'none',
                                        padding: '9px 16px',
                                        borderRadius: '8px',
                                        fontWeight: 700,
                                        fontSize: '13.5px',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <Cancel sx={{ fontSize: 18 }} /> Reject Property
                                </button>
                            )}
                            {listing.isApproved !== 'suspended' && (
                                <button
                                    onClick={() => handleAdminModeration('suspended')}
                                    style={{
                                        background: '#475569',
                                        color: '#fff',
                                        border: 'none',
                                        padding: '9px 14px',
                                        borderRadius: '8px',
                                        fontWeight: 600,
                                        fontSize: '13px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Suspend
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Owner Pending Notice */}
                {isOwner && listing.isApproved === 'pending' && user?.role !== 'admin' && (
                    <div style={{
                        backgroundColor: 'var(--card-bg)',
                        border: '1.5px solid rgba(245, 158, 11, 0.4)',
                        borderRadius: '12px',
                        padding: '14px 20px',
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        color: 'var(--text-color)'
                    }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', padding: '4px 10px', borderRadius: '16px', backgroundColor: '#d97706', color: '#fff' }}>
                            Under Review
                        </span>
                        <span style={{ fontSize: '13.5px', fontWeight: 600 }}>
                            Your property is pending review by the admin team. You can inspect all details below; once accepted, it will become publicly bookable.
                        </span>
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '8px' }}>
                    <div className="title">
                        <h1>{listing.title}</h1>
                        {reviews.length > 0 ? (
                            <div className="rating-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '15px', fontWeight: '500', color: 'var(--text-color)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                <Star sx={{ color: "#f59e0b", fontSize: 18, verticalAlign: 'middle' }} />
                                <span>{(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)}</span>
                                <span style={{ color: 'var(--secondary-text-color)', margin: '0 2px' }}>•</span>
                                <span
                                    style={{ textDecoration: 'underline', cursor: 'pointer', color: 'var(--secondary-text-color)', fontWeight: '600' }}
                                    onClick={() => {
                                        document.getElementById("reviews-section")?.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                >
                                    {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
                                </span>
                            </div>
                        ) : (
                            <div className="rating-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '15px', color: 'var(--secondary-text-color)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                <StarBorder sx={{ fontSize: 18, verticalAlign: 'middle' }} />
                                <span style={{ whiteSpace: 'nowrap' }}>No reviews yet</span>
                            </div>
                        )}
                    </div>
                    {isOwner && (
                        <button
                            className="owner-edit-btn"
                            onClick={() => navigate(`/properties/${listingId}/edit`)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 20px',
                                backgroundColor: 'var(--primary-color, #f8395a)',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: '600',
                                fontSize: '15px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: '0 2px 8px rgba(248, 57, 90, 0.25)',
                                marginTop: '4px'
                            }}
                        >
                            <Edit sx={{ fontSize: 18 }} /> Edit Property
                        </button>
                    )}
                </div>

                <div className="photos-container">
                    <div className="photos" ref={photosRef}>
                        {listing?.listingPhotoPaths && listing.listingPhotoPaths.length > 0 ? (
                            listing.listingPhotoPaths.map((item, index) => (
                                <img
                                    key={index}
                                    src={resolvePhotoUrl(item)}
                                    alt={`listing photo ${index + 1}`}
                                    onClick={() => setPopupImageIndex(index)}
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = "/assets/default.jpg";
                                    }}
                                />
                            ))
                        ) : (
                            <img
                                src="/assets/default.jpg"
                                alt={listing?.title || "listing photo"}
                                onClick={() => setPopupImageIndex(0)}
                            />
                        )}
                    </div>
                    {listing?.listingPhotoPaths?.length > 1 && (
                        <>
                            <button className="slider-btn prev" onClick={scrollPrev}>
                                <ArrowBackIos sx={{ fontSize: "16px", transform: "translateX(2px)" }} />
                            </button>
                            <button className="slider-btn next" onClick={scrollNext}>
                                <ArrowForwardIos sx={{ fontSize: "16px" }} />
                            </button>
                        </>
                    )}
                </div>

                <h2>
                    {listing.type} in {listing.city}, {listing.province}, {" "}
                    {listing.country}
                </h2>
                <p>
                    {listing.guestCount} guests - {listing.bedroomCount} bedroom(s) -{" "} {listing.bedCount} bed(s) - {listing.bathroomCount} bathroom(s)
                </p>
                <hr />

                <div className="profile" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div className="host-avatar-container" style={{ width: '56px', height: '56px', minWidth: '56px', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--primary-light-alpha, rgba(34, 197, 94, 0.25))', backgroundColor: 'var(--input-bg, #f1f5f9)', flexShrink: 0 }}>
                        {hostProfileImgUrl && !hostImgError ? (
                            <img 
                                src={hostProfileImgUrl} 
                                alt={hostFullName} 
                                onError={() => setHostImgError(true)} 
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: '50%' }}
                            />
                        ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', fontSize: '18px', fontWeight: '700', userSelect: 'none' }}>
                                {hostInitials}
                            </div>
                        )}
                    </div>
                    <div>
                        <span className="owner-name" style={{ fontWeight: '600', color: 'var(--text-color)', fontSize: '16px', display: 'block' }}>{hostFullName}</span>
                        <span style={{ fontSize: '13px', color: 'var(--secondary-text-color)' }}>Property Host</span>
                    </div>
                    {user && activeHost && user.isVerified && activeHost.isVerified && (
                        <button className="chat-icon-btn" onClick={() => navigate(`/chat/${activeHost._id || creatorId}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: '8px' }}>
                            <ChatIcon sx={{ fontSize: 24, color: 'var(--primary-color)' }} />
                        </button>
                    )}
                    {user && activeHost && user._id !== (activeHost._id || creatorId) && (
                        <button 
                            className="report-host-btn" 
                            onClick={() => setReportState({ open: true, targetType: 'host', targetId: activeHost._id || creatorId })}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: 'auto', fontWeight: '600' }}
                        >
                            Report Host
                        </button>
                    )}
                </div>
                <hr />

                <h3>Description</h3>
                <p>{listing.description}</p>
                <hr />

                <h3>{listing.highlight}</h3>
                <p>{listing.highlightDesc}</p>
                <hr />

                <div className="booking">
                    <div>
                        <h2>What this place offers?</h2>
                        <div className='amenities'>
                            {(() => {
                                const cleanAmenities = normalizeAmenities(listing.amenities);
                                return cleanAmenities.length > 0 ? (
                                    cleanAmenities.map((item, index) => {
                                        const facility = facilities.find(
                                            (f) => f.name.trim().toLowerCase() === item.toLowerCase()
                                        );
                                        return (
                                            <div className="facility" key={index}>
                                                <div className='facility_icon'>
                                                    {facility?.icon || <CheckCircle sx={{ fontSize: 26, color: 'var(--primary-color, #22c55e)' }} />}
                                                </div>
                                                <p>{item}</p>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p style={{ color: 'var(--secondary-text-color)', fontStyle: 'italic' }}>No amenities listed.</p>
                                );
                            })()}
                        </div>
                    </div>

                    <div>
                        <h2>{isOwner ? "Manage Availability" : "How long do you want to stay?"}</h2>
                        <div className="date-range-calendar">
                            <div className="calendar-wrapper">
                                <DateRange
                                    ranges={dateRange}
                                    onChange={handleSelect}
                                    minDate={today}
                                    maxDate={maxBookingDate}
                                    disabledDates={disabledDates}
                                />
                            </div>

                            {!isOwner ? (
                                <div className="guest-booking-card">
                                    <div className="booking-card-header">
                                        <div className="rate-display">
                                            <span className="price-val">{formatPrice(listing.price)}</span>
                                            <span className="per-night">/ night</span>
                                        </div>
                                        <span className="stay-badge">
                                            {dayCount} {dayCount > 1 ? "nights" : "night"}
                                        </span>
                                    </div>

                                    <div className="booking-dates-box">
                                        <div className="date-field">
                                            <span className="date-label">Check-in</span>
                                            <span className="date-value">
                                                {dateRange[0].startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                            </span>
                                        </div>
                                        <div className="date-arrow">→</div>
                                        <div className="date-field">
                                            <span className="date-label">Check-out</span>
                                            <span className="date-value">
                                                {dateRange[0].endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="price-breakdown">
                                        <div className="breakdown-row">
                                            <span>Base Rent ({formatPrice(listing.price)} × {dayCount}d)</span>
                                            <span className="breakdown-val">{formatPrice(baseRent)}</span>
                                        </div>
                                        <div className="breakdown-row tax-row">
                                            <span>SGST (9%)</span>
                                            <span className="breakdown-val">+{formatPrice(sgst)}</span>
                                        </div>
                                        <div className="breakdown-row tax-row">
                                            <span>CGST (9%)</span>
                                            <span className="breakdown-val">+{formatPrice(cgst)}</span>
                                        </div>
                                        <div className="breakdown-divider" />
                                        <div className="breakdown-row total-row">
                                            <span>Total to Pay</span>
                                            <span className="total-amount">{formatPrice(totalPrice)}</span>
                                        </div>
                                    </div>

                                    <div className="booking-actions">
                                        <button
                                            className="reserve-btn"
                                            type="submit"
                                            onClick={handleSubmit}
                                            disabled={bookingInProgress}
                                        >
                                            {bookingInProgress ? "BOOKING..." : "RESERVE PROPERTY"}
                                        </button>
                                        <button
                                            className="message-btn"
                                            type="button"
                                            onClick={() => navigate(`/chat/${creatorId}`)}
                                            disabled={bookingInProgress}
                                        >
                                            Message Host
                                        </button>
                                        <button
                                            className="report-btn"
                                            type="button"
                                            onClick={() => setReportState({ open: true, targetType: 'listing', targetId: listingId })}
                                            disabled={bookingInProgress}
                                        >
                                            Report Listing
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="owner-availability-panel">
                                    <div className="panel-header">
                                        <EventBusy sx={{ color: "var(--text-color)", fontSize: "24px" }} />
                                        <h3>Manage Unavailability</h3>
                                    </div>

                                    <div className="selected-range-card">
                                        <CalendarMonth className="icon" />
                                        <div className="dates">
                                            <div>
                                                <span className="label">Start:</span>
                                                <span className="val">{dateRange[0].startDate.toLocaleDateString()}</span>
                                            </div>
                                            <div>
                                                <span className="label">End:</span>
                                                <span className="val">{dateRange[0].endDate.toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {editRangeId ? (
                                        <div className="edit-actions">
                                            <button
                                                className="button update-btn"
                                                onClick={handleUpdateBlock}
                                                disabled={bookingInProgress}
                                            >
                                                {bookingInProgress ? "UPDATING..." : "Update Block"}
                                            </button>
                                            <button
                                                className="button cancel-btn"
                                                onClick={() => {
                                                    setEditRangeId(null);
                                                    setDateRange([{ startDate: new Date(), endDate: new Date(), key: "selection" }]);
                                                }}
                                                disabled={bookingInProgress}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            className="button block-btn"
                                            onClick={handleBlockDates}
                                            disabled={bookingInProgress}
                                        >
                                            {bookingInProgress ? "BLOCKING..." : "Block Selected Dates"}
                                        </button>
                                    )}

                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {isOwner && (
                    <>
                        <hr />
                        <div className="blocked-dates-section">
                            <h2>Currently Blocked Ranges</h2>
                            <p className="subtitle">These dates are unavailable for guests to book.</p>

                            <div className="blocked-grid">
                                {listing.unavailableDates && listing.unavailableDates.length > 0 ? (
                                    listing.unavailableDates.map((range) => (
                                        <div key={range._id} className="blocked-card">
                                            <div className="card-dates">
                                                <div className="date-box">
                                                    <span className="label">START DATE</span>
                                                    <span className="value">{new Date(range.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                                </div>
                                                <div className="date-divider">→</div>
                                                <div className="date-box">
                                                    <span className="label">END DATE</span>
                                                    <span className="value">{new Date(range.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                                </div>
                                            </div>
                                            <div className="card-actions">
                                                <button
                                                    className="btn-edit"
                                                    onClick={() => {
                                                        setEditRangeId(range._id);
                                                        setDateRange([
                                                            {
                                                                startDate: new Date(range.startDate),
                                                                endDate: new Date(range.endDate),
                                                                key: "selection",
                                                            }
                                                        ]);
                                                        const calendarEl = document.querySelector('.date-range-calendar');
                                                        if (calendarEl) {
                                                            window.scrollTo({ top: calendarEl.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
                                                        }
                                                    }}
                                                    disabled={bookingInProgress}
                                                >
                                                    <Edit sx={{ fontSize: "16px" }} /> Edit
                                                </button>
                                                <button
                                                    className="btn-delete"
                                                    onClick={() => {
                                                        showCustomConfirm(
                                                            "Are you sure you want to delete this unavailable date? This action cannot be undone.",
                                                            () => handleRemoveBlock(range._id),
                                                            "Confirm Deletion"
                                                        );
                                                    }}
                                                    disabled={bookingInProgress}
                                                >
                                                    <Delete sx={{ fontSize: "16px" }} /> Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="no-blocks">No blocked dates. Select dates in the calendar to block.</p>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* Reviews Section */}
                <hr />
                <div id="reviews-section" className="reviews-section" style={{ padding: '20px 0' }}>
                    <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '20px', color: 'var(--text-color)' }}>Guest Reviews ({reviews.length})</h2>
                    {reviews.length > 0 ? (
                        <div className="reviews-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
                            {reviews.map((rev) => {
                                const guestPhoto = resolveImageUrl(rev.customerId?.profileImagePath, "/assets/default.jpg");
                                return (
                                    <div key={rev._id} className="review-card" style={{ padding: '20px', border: '1px solid var(--border-color, #edf2f7)', borderRadius: '12px', background: 'var(--card-bg, #fff)', color: 'var(--text-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                                        <div className="review-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                            <img 
                                                src={guestPhoto} 
                                                alt={rev.customerId?.firstName || "Guest"} 
                                                className="reviewer-avatar" 
                                                onError={(e) => { e.target.onerror = null; e.target.src = "/assets/default.jpg"; }} 
                                                style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }} 
                                            />
                                            <div className="reviewer-info">
                                                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text-color)' }}>{rev.customerId?.firstName || "Guest"} {rev.customerId?.lastName || ""}</h4>
                                                <span className="review-date" style={{ fontSize: '12px', color: 'var(--secondary-text-color)' }}>{new Date(rev.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
                                            </div>
                                            <div className="review-stars" style={{ marginLeft: 'auto', display: 'flex', gap: '2px' }}>
                                                {[1, 2, 3, 4, 5].map((num) => (
                                                    num <= rev.rating ?
                                                        <Star key={num} sx={{ color: "#f59e0b", fontSize: 16 }} /> :
                                                        <StarBorder key={num} sx={{ color: "#ccc", fontSize: 16 }} />
                                                ))}
                                            </div>
                                        </div>
                                        <p className="review-comment" style={{ margin: 0, fontSize: '14px', color: 'var(--text-color)', lineHeight: '1.5', fontStyle: 'italic' }}>"{rev.comment}"</p>
                                        {user && user._id !== rev.customerId?._id && (
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                                                <button 
                                                    className="report-review-btn"
                                                    onClick={() => setReportState({ open: true, targetType: 'review', targetId: rev._id })}
                                                    style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}
                                                >
                                                    Report Review
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="no-reviews" style={{ fontStyle: 'italic', color: 'var(--secondary-text-color)', marginTop: '15px' }}>No guest reviews yet for this property.</p>
                    )}
                </div>
            </div>

            {popupImageIndex !== null && listing?.listingPhotoPaths && listing.listingPhotoPaths.length > 0 && typeof document !== 'undefined' && createPortal(
                <div className="image-popup-overlay" onClick={() => setPopupImageIndex(null)}>
                    <div className="image-popup-content" onClick={(e) => e.stopPropagation()}>
                        <div className="popup-topbar">
                            <div className="popup-counter">
                                {popupImageIndex + 1} / {listing.listingPhotoPaths.length}
                            </div>
                            <button 
                                className="close-popup" 
                                onClick={() => setPopupImageIndex(null)}
                                aria-label="Close image popup"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="popup-slider-viewport">
                            {listing.listingPhotoPaths.length > 1 && (
                                <button 
                                    className="popup-nav-btn prev" 
                                    onClick={goToPrevPopupImage}
                                    aria-label="Previous photo"
                                >
                                    <ArrowBackIos sx={{ fontSize: "20px", transform: "translateX(2px)" }} />
                                </button>
                            )}

                            <div 
                                className="popup-slider-track"
                                style={{ transform: `translateX(-${popupImageIndex * 100}%)` }}
                            >
                                {listing.listingPhotoPaths.map((photo, index) => (
                                    <div className="popup-slide" key={index}>
                                        <img
                                            src={resolvePhotoUrl(photo)}
                                            alt={`${listing.title || 'Property'} photo ${index + 1}`}
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                e.target.src = "/assets/default.jpg";
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>

                            {listing.listingPhotoPaths.length > 1 && (
                                <button 
                                    className="popup-nav-btn next" 
                                    onClick={goToNextPopupImage}
                                    aria-label="Next photo"
                                >
                                    <ArrowForwardIos sx={{ fontSize: "20px" }} />
                                </button>
                            )}
                        </div>

                        {listing.listingPhotoPaths.length > 1 && (
                            <div className="popup-thumbnails-bar">
                                {listing.listingPhotoPaths.map((photo, index) => (
                                    <div
                                        key={index}
                                        className={`popup-thumb-item ${index === popupImageIndex ? 'active' : ''}`}
                                        onClick={() => setPopupImageIndex(index)}
                                    >
                                        <img
                                            src={resolvePhotoUrl(photo)}
                                            alt={`thumbnail ${index + 1}`}
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                e.target.src = "/assets/default.jpg";
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}

            <ConfirmationModal
                open={popupState.isOpen}
                title={popupState.title}
                message={popupState.message}
                type={popupState.type}
                onConfirm={popupState.onConfirm}
                onCancel={popupState.onCancel}
            />
            <PaymentDialog open={showPaymentModal} onClose={() => setShowPaymentModal(false)} />
            <ReportDialog 
                open={reportState.open} 
                onClose={() => setReportState(prev => ({ ...prev, open: false }))} 
                targetType={reportState.targetType} 
                targetId={reportState.targetId} 
            />
        </>
    )
}

// Payment Form Modal
const PaymentFormModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;
    const handleSubmit = (e) => {
        e.preventDefault();
        console.log('Payment submitted');
        onClose();
    };
    return createPortal(
        <div className="confirmation-modal-overlay" onClick={onClose}>
            <div className="confirmation-modal-content" onClick={(e) => e.stopPropagation()}>
                <h3>Complete Your Payment</h3>
                <form onSubmit={handleSubmit} className="payment-form">
                    <div className="form-group">
                        <label>Name on Card</label>
                        <input type="text" required />
                    </div>
                    <div className="form-group">
                        <label>Card Number</label>
                        <input type="text" required />
                    </div>
                    <div className="form-group row">
                        <div className="col">
                            <label>Expiry</label>
                            <input type="text" placeholder="MM/YY" required />
                        </div>
                        <div className="col">
                            <label>CVV</label>
                            <input type="password" required />
                        </div>
                    </div>
                    <div className="modal-actions" style={{ justifyContent: "flex-end" }}>
                        <button type="button" className="modal-btn cancel-btn" onClick={onClose}>Cancel</button>
                        <button type="submit" className="modal-btn confirm-btn">Pay Now</button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

const PaymentDialog = ({ open, onClose }) => {
    const handleSubmit = (e) => {
        e.preventDefault();
        console.log('Payment submitted');
        onClose();
    };
    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: '16px', bgcolor: 'var(--bg-color)', color: 'var(--text-color)' } }}>
            <DialogTitle sx={{ textAlign: 'center' }}>Complete Your Payment</DialogTitle>
            <DialogContent>
                <form onSubmit={handleSubmit} className="payment-form">
                    <TextField fullWidth margin="dense" label="Name on Card" required />
                    <TextField fullWidth margin="dense" label="Card Number" required />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <TextField label="Expiry" placeholder="MM/YY" required sx={{ flex: 1 }} />
                        <TextField label="CVV" type="password" required sx={{ flex: 1 }} />
                    </div>
                    <DialogActions sx={{ mt: 1, justifyContent: 'flex-end' }}>
                        <MuiButton onClick={onClose} variant="outlined" color="inherit" className="modal-btn cancel-btn">Cancel</MuiButton>
                        <MuiButton type="submit" variant="contained" color="primary" className="modal-btn confirm-btn">Pay Now</MuiButton>
                    </DialogActions>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default ListingDetails;
