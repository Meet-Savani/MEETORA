import React, { useEffect, useState } from 'react'
import '../../styles/List.scss'
import Loader from '../../components/Loader/Loader';
import { useDispatch, useSelector } from 'react-redux';
import { setReservationList, setToast } from '../../redux/state';
import { CalendarMonth, Email, Check, Close, Star, StarBorder, Receipt, FilterList, KeyboardArrowDown } from '@mui/icons-material';
import ReportDialog from '../../components/ReportDialog/ReportDialog';
import ConfirmationModal from '../../components/ConfirmationModal/ConfirmationModal';

import { useNavigate, useLocation } from 'react-router-dom';
import useCurrency from '../../hooks/useCurrency';
import { apiFetch, apiPatch, openAuthenticatedPdf } from '../../utils/api';
import { BACKEND_BASE_URL } from '../../config/constants';
import { resolveImageUrl } from '../../utils/image';

const ReservationList = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { formatPrice } = useCurrency();
    const user = useSelector((state) => state.user.user);
    const userId = user?._id;
    const reservationList = useSelector((state) => state.user.user?.reservationList || []);
    const [activeTab, setActiveTab] = useState(location.state?.tab || "upcoming");
    const [loading, setLoading] = useState(reservationList.length === 0);
    const [reportState, setReportState] = useState({ open: false, guestId: '' });
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [reservationToCancel, setReservationToCancel] = useState(null);

    useEffect(() => {
        if (location.state?.tab) {
            setActiveTab(location.state.tab);
        }
    }, [location.state]);

    useEffect(() => {
        if (!user || user.role !== 'host') {
            navigate('/');
        }
    }, [user, navigate]);

    // Guest Review Modal State removed — hosts cannot rate guests

    const dispatch = useDispatch();

    const getReservationList = async () => {
        if (!userId) return;

        try {
            const response = await apiFetch(`/users/${userId}/reservations`);

            const data = await response.json();
            dispatch(setReservationList(data.reservations || []));
            setLoading(false);
        } catch (error) {
            console.log("Reservation List fetched failed!", error);
            setLoading(false);
        }
    }

    useEffect(() => {
        getReservationList();

        // Real-time synchronization
        const pollInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                getReservationList();
            }
        }, 6000);

        const handleFocus = () => {
            getReservationList();
        };
        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleFocus);

        return () => {
            clearInterval(pollInterval);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleFocus);
        };
    }, [userId]);

    const handleUpdateStatus = async (bookingId, newStatus) => {
        try {
            const response = await apiPatch(`/bookings/${bookingId}/status`, { status: newStatus });

            if (response.ok) {
                dispatch(setToast({ message: `Reservation request ${newStatus === "accepted" ? "approved" : "rejected"} successfully.`, type: "success" }));
                getReservationList();
            } else {
                const data = await response.json();
                dispatch(setToast({ message: data.message || "Failed to update reservation status.", type: "error" }));
            }
        } catch (error) {
            console.error(error);
            dispatch(setToast({ message: "Error updating reservation status.", type: "error" }));
        }
    };

    const handleCancelReservation = async () => {
        if (!reservationToCancel) return;
        try {
            const response = await apiPatch(`/bookings/${reservationToCancel._id}/cancel`, { cancelledBy: "host" });
            if (response.ok) {
                dispatch(setToast({ message: "Reservation cancelled and full refund initiated for guest.", type: "success" }));
                setCancelModalOpen(false);
                setReservationToCancel(null);
                getReservationList();
            } else {
                const data = await response.json();
                dispatch(setToast({ message: data.message || "Failed to cancel reservation.", type: "error" }));
            }
        } catch (error) {
            console.error(error);
            dispatch(setToast({ message: "Error cancelling reservation.", type: "error" }));
        }
    };

    // Guest Review Modal functionality removed as per requirements restricting reviews to guests only.

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const resvCounts = {
        all: reservationList.length,
        upcoming: reservationList.filter(r => r.status === "accepted" && new Date(r.endDate) >= now).length,
        pending: reservationList.filter(r => r.status === "pending").length,
        completed: reservationList.filter(r => r.status === "completed" || (r.status === "accepted" && new Date(r.endDate) < now)).length,
        cancelled: reservationList.filter(r => r.status === "cancelled" || r.status === "rejected").length,
    };

    const filterReservations = () => {
        return reservationList.filter(resv => {
            const endDate = new Date(resv.endDate);
            endDate.setHours(23, 59, 59, 999);
            const isPast = endDate < now;
            const isCompleted = resv.status === "completed" || (resv.status === "accepted" && isPast);
            const isCancelled = resv.status === "cancelled" || resv.status === "rejected";
            const isPending = resv.status === "pending";
            const isUpcoming = resv.status === "accepted" && !isPast;

            if (activeTab === "all") return true;
            if (activeTab === "upcoming") return isUpcoming;
            if (activeTab === "pending") return isPending;
            if (activeTab === "completed") return isCompleted;
            if (activeTab === "cancelled") return isCancelled;
            return true;
        });
    };

    const currentFiltered = filterReservations();

    return loading ? (
        <Loader />
    ) : (
        <div className='list-page'>
            <h1 className='title-list'>Reservations on Your Properties</h1>
            
            {/* Tabbed view for reservations with filter badge counts */}
            <div className="trip-tabs desktop-only">
                <button 
                    className={activeTab === "all" ? "tab-btn active" : "tab-btn"} 
                    onClick={() => setActiveTab("all")}>
                    All Reservations <span className="tab-pill">{resvCounts.all}</span>
                </button>
                <button 
                    className={activeTab === "upcoming" ? "tab-btn active" : "tab-btn"} 
                    onClick={() => setActiveTab("upcoming")}>
                    Upcoming <span className="tab-pill">{resvCounts.upcoming}</span>
                </button>
                <button 
                    className={activeTab === "pending" ? "tab-btn active" : "tab-btn"} 
                    onClick={() => setActiveTab("pending")}>
                    Pending Requests <span className="tab-pill">{resvCounts.pending}</span>
                </button>
                <button 
                    className={activeTab === "completed" ? "tab-btn active" : "tab-btn"} 
                    onClick={() => setActiveTab("completed")}>
                    Completed Stays <span className="tab-pill">{resvCounts.completed}</span>
                </button>
                <button 
                    className={activeTab === "cancelled" ? "tab-btn active" : "tab-btn"} 
                    onClick={() => setActiveTab("cancelled")}>
                    Cancelled / Rejected <span className="tab-pill">{resvCounts.cancelled}</span>
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
                            <option value="all">All Reservations ({resvCounts.all})</option>
                            <option value="upcoming">Upcoming ({resvCounts.upcoming})</option>
                            <option value="pending">Pending Requests ({resvCounts.pending})</option>
                            <option value="completed">Completed Stays ({resvCounts.completed})</option>
                            <option value="cancelled">Cancelled / Rejected ({resvCounts.cancelled})</option>
                        </select>
                        <KeyboardArrowDown className="select-arrow-icon" />
                    </div>
                </div>
            </div>

            <div className="list">
                {currentFiltered && currentFiltered.length > 0 ? (
                    currentFiltered.map((reservation) => {
                        const { _id, listingId, customerId, startDate, endDate, totalPrice, status } = reservation;
                        if (!listingId) return null;
                        
                        const photoPath = resolveImageUrl(listingId.listingPhotoPaths && listingId.listingPhotoPaths[0], "/assets/default.jpg");
                        const customerAvatar = resolveImageUrl(customerId?.profileImagePath, "/assets/default.jpg");

                        return (
                            <div key={_id} className="reservation-card">
                                <img 
                                    className="property-image" 
                                    src={photoPath} 
                                    alt={listingId.title} 
                                    onError={(e) => {
                                        const clean = (listingId.listingPhotoPaths?.[0] || "").replaceAll("\\", "/").replace(/^public\//, "");
                                        if (clean && !e.target.src.endsWith(`/${clean}`)) {
                                            e.target.src = `/${clean}`;
                                        } else if (clean && !e.target.src.includes('localhost:3000')) {
                                            e.target.src = `http://localhost:3000/${clean}`;
                                        } else {
                                            e.target.onerror = null;
                                            e.target.src = "/assets/default.jpg";
                                        }
                                    }}
                                />
                                
                                <div className="reservation-details">
                                    <div>
                                        <h3>{listingId.title}</h3>
                                        <p>{listingId.city}, {listingId.province}, {listingId.country}</p>
                                        <p>{listingId.category} • {listingId.type}</p>
                                    </div>
                                    
                                    <div className="dates-info">
                                        <CalendarMonth sx={{ fontSize: "18px", color: "var(--text-color)" }} />
                                        <span>
                                            {new Date(startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} - {new Date(endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                    </div>

                                    <div className="price-info">
                                        <div>Total Booking Paid: <strong>{formatPrice(totalPrice)}</strong></div>
                                    </div>

                                    <div style={{ marginTop: "8px" }}>
                                        Status: <span className={`status-badge ${status}`}>{(status || "").toUpperCase()}</span>
                                    </div>

                                    <div className="reservation-actions" style={{ marginTop: "16px", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                                        {status === "cancelled" && (
                                            <span style={{ fontSize: "13px", fontWeight: "600", color: "#64748b" }}>
                                                {reservation.cancelledBy === 'host'
                                                    ? 'Cancelled by You (Owner)'
                                                    : reservation.cancelledBy === 'admin'
                                                    ? 'Cancelled by Administrator'
                                                    : 'Cancelled by Guest'}
                                            </span>
                                        )}
                                        {status === "pending" && (
                                            <>
                                                <button 
                                                    className="approve-btn"
                                                    style={{ background: "#48bb78", color: "white", padding: "8px 12px", border: "none", borderRadius: "6px", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: "600" }}
                                                    onClick={() => handleUpdateStatus(_id, "accepted")}>
                                                    <Check sx={{ fontSize: 16 }} /> Approve Request
                                                </button>
                                                <button 
                                                    className="reject-btn"
                                                    style={{ background: "#e53e3e", color: "white", padding: "8px 12px", border: "none", borderRadius: "6px", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: "600" }}
                                                    onClick={() => handleUpdateStatus(_id, "rejected")}>
                                                    <Close sx={{ fontSize: 16 }} /> Reject Request
                                                </button>
                                            </>
                                        )}

                                        {/* Cancellation is strictly permitted ONLY before/during stay, NEVER once completed */}
                                        {status === "accepted" && new Date(endDate) >= now && (
                                            <button 
                                                className="cancel-btn"
                                                style={{ background: "#fee2e2", color: "#ef4444", border: "1px solid #fca5a5", padding: "8px 14px", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}
                                                onClick={() => {
                                                    setReservationToCancel(reservation);
                                                    setCancelModalOpen(true);
                                                }}>
                                                <Close sx={{ fontSize: 16 }} /> Cancel & Refund
                                            </button>
                                        )}

                                        {status !== "cancelled" && status !== "rejected" && (
                                            <button 
                                                className="invoice-btn"
                                                style={{ background: "var(--primary-color, #22c55e)", color: "white", padding: "8px 12px", border: "none", borderRadius: "6px", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: "600" }}
                                                onClick={() => openAuthenticatedPdf(`/bookings/${_id}/invoice`)}>
                                                <Receipt sx={{ fontSize: 15 }} /> Invoice
                                            </button>
                                        )}

                                        {status !== "pending" && (
                                            <button 
                                                className="view-listing-btn"
                                                style={{ background: "var(--primary-color)", color: "white", padding: "8px 12px", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}
                                                onClick={() => navigate(`/properties/${listingId._id || listingId}`)}
                                            >
                                                View Listing & Reviews
                                            </button>
                                        )}

                                        {customerId && (
                                            <button 
                                                className="report-guest-btn"
                                                style={{ background: "#e53e3e", color: "white", padding: "8px 12px", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}
                                                onClick={() => setReportState({ open: true, guestId: customerId?._id || customerId })}
                                            >
                                                Report Guest
                                            </button>
                                        )}
                                    </div>
                                </div>
                                
                                {customerId && (
                                    <div className="customer-info">
                                        <img 
                                            className="customer-avatar" 
                                            src={customerAvatar} 
                                            alt={customerId.firstName} 
                                        />
                                        <div className="customer-meta">
                                            <span className="booked-by-label">Booked By</span>
                                            <span className="customer-name">{customerId.firstName} {customerId.lastName}</span>
                                            <span className="customer-email">
                                                <Email sx={{ fontSize: "12px", verticalAlign: "middle", marginRight: "3px" }} />
                                                {customerId.email}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <p className="no-reservations" style={{ color: "var(--secondary-text-color)", fontSize: "18px", marginTop: "20px" }}>
                        No reservations found in this category. Your guests' reservation history will appear here!
                    </p>
                )}
            </div>

            <ReportDialog 
                open={reportState.open} 
                onClose={() => setReportState({ open: false, guestId: '' })} 
                targetType="guest" 
                targetId={reportState.guestId} 
            />

            <ConfirmationModal
                open={cancelModalOpen}
                title="Cancel Reservation & Issue Refund"
                message={`Are you sure you want to cancel the reservation for "${reservationToCancel?.listingId?.title}"? A full refund of ${reservationToCancel ? formatPrice(reservationToCancel.totalPrice) : ''} will be credited to the guest.`}
                type="confirm"
                onConfirm={handleCancelReservation}
                onCancel={() => {
                    setCancelModalOpen(false);
                    setReservationToCancel(null);
                }}
            />
        </div>
    )
}

export default ReservationList
