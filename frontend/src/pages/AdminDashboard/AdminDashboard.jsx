import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import Loader from '../../components/Loader/Loader';
import {
    Dashboard, People, HomeWork, ReceiptLong, CheckCircle,
    Cancel, Star, StarBorder, BarChart as ChartIcon, Receipt, Campaign, AddCircle, Delete, Edit,
    LocalOffer, Percent, RateReview, Flag, SupportAgent, ListAlt, Home, Menu, OpenInNew, Visibility,
    FilterList, KeyboardArrowDown, AssignmentInd, ChatBubbleOutline, NotificationsNone
} from '@mui/icons-material';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { setToast } from '../../redux/state';
import '../../styles/AdminDashboard.scss';
import ConfirmationModal from '../../components/ConfirmationModal/ConfirmationModal';
import DataTable from '../../components/DataTable/DataTable';
import StatCard from '../../components/StatCard/StatCard';
import { apiFetch, apiPatch, apiPost, apiPut, apiDelete, openAuthenticatedPdf } from '../../utils/api';
import ThemeToggle from '../../components/ThemeToggle/ThemeToggle';
import { resolveImageUrl } from '../../utils/image';
import { normalizeAmenities } from '../../utils/amenities';
import { broadcastSync, subscribeSync } from '../../utils/syncEvents';

const DonutChart = ({ data = [], colors = [] }) => {
    const [hoveredIdx, setHoveredIdx] = useState(null);
    const total = data.reduce((sum, item) => sum + (Number(item.value) || 0), 0) || 0;

    let runningPercent = 0;
    const slices = data.map((item, idx) => {
        const value = Number(item.value) || 0;
        const percent = total > 0 ? (value / total) * 100 : 0;
        const offset = 100 - runningPercent;
        runningPercent += percent;
        return {
            ...item,
            value,
            percent,
            formattedPercent: percent.toFixed(1),
            strokeDasharray: `${percent} ${Math.max(0, 100 - percent)}`,
            strokeDashoffset: offset,
            color: colors[idx % colors.length] || '#22c55e'
        };
    });

    const activeItem = hoveredIdx !== null ? slices[hoveredIdx] : null;

    return (
        <div 
            className="donut-chart-container" 
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%' }}
            onMouseLeave={() => setHoveredIdx(null)}
        >
            <div style={{ position: 'relative', width: '180px', height: '180px' }}>
                <svg 
                    width="180" 
                    height="180" 
                    viewBox="0 0 42 42" 
                    style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%', overflow: 'visible' }}
                >
                    {/* Background track circle */}
                    <circle 
                        cx="21" 
                        cy="21" 
                        r="15.91549430918954" 
                        fill="none" 
                        stroke="var(--border-color, #f1f5f9)" 
                        strokeWidth="3.5" 
                    />

                    {/* Slices */}
                    {slices.map((slice, idx) => {
                        if (slice.percent <= 0) return null;
                        const isHovered = hoveredIdx === idx;

                        return (
                            <g key={idx}>
                                {/* Visual rendering stroke - pointerEvents none to eliminate jitter */}
                                <circle
                                    cx="21"
                                    cy="21"
                                    r="15.91549430918954"
                                    fill="none"
                                    stroke={slice.color}
                                    strokeWidth={isHovered ? "5.2" : "3.6"}
                                    strokeDasharray={slice.strokeDasharray}
                                    strokeDashoffset={slice.strokeDashoffset}
                                    style={{
                                        transition: 'stroke-width 0.15s ease, opacity 0.15s ease',
                                        opacity: hoveredIdx !== null && !isHovered ? 0.35 : 1,
                                        pointerEvents: 'none'
                                    }}
                                />
                                {/* Broad invisible hit-zone for effortless hover capture */}
                                <circle
                                    cx="21"
                                    cy="21"
                                    r="15.91549430918954"
                                    fill="none"
                                    stroke="transparent"
                                    strokeWidth="8"
                                    strokeDasharray={slice.strokeDasharray}
                                    strokeDashoffset={slice.strokeDashoffset}
                                    onMouseEnter={() => setHoveredIdx(idx)}
                                    style={{
                                        cursor: 'pointer',
                                        pointerEvents: 'stroke'
                                    }}
                                />
                            </g>
                        );
                    })}
                </svg>

                {/* Center Stats Display */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '12px', pointerEvents: 'none' }}>
                    {activeItem ? (
                        <>
                            <span style={{ fontSize: '19px', fontWeight: '800', color: activeItem.color, lineHeight: '1.2' }}>
                                {activeItem.formattedPercent}%
                            </span>
                            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-color)', marginTop: '2px' }}>
                                {activeItem.value.toLocaleString()}
                            </span>
                            <span 
                                title={activeItem.name}
                                style={{ 
                                    fontSize: '10px', 
                                    color: 'var(--secondary-text-color)', 
                                    fontWeight: '600', 
                                    textAlign: 'center', 
                                    marginTop: '2px', 
                                    maxWidth: '85%', 
                                    overflow: 'hidden', 
                                    textOverflow: 'ellipsis', 
                                    whiteSpace: 'nowrap' 
                                }}
                            >
                                {activeItem.name}
                            </span>
                        </>
                    ) : (
                        <>
                            <span style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-color)', textAlign: 'center', maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {total.toLocaleString()}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--secondary-text-color)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center', marginTop: '2px' }}>
                                Total
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Interactive Legend */}
            <div className="chart-legend" style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', maxHeight: '130px', overflowY: 'auto', paddingRight: '4px' }}>
                {slices.map((slice, idx) => {
                    const isHovered = hoveredIdx === idx;
                    return (
                        <div
                            key={idx}
                            onMouseEnter={() => setHoveredIdx(idx)}
                            onMouseLeave={() => setHoveredIdx(null)}
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px', 
                                fontSize: '11px', 
                                cursor: 'pointer', 
                                padding: '3px 6px',
                                borderRadius: '6px',
                                background: isHovered ? 'var(--input-bg, #f1f5f9)' : 'transparent',
                                opacity: hoveredIdx === null || isHovered ? 1 : 0.45, 
                                transition: 'all 0.15s ease', 
                                transform: isHovered ? 'scale(1.02)' : 'none' 
                            }}
                        >
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: slice.color, display: 'inline-block', flexShrink: 0 }}></span>
                            <span style={{ color: 'var(--text-color)', fontWeight: isHovered ? '700' : '500', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={slice.name}>{slice.name}</span>
                            <span style={{ color: isHovered ? slice.color : 'var(--secondary-text-color)', marginLeft: 'auto', fontWeight: 'bold', flexShrink: 0 }}>
                                {slice.value} ({slice.formattedPercent}%)
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Interactive Widget for Trip Booking Statuses
const TripBookingStatusesWidget = ({ bookings = [] }) => {
    const getBookingStatus = (booking) => {
        if (booking.status === "completed") return "Completed";
        if (booking.status === "pending") return "Pending";
        if (booking.status === "accepted") return "Approved";
        if (booking.status === "rejected") return "Rejected";
        if (booking.status === "cancelled") return "Cancelled";
        return booking.status;
    };

    const statusCounts = bookings.reduce((acc, b) => {
        const status = getBookingStatus(b);
        if (acc[status] !== undefined) {
            acc[status]++;
        }
        return acc;
    }, {
        Completed: 0,
        Pending: 0,
        Approved: 0,
        Rejected: 0,
        Cancelled: 0
    });

    const chartData = [
        { name: "Completed", value: statusCounts.Completed },
        { name: "Pending", value: statusCounts.Pending },
        { name: "Approved", value: statusCounts.Approved },
        { name: "Rejected", value: statusCounts.Rejected },
        { name: "Cancelled", value: statusCounts.Cancelled }
    ];

    const chartColors = ["#22c55e", "#eab308", "#3b82f6", "#f97316", "#ef4444"];

    return (
        <div className="trip-booking-statuses-widget" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%' }}>
            <DonutChart data={chartData} colors={chartColors} />
        </div>
    );
};

// Custom Vertical Bar Chart Component
const BarChart = ({ data = [] }) => {
    const [hoveredIdx, setHoveredIdx] = useState(null);
    const maxVal = Math.max(...data.map(d => d.revenue), 100);
    const chartHeight = 160;
    const chartWidth = 500;
    const padding = 30;

    return (
        <div className="bar-chart-container" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <svg 
                viewBox={`0 0 ${chartWidth} ${chartHeight + padding}`} 
                preserveAspectRatio="xMidYMid meet"
                style={{ width: '100%', height: 'auto', maxHeight: '220px', display: 'block', margin: '0 auto' }}
            >
                <defs>
                    <linearGradient id="barGradientAdmin" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" />
                        <stop offset="100%" stopColor="#16a34a" />
                    </linearGradient>
                    <linearGradient id="barGradientHover" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4ade80" />
                        <stop offset="100%" stopColor="#22c55e" />
                    </linearGradient>
                </defs>

                {/* Y-axis gridlines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                    const y = chartHeight - (chartHeight * ratio) + 10;
                    const val = Math.round(maxVal * ratio);
                    return (
                        <g key={idx}>
                            <line x1="45" y1={y} x2={chartWidth - 10} y2={y} stroke="var(--border-color, #e2e8f0)" strokeWidth="1" strokeDasharray="3 3" />
                            <text x="5" y={y + 4} style={{ fontSize: '10px', fill: 'var(--secondary-text-color)', fontWeight: '600' }}>
                                ${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val}
                            </text>
                        </g>
                    );
                })}

                {/* Bars */}
                {data.map((item, idx) => {
                    const barWidth = 22;
                    const spacing = (chartWidth - 60) / data.length;
                    const x = 55 + (idx * spacing);
                    const barHeight = (item.revenue / maxVal) * (chartHeight - 20);
                    const y = chartHeight - barHeight + 10;
                    const isHovered = hoveredIdx === idx;

                    return (
                        <g
                            key={idx}
                            onMouseEnter={() => setHoveredIdx(idx)}
                            onMouseLeave={() => setHoveredIdx(null)}
                            style={{ cursor: 'pointer' }}
                        >
                            <rect
                                x={x}
                                y={y}
                                width={barWidth}
                                height={barHeight}
                                rx="4"
                                fill={isHovered ? "url(#barGradientHover)" : "url(#barGradientAdmin)"}
                                style={{ transition: 'all 0.2s ease' }}
                            />
                            {/* Hover Value Label Indicator */}
                            {isHovered && (
                                <g>
                                    <rect
                                        x={x - 24}
                                        y={y - 30}
                                        width={barWidth + 48}
                                        height={22}
                                        rx={4}
                                        fill="var(--text-color, #1e293b)"
                                    />
                                    <text
                                        x={x + barWidth / 2}
                                        y={y - 15}
                                        textAnchor="middle"
                                        fill="var(--bg-color, #fff)"
                                        style={{ fontSize: '10px', fontWeight: 'bold' }}
                                    >
                                        ${item.revenue.toLocaleString()}
                                    </text>
                                </g>
                            )}
                            <text
                                x={x + barWidth / 2}
                                y={chartHeight + 25}
                                textAnchor="middle"
                                style={{ fontSize: '10px', fill: 'var(--secondary-text-color)', fontWeight: 'bold' }}
                            >
                                {item.month}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

const AdminDashboard = () => {
    const user = useSelector((state) => state.user.user);
    const navigate = useNavigate();
    const dispatch = useDispatch();

    // Check if role is admin
    useEffect(() => {
        if (!user || user.role !== 'admin') {
            navigate('/');
        }
    }, [user]);

    const [loading, setLoading] = useState(true);
    const { tab } = useParams();
    const activeTab = (!tab || tab === "dashboard") ? "overview" : tab;

    // States for various lists
    const [stats, setStats] = useState({ totalUsers: 0, totalHosts: 0, totalProperties: 0, totalRevenue: 0, hostFeesCollected: 0, netIncome: 0, todayRevenue: 0, todayBookings: 0, pendingApprovals: 0 });
    const [growthStats, setGrowthStats] = useState({});
    const [categoryStats, setCategoryStats] = useState([]);
    const [userRoleStats, setUserRoleStats] = useState([]);
    const [bookingStatusStats, setBookingStatusStats] = useState([]);
    const [propertyStatusStats, setPropertyStatusStats] = useState([]);
    const [propertyTypeStats, setPropertyTypeStats] = useState([]);
    const [propertyCategoryStats, setPropertyCategoryStats] = useState([]);
    const [monthlyStats, setMonthlyStats] = useState([]);
    const [users, setUsers] = useState([]);
    const [properties, setProperties] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [roleFilter, setRoleFilter] = useState('all');
    const [propertyStatusFilter, setPropertyStatusFilter] = useState('all');
    const [bookingStatusFilter, setBookingStatusFilter] = useState('all');



    // Coupons States
    const [coupons, setCoupons] = useState([]);
    const [couponCode, setCouponCode] = useState("");
    const [couponDiscountType, setCouponDiscountType] = useState("percentage");
    const [couponDiscountValue, setCouponDiscountValue] = useState(10);
    const [couponStartDate, setCouponStartDate] = useState("");
    const [couponEndDate, setCouponEndDate] = useState("");
    const [couponUsageLimit, setCouponUsageLimit] = useState("");
    const [editingCoupon, setEditingCoupon] = useState(null);

    // Commission settings
    const [platformFeePercent, setPlatformFeePercent] = useState(5);
    const [hostFeePercent, setHostFeePercent] = useState(3);
    const [guestFeePercent, setGuestFeePercent] = useState(0);

    // Reviews states
    const [reviews, setReviews] = useState([]);
    const [viewReview, setViewReview] = useState(null);

    // Reports states
    const [reports, setReports] = useState([]);

    // Delete Confirmation Modal State
    const [deleteModalState, setDeleteModalState] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null
    });

    // Host Requests state
    const [hostRequests, setHostRequests] = useState([]);
    // Unread notifications count
    const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);

    // Mobile Responsive Sidebar State
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    // Desktop Responsive Sidebar State (open by default on laptop)
    const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);

    // Theme state
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

    useEffect(() => {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const fetchAllData = async () => {
        try {
            // Parallel fetch using Promise.all
            const [
                statsRes,
                usersRes,
                propRes,
                bookRes,
                couponsRes,
                settingsRes,
                reviewsRes,
                reportsRes,
                hostReqRes,
                notifRes
            ] = await Promise.all([
                apiFetch('/admin/stats').catch(e => null),
                apiFetch('/admin/users').catch(e => null),
                apiFetch('/admin/properties').catch(e => null),
                apiFetch('/admin/bookings').catch(e => null),
                apiFetch('/admin/coupons').catch(e => null),
                apiFetch('/admin/settings').catch(e => null),
                apiFetch('/admin/reviews').catch(e => null),
                apiFetch('/admin/reports').catch(e => null),
                apiFetch('/admin/host-requests').catch(e => null),
                user?._id ? apiFetch(`/notifications/${user._id}`).catch(e => null) : null
            ]);

            if (statsRes && statsRes.ok) {
                const statsData = await statsRes.json();
                setStats(statsData.stats || {});
                setGrowthStats(statsData.growthStats || {});
                setCategoryStats(statsData.categoryStats || []);
                setUserRoleStats(statsData.userRoleStats || []);
                setBookingStatusStats(statsData.bookingStatusStats || []);
                setPropertyStatusStats(statsData.propertyStatusStats || []);
                setPropertyTypeStats(statsData.propertyTypeStats || []);
                setPropertyCategoryStats(statsData.propertyCategoryStats || []);
                setMonthlyStats(statsData.monthlyStats || []);
            }
            if (usersRes && usersRes.ok) {
                const usersData = await usersRes.json();
                setUsers(dataSort(usersData.users || []));
            }
            if (propRes && propRes.ok) {
                const propData = await propRes.json();
                setProperties(dataSort(propData.properties || []));
            }
            if (bookRes && bookRes.ok) {
                const bookData = await bookRes.json();
                setBookings(dataSort(bookData.bookings || []));
            }
            if (couponsRes && couponsRes.ok) {
                const couponsData = await couponsRes.json();
                setCoupons(couponsData.coupons || []);
            }
            if (settingsRes && settingsRes.ok) {
                const settingsData = await settingsRes.json();
                const s = settingsData.settings || {};
                setPlatformFeePercent(s.platformFeePercent ?? 5);
                setHostFeePercent(s.hostFeePercent ?? 3);
                setGuestFeePercent(s.guestFeePercent ?? 0);
            }
            if (reviewsRes && reviewsRes.ok) {
                const reviewsData = await reviewsRes.json();
                setReviews(reviewsData.reviews || []);
            }
            if (reportsRes && reportsRes.ok) {
                const reportsData = await reportsRes.json();
                setReports(reportsData.reports || []);
            }
            if (hostReqRes && hostReqRes.ok) {
                const hostReqData = await hostReqRes.json();
                setHostRequests(hostReqData.requests || []);
            }
            if (notifRes && notifRes.ok) {
                const notifData = await notifRes.json();
                const fetchedNotifs = notifData.notifications || [];
                setUnreadNotifsCount(fetchedNotifs.filter(n => !n.isRead).length);
            }
        } catch (err) {
            console.error("Error loading administrative data:", err);
        } finally {
            setLoading(false);
        }
    };

    const dataSort = (arr) => {
        return [...arr].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    };

    useEffect(() => {
        if (user && user.role === 'admin') {
            fetchAllData();

            // Real-time synchronization for admin monitoring (instant sync + 3s fallback)
            const pollInterval = setInterval(() => {
                if (document.visibilityState === 'visible') {
                    fetchAllData();
                }
            }, 3000);

            const handleFocus = () => {
                fetchAllData();
            };
            window.addEventListener('focus', handleFocus);
            document.addEventListener('visibilitychange', handleFocus);

            const unsubscribe = subscribeSync(() => {
                fetchAllData();
            });

            return () => {
                clearInterval(pollInterval);
                window.removeEventListener('focus', handleFocus);
                document.removeEventListener('visibilitychange', handleFocus);
                unsubscribe();
            };
        }
    }, [user]);

    // Action handlers
    const [roleModalState, setRoleModalState] = useState({
        isOpen: false,
        userId: null,
        userName: '',
        targetRole: '',
        currentRole: '',
    });

    const handleRoleChangeRequest = (userId, targetRole, userName, currentRole) => {
        if (!targetRole || targetRole === currentRole) return;
        setRoleModalState({
            isOpen: true,
            userId,
            userName: userName || 'User',
            targetRole,
            currentRole,
        });
    };

    const confirmRoleChange = async () => {
        const { userId, targetRole, userName } = roleModalState;
        setRoleModalState(prev => ({ ...prev, isOpen: false }));
        if (!userId || !targetRole) return;

        try {
            const res = await apiPatch(`/admin/users/${userId}/role`, { role: targetRole });
            const data = await res.json();
            if (res.ok) {
                dispatch(setToast({ 
                    message: data.message || `Role for ${userName} changed to ${targetRole}.`, 
                    type: "success" 
                }));
                broadcastSync('USER_ROLE_UPDATED', { userId, role: targetRole });
                fetchAllData();
            } else {
                dispatch(setToast({ 
                    message: data.message || "Failed to update user role.", 
                    type: "error" 
                }));
            }
        } catch (err) {
            console.error("Error updating user role:", err);
            dispatch(setToast({ message: "An error occurred while updating user role.", type: "error" }));
        }
    };

    const toggleUserVerification = async (userId) => {
        try {
            const res = await apiPatch(`/admin/users/${userId}/verify`, {});
            if (res.ok) {
                dispatch(setToast({ message: "Role toggled successfully.", type: "success" }));
                fetchAllData();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const approveListing = async (listingId, action) => {
        try {
            const res = await apiPatch(`/admin/properties/${listingId}/approve`, { action });
            if (res.ok) {
                dispatch(setToast({ message: `Listing ${action} successfully.`, type: "success" }));
                broadcastSync('PROPERTY_MODERATED', { listingId, action });
                fetchAllData();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const toggleFeatured = async (listingId) => {
        try {
            const res = await apiPatch(`/admin/properties/${listingId}/feature`, {});
            if (res.ok) {
                dispatch(setToast({ message: "Featured status changed successfully.", type: "success" }));
                fetchAllData();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const [refundModal, setRefundModal] = useState({ isOpen: false, bookingId: null });

    const handleRefundClick = (bookingId) => {
        setRefundModal({ isOpen: true, bookingId });
    };

    const confirmRefund = async () => {
        const bookingId = refundModal.bookingId;
        try {
            const res = await apiPatch(`/admin/bookings/${bookingId}/refund`, {});
            if (res.ok) {
                dispatch(setToast({ message: "Booking cancelled and refund processed.", type: "success" }));
                fetchAllData();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setRefundModal({ isOpen: false, bookingId: null });
        }
    };

    const cancelRefund = () => {
        setRefundModal({ isOpen: false, bookingId: null });
    };

    // original refundBooking function now replaced by UI handler
    // const refundBooking = async (bookingId) => { ... };




    // Coupon actions
    const handleCreateCoupon = async (e) => {
        e.preventDefault();
        if (couponUsageLimit !== "" && couponUsageLimit !== null && couponUsageLimit !== undefined) {
            const limitNum = Number(couponUsageLimit);
            if (isNaN(limitNum) || !Number.isInteger(limitNum) || limitNum <= 0) {
                dispatch(setToast({ message: "Coupon quantity must be a positive number (minimum 1).", type: "error" }));
                return;
            }
            if (limitNum > 100) {
                dispatch(setToast({ message: "Coupon quantity cannot exceed 100. (Max qty is 100)", type: "error" }));
                return;
            }
        }
        try {
            const body = {
                code: couponCode,
                discountType: couponDiscountType,
                discountValue: parseFloat(couponDiscountValue),
                startDate: couponStartDate,
                endDate: couponEndDate,
                usageLimit: (couponUsageLimit !== "" && couponUsageLimit !== null && couponUsageLimit !== undefined) ? parseInt(couponUsageLimit, 10) : null
            };
            const res = await apiPost('/admin/coupons', body);
            const data = await res.json();
            if (res.ok) {
                dispatch(setToast({ message: data.message || "Coupon created successfully.", type: "success" }));
                setCouponCode("");
                setCouponStartDate("");
                setCouponEndDate("");
                setCouponUsageLimit("");
                fetchAllData();
            } else {
                dispatch(setToast({ message: data.message || "Error creating coupon.", type: "error" }));
            }
        } catch (err) {
            console.error(err);
            dispatch(setToast({ message: "Network error occurred.", type: "error" }));
        }
    };

    const handleDeleteCoupon = (couponId) => {
        setDeleteModalState({
            isOpen: true,
            title: "Delete Coupon",
            message: "Are you sure you want to delete this coupon? This action cannot be undone.",
            onConfirm: async () => {
                try {
                    const res = await apiDelete(`/admin/coupons/${couponId}`);
                    if (res.ok) {
                        dispatch(setToast({ message: "Coupon deleted successfully.", type: "success" }));
                        fetchAllData();
                    } else {
                        dispatch(setToast({ message: "Error deleting coupon.", type: "error" }));
                    }
                } catch (err) {
                    console.error(err);
                } finally {
                    setDeleteModalState(prev => ({ ...prev, isOpen: false }));
                }
            }
        });
    };

    const handleOpenEditCoupon = (c) => {
        setEditingCoupon({
            _id: c._id,
            code: c.code || '',
            discountType: c.discountType || 'percentage',
            discountValue: c.discountValue !== undefined ? c.discountValue : 10,
            startDate: c.startDate ? new Date(c.startDate).toISOString().slice(0, 10) : '',
            endDate: c.endDate ? new Date(c.endDate).toISOString().slice(0, 10) : '',
            usageLimit: (c.usageLimit !== null && c.usageLimit !== undefined) ? c.usageLimit : '',
            usageCount: c.usageCount || 0,
            isActive: (c.usageLimit !== null && c.usageLimit !== undefined && (c.usageCount || 0) >= c.usageLimit) ? false : (c.isActive !== undefined ? c.isActive : true)
        });
    };

    const handleUpdateCoupon = async (e) => {
        e.preventDefault();
        if (!editingCoupon) return;
        if (editingCoupon.usageLimit !== "" && editingCoupon.usageLimit !== null && editingCoupon.usageLimit !== undefined) {
            const limitNum = Number(editingCoupon.usageLimit);
            if (isNaN(limitNum) || !Number.isInteger(limitNum) || limitNum <= 0) {
                dispatch(setToast({ message: "Coupon quantity must be a positive number (minimum 1).", type: "error" }));
                return;
            }
            if (limitNum > 100) {
                dispatch(setToast({ message: "Coupon quantity cannot exceed 100. (Max qty is 100)", type: "error" }));
                return;
            }
        }
        try {
            const parsedLimit = (editingCoupon.usageLimit !== "" && editingCoupon.usageLimit !== null && editingCoupon.usageLimit !== undefined) ? parseInt(editingCoupon.usageLimit, 10) : null;
            const isLimitFilled = parsedLimit !== null && (editingCoupon.usageCount || 0) >= parsedLimit;

            const body = {
                code: editingCoupon.code,
                discountType: editingCoupon.discountType,
                discountValue: parseFloat(editingCoupon.discountValue),
                startDate: editingCoupon.startDate,
                endDate: editingCoupon.endDate,
                usageLimit: parsedLimit,
                isActive: isLimitFilled ? false : Boolean(editingCoupon.isActive)
            };
            const res = await apiPut(`/admin/coupons/${editingCoupon._id}`, body);
            const data = await res.json();
            if (res.ok) {
                dispatch(setToast({ message: data.message || "Coupon updated successfully.", type: "success" }));
                setEditingCoupon(null);
                fetchAllData();
            } else {
                dispatch(setToast({ message: data.message || "Error updating coupon.", type: "error" }));
            }
        } catch (err) {
            console.error(err);
            dispatch(setToast({ message: "Network error occurred while updating coupon.", type: "error" }));
        }
    };

    // Settings actions
    const handleUpdateSettings = async (e) => {
        e.preventDefault();
        try {
            const res = await apiPut('/admin/settings', {
                platformFeePercent: parseFloat(platformFeePercent),
                hostFeePercent: parseFloat(hostFeePercent),
                guestFeePercent: parseFloat(guestFeePercent)
            });
            if (res.ok) {
                dispatch(setToast({ message: "Settings updated successfully.", type: "success" }));
                fetchAllData();
            } else {
                dispatch(setToast({ message: "Error updating settings.", type: "error" }));
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Review actions (Reviews are read-only for admin/hosts; only guest author can edit/delete)

    // Report actions
    const handleResolveReport = async (reportId, status, listingId) => {
        try {
            const res = await apiPatch(`/admin/reports/${reportId}`, { status });
            if (res.ok) {
                if (status === 'resolved' && listingId) {
                    // Suspend listing
                    await apiPatch(`/admin/properties/${listingId}/approve`, { action: 'suspended' });
                    dispatch(setToast({ message: "Report resolved and listing suspended.", type: "success" }));
                } else {
                    dispatch(setToast({ message: `Report ${status} successfully.`, type: "success" }));
                }
                fetchAllData();
            } else {
                dispatch(setToast({ message: "Error resolving report.", type: "error" }));
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Host Request actions
    const handleApproveHost = async (userId) => {
        try {
            const res = await apiPatch(`/admin/users/${userId}/approve-host`, {});
            if (res.ok) {
                dispatch(setToast({ message: "Host application approved successfully.", type: "success" }));
                broadcastSync('HOST_STATUS_UPDATED', { userId, status: 'approved' });
                fetchAllData();
            } else {
                dispatch(setToast({ message: "Failed to approve host.", type: "error" }));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleRejectHost = async (userId) => {
        try {
            const res = await apiPatch(`/admin/users/${userId}/reject-host`, {});
            if (res.ok) {
                dispatch(setToast({ message: "Host application rejected.", type: "success" }));
                broadcastSync('HOST_STATUS_UPDATED', { userId, status: 'rejected' });
                fetchAllData();
            } else {
                dispatch(setToast({ message: "Failed to reject host.", type: "error" }));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const pendingPropertiesCount = properties.filter(p => (p.isApproved || 'pending') === 'pending').length;
    const approvedPropertiesCount = properties.filter(p => p.isApproved === 'approved').length;
    const pausedPropertiesCount = properties.filter(p => p.isApproved === 'paused').length;
    const rejectedPropertiesCount = properties.filter(p => p.isApproved === 'rejected').length;
    const suspendedPropertiesCount = properties.filter(p => p.isApproved === 'suspended').length;
    const filteredProperties = properties.filter(p => {
        if (propertyStatusFilter === 'all') return true;
        const status = p.isApproved || 'pending';
        return status === propertyStatusFilter;
    });

    const bookingNow = new Date();
    bookingNow.setHours(0, 0, 0, 0);

    const bookingCounts = {
        all: bookings.length,
        upcoming: bookings.filter(b => b.status === "accepted" && new Date(b.endDate) >= bookingNow).length,
        pending: bookings.filter(b => b.status === "pending").length,
        completed: bookings.filter(b => b.status === "completed" || (b.status === "accepted" && new Date(b.endDate) < bookingNow)).length,
        cancelled: bookings.filter(b => b.status === "cancelled" || b.status === "rejected").length,
    };

    const filteredBookings = bookings.filter(b => {
        const endDate = new Date(b.endDate);
        endDate.setHours(23, 59, 59, 999);
        const isPast = endDate < bookingNow;
        const isCompleted = b.status === "completed" || (b.status === "accepted" && isPast);
        const isCancelled = b.status === "cancelled" || b.status === "rejected";
        const isPending = b.status === "pending";
        const isUpcoming = b.status === "accepted" && !isPast;

        if (bookingStatusFilter === 'all') return true;
        if (bookingStatusFilter === 'upcoming') return isUpcoming;
        if (bookingStatusFilter === 'pending') return isPending;
        if (bookingStatusFilter === 'completed') return isCompleted;
        if (bookingStatusFilter === 'cancelled') return isCancelled;
        return true;
    });
    const pendingHostRequestsCount = hostRequests.length;
    const pendingReportsCount = reports.filter(r => r.status === 'pending').length;

    return loading ? <Loader /> : (
        <div className="admin-dashboard-page">
            {/* Sidebar backdrop overlay for mobile drawer */}
            {mobileSidebarOpen && (
                <div className="sidebar-backdrop" onClick={() => setMobileSidebarOpen(false)} />
            )}

            {/* Sidebar navigation */}
            <div className={`admin-sidebar ${mobileSidebarOpen ? 'open' : ''} ${!desktopSidebarOpen ? 'desktop-collapsed' : ''}`}>
                <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 className="sidebar-brand-title">Admin Panel</h2>
                    <div className="sidebar-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button 
                            className="desktop-toggle-btn"
                            onClick={() => setDesktopSidebarOpen(!desktopSidebarOpen)}
                            title={desktopSidebarOpen ? "Stick Sidebar to Left" : "Expand Sidebar"}
                            aria-label="Toggle Sidebar"
                        >
                            <Menu sx={{ fontSize: 22 }} />
                        </button>
                        <button className="mobile-close-sidebar" onClick={() => setMobileSidebarOpen(false)}>
                            &times;
                        </button>
                    </div>
                </div>
                <div className="sidebar-menu">
                    <button
                        className={activeTab === "overview" ? "menu-item active" : "menu-item"}
                        onClick={() => { navigate("/admin/dashboard"); setMobileSidebarOpen(false); }}
                        title="Overview"
                    >
                        <Dashboard /> <span className="menu-text">Overview</span>
                    </button>
                    <button
                        className={activeTab === "analysis" ? "menu-item active" : "menu-item"}
                        onClick={() => { navigate("/admin/analysis"); setMobileSidebarOpen(false); }}
                        title="Analysis"
                    >
                        <ChartIcon /> <span className="menu-text">Analysis</span>
                    </button>
                    <button
                        className={activeTab === "users" ? "menu-item active" : "menu-item"}
                        onClick={() => { navigate("/admin/users"); setMobileSidebarOpen(false); }}
                        title="User Moderation"
                    >
                        <People /> <span className="menu-text">User Moderation</span>
                    </button>
                    <button
                        className={activeTab === "host-requests" ? "menu-item active" : "menu-item"}
                        onClick={() => { navigate("/admin/host-requests"); setMobileSidebarOpen(false); }}
                        title="Host Applications"
                    >
                        <AssignmentInd /> <span className="menu-text">Host Applications</span>
                        {pendingHostRequestsCount > 0 && (
                            <span className="sidebar-badge">{pendingHostRequestsCount}</span>
                        )}
                    </button>
                    <button
                        className={activeTab === "properties" ? "menu-item active" : "menu-item"}
                        onClick={() => { navigate("/admin/properties"); setMobileSidebarOpen(false); }}
                        title="Property Approvals"
                    >
                        <HomeWork /> <span className="menu-text">Property Approvals</span>
                        {pendingPropertiesCount > 0 && (
                            <span className="sidebar-badge">{pendingPropertiesCount}</span>
                        )}
                    </button>
                    <button
                        className={activeTab === "bookings" ? "menu-item active" : "menu-item"}
                        onClick={() => { navigate("/admin/bookings"); setMobileSidebarOpen(false); }}
                        title="Bookings & Refunds"
                    >
                        <ReceiptLong /> <span className="menu-text">Bookings & Refunds</span>
                    </button>
                    <button
                        className={activeTab === "coupons" ? "menu-item active" : "menu-item"}
                        onClick={() => { navigate("/admin/coupons"); setMobileSidebarOpen(false); }}
                        title="Coupons"
                    >
                        <LocalOffer /> <span className="menu-text">Coupons</span>
                    </button>
                    <button
                        className={activeTab === "commission" ? "menu-item active" : "menu-item"}
                        onClick={() => { navigate("/admin/commission"); setMobileSidebarOpen(false); }}
                        title="Commission Settings"
                    >
                        <Percent /> <span className="menu-text">Commission Settings</span>
                    </button>
                    <button
                        className={activeTab === "reviews" ? "menu-item active" : "menu-item"}
                        onClick={() => { navigate("/admin/reviews"); setMobileSidebarOpen(false); }}
                        title="Reviews Moderation"
                    >
                        <RateReview /> <span className="menu-text">Reviews Moderation</span>
                    </button>
                    <button
                        className={activeTab === "reports" ? "menu-item active" : "menu-item"}
                        onClick={() => { navigate("/admin/reports"); setMobileSidebarOpen(false); }}
                        title="User Reports"
                    >
                        <Flag /> <span className="menu-text">User Reports</span>
                        {pendingReportsCount > 0 && (
                            <span className="sidebar-badge">{pendingReportsCount}</span>
                        )}
                    </button>
                    <button
                        className="menu-item"
                        onClick={() => { navigate("/chat"); setMobileSidebarOpen(false); }}
                        title="Messages"
                    >
                        <ChatBubbleOutline /> <span className="menu-text">Messages</span>
                    </button>
                    <button
                        className="menu-item"
                        onClick={() => { navigate("/notifications"); setMobileSidebarOpen(false); }}
                        title="Notifications"
                    >
                        <NotificationsNone /> <span className="menu-text">Notifications</span>
                        {unreadNotifsCount > 0 && (
                            <span className="sidebar-badge">{unreadNotifsCount}</span>
                        )}
                    </button>

                </div>

                <div className="sidebar-footer">
                    <button className="menu-item" onClick={() => navigate("/")} title="Back to Home" style={{ width: '100%', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Home /> <span className="menu-text">Back to Home</span>
                    </button>
                    <div className="theme-toggle-wrapper" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px', marginBottom: '0px' }}>
                        <span className="menu-text" style={{ fontSize: '13px', fontWeight: '600', color: 'var(--secondary-text-color)' }}>Theme</span>
                        <ThemeToggle theme={theme} setTheme={setTheme} />
                    </div>
                </div>
            </div>

            {/* Dashboard Content Container */}
            <div className={`admin-content-pane ${!desktopSidebarOpen ? 'desktop-collapsed' : ''}`}>
                {/* Mobile Admin Header */}
                <div className="mobile-admin-header">
                    <button className="mobile-menu-btn" onClick={() => setMobileSidebarOpen(true)}>
                        <Menu />
                    </button>
                    <h3>Admin Panel</h3>
                </div>
                {/* 1. OVERVIEW VIEW */}
                {activeTab === "overview" && (
                    <div className="tab-view overview-tab">
                        <h1>Platform Overview</h1>

                        <div className="stat-cards-grid">
                            <StatCard title="Today's Revenue" value={stats.todayRevenue || 0} prefix="$" growth={growthStats.todayRevenue?.daily} period="vs yesterday" />
                            <StatCard title="Today's Bookings" value={stats.todayBookings || 0} growth={growthStats.todayBookings?.daily} period="vs yesterday" />
                            <StatCard title="Total Users" value={stats.totalUsers} growth={growthStats.users?.weekly} period="vs last week" />
                            <StatCard title="Total Hosts" value={stats.totalHosts} growth={growthStats.hosts?.weekly} period="vs last week" />
                            <StatCard title="Active Listings" value={stats.totalProperties} growth={growthStats.properties?.weekly} period="vs last week" />
                            <StatCard title="Pending Approvals" value={stats.pendingApprovals || 0} />
                            <StatCard title="Gross Revenue" value={stats.totalRevenue} prefix="$" growth={growthStats.revenue?.weekly} period="vs last week" />
                            <StatCard title="Net Income" value={stats.netIncome} prefix="$" growth={growthStats.netIncome?.weekly} period="vs last week" />
                        </div>

                        <div className="category-revenue-card">
                            <h3>Revenue by Property Category</h3>
                            <div className="category-list">
                                {categoryStats.map(cat => {
                                    const percent = stats.totalRevenue > 0 ? (cat.value / stats.totalRevenue) * 100 : 0;
                                    return (
                                        <div className="cat-item" key={cat.name}>
                                            <span className="cat-name">{cat.name}</span>
                                            <div className="progress-bar-bg">
                                                <div className="progress-bar-fill" style={{ width: `${percent}%` }}></div>
                                            </div>
                                            <span className="cat-val">${cat.value.toLocaleString()}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. USER MODERATION VIEW */}
                {/* 2. USER MODERATION VIEW */}
                {activeTab === "users" && (
                    <div className="tab-view users-tab">
                        <h1>User Account Moderation</h1>


                        {/* Role Filter Tabs */}
                        <div className="role-filter-tabs desktop-only">
                            <button
                                className={roleFilter === "all" ? "filter-btn active" : "filter-btn"}
                                onClick={() => setRoleFilter("all")}
                            >
                                All
                            </button>
                            <button
                                className={roleFilter === "user" ? "filter-btn active" : "filter-btn"}
                                onClick={() => setRoleFilter("user")}
                            >
                                User
                            </button>
                            <button
                                className={roleFilter === "host" ? "filter-btn active" : "filter-btn"}
                                onClick={() => setRoleFilter("host")}
                            >
                                Host
                            </button>
                            <button
                                className={roleFilter === "admin" ? "filter-btn active" : "filter-btn"}
                                onClick={() => setRoleFilter("admin")}
                            >
                                Admin
                            </button>
                        </div>

                        {/* Mobile Role Filter Dropdown */}
                        <div className="mobile-status-filter-container mobile-only">
                            <div className="status-select-card">
                                <div className="select-label">
                                    <FilterList sx={{ fontSize: 18 }} />
                                    <span>Role</span>
                                </div>
                                <div className="select-input-wrapper">
                                    <select
                                        value={roleFilter}
                                        onChange={(e) => setRoleFilter(e.target.value)}
                                        className="status-dropdown-select"
                                    >
                                        <option value="all">All Roles ({users.length})</option>
                                        <option value="user">Regular Users</option>
                                        <option value="host">Hosts</option>
                                        <option value="admin">Admins</option>
                                    </select>
                                    <KeyboardArrowDown className="select-arrow-icon" />
                                </div>
                            </div>
                        </div>

                        <DataTable
                            columns={[
                                { 
                                    key: 'firstName', 
                                    label: 'Name', 
                                    sortable: true, 
                                    render: (u) => (
                                        <div className="user-name-cell">
                                            <strong>{u.firstName} {u.lastName}</strong>
                                            {u._id === user?._id && (
                                                <span className="current-user-tag">You</span>
                                            )}
                                        </div>
                                    ) 
                                },
                                { key: 'email', label: 'Email', sortable: true },
                                { 
                                    key: 'role', 
                                    label: 'Role', 
                                    sortable: true, 
                                    render: (u) => <span className={`status-badge-table ${u.role}`}>{u.role}</span> 
                                },
                                {
                                    key: 'actions',
                                    label: 'Role Actions',
                                    render: (u) => {
                                        if (u.role === 'admin') {
                                            return (
                                                <span className="self-role-tag" title="System Administrator (Configured in .env)">
                                                    Primary Administrator
                                                </span>
                                            );
                                        }

                                        const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;

                                        return (
                                            <div className="table-actions user-role-actions">
                                                {u.role === 'host' ? (
                                                    <button 
                                                        className="role-action-btn demote-user-btn"
                                                        onClick={() => handleRoleChangeRequest(u._id, 'user', fullName, 'host')}
                                                        title="Convert role from Host to User"
                                                    >
                                                        Make User
                                                    </button>
                                                ) : (
                                                    <button 
                                                        className="role-action-btn make-host-btn"
                                                        onClick={() => handleRoleChangeRequest(u._id, 'host', fullName, 'user')}
                                                        title="Convert role from User to Host"
                                                    >
                                                        Make Host
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    }
                                },
                            ]}
                            data={users.filter((u) => roleFilter === 'all' || u.role === roleFilter)}
                            searchKeys={['firstName', 'lastName', 'email', 'role']}
                            pageSize={10}
                            emptyMessage="No users match your filter."
                        />
                    </div>
                )}

                {/* 3. PROPERTY APPROVALS VIEW */}
                {activeTab === "properties" && (
                    <div className="tab-view properties-tab">
                        <div className="tab-header-flex">
                            <div>
                                <h1>Property Listings Approval</h1>
                                <p className="tab-subtitle">Review, inspect, verify, and moderate property submissions from hosts.</p>
                            </div>
                            <div className="approval-stat-pills">
                                <span className="stat-pill total">Total: {properties.length}</span>
                                <span className={`stat-pill pending ${pendingPropertiesCount > 0 ? 'urgent' : ''}`}>
                                    Pending Review: {pendingPropertiesCount}
                                </span>
                                <span className="stat-pill approved">Approved: {approvedPropertiesCount}</span>
                            </div>
                        </div>

                        {/* Status Filter Tabs */}
                        <div className="role-filter-tabs property-filter-tabs desktop-only">
                            <button
                                className={propertyStatusFilter === 'all' ? 'filter-btn active' : 'filter-btn'}
                                onClick={() => setPropertyStatusFilter('all')}
                            >
                                All ({properties.length})
                            </button>
                            <button
                                className={propertyStatusFilter === 'pending' ? 'filter-btn active pending-tab-btn' : 'filter-btn pending-tab-btn'}
                                onClick={() => setPropertyStatusFilter('pending')}
                            >
                                Pending Review ({pendingPropertiesCount})
                            </button>
                            <button
                                className={propertyStatusFilter === 'approved' ? 'filter-btn active' : 'filter-btn'}
                                onClick={() => setPropertyStatusFilter('approved')}
                            >
                                Approved ({approvedPropertiesCount})
                            </button>
                            <button
                                className={propertyStatusFilter === 'paused' ? 'filter-btn active' : 'filter-btn'}
                                onClick={() => setPropertyStatusFilter('paused')}
                            >
                                Paused ({pausedPropertiesCount})
                            </button>
                            <button
                                className={propertyStatusFilter === 'rejected' ? 'filter-btn active' : 'filter-btn'}
                                onClick={() => setPropertyStatusFilter('rejected')}
                            >
                                Rejected ({rejectedPropertiesCount})
                            </button>
                            <button
                                className={propertyStatusFilter === 'suspended' ? 'filter-btn active' : 'filter-btn'}
                                onClick={() => setPropertyStatusFilter('suspended')}
                            >
                                Suspended ({suspendedPropertiesCount})
                            </button>
                        </div>

                        {/* Mobile Status Filter Dropdown */}
                        <div className="mobile-status-filter-container mobile-only">
                            <div className="status-select-card">
                                <div className="select-label">
                                    <FilterList sx={{ fontSize: 18 }} />
                                    <span>Status</span>
                                </div>
                                <div className="select-input-wrapper">
                                    <select
                                        value={propertyStatusFilter}
                                        onChange={(e) => setPropertyStatusFilter(e.target.value)}
                                        className="status-dropdown-select"
                                    >
                                        <option value="all">All Properties ({properties.length})</option>
                                        <option value="pending">Pending Review ({pendingPropertiesCount})</option>
                                        <option value="approved">Approved ({approvedPropertiesCount})</option>
                                        <option value="paused">Paused ({pausedPropertiesCount})</option>
                                        <option value="rejected">Rejected ({rejectedPropertiesCount})</option>
                                        <option value="suspended">Suspended ({suspendedPropertiesCount})</option>
                                    </select>
                                    <KeyboardArrowDown className="select-arrow-icon" />
                                </div>
                            </div>
                        </div>

                        <DataTable
                            columns={[
                                { 
                                    key: 'title', 
                                    label: 'Property', 
                                    sortable: true, 
                                    render: (p) => (
                                        <div 
                                            className="property-cell" 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/properties/${p._id}`);
                                            }}
                                            title="Click to view live property page"
                                        >
                                            <div className="property-thumb-container">
                                                <img 
                                                    src={resolveImageUrl(p.listingPhotoPaths?.[0], '/assets/default.jpg')} 
                                                    alt={p.title} 
                                                    className="property-table-thumb"
                                                    onError={(e) => { e.target.onerror = null; e.target.src = '/assets/default.jpg'; }}
                                                />
                                            </div>
                                            <div className="property-info-meta">
                                                <span className="property-title-text">
                                                    {p.title}
                                                </span>
                                                <div className="property-tags">
                                                    <span className="property-category-tag">{p.category}</span>
                                                    <span className="property-type-tag">{p.type}</span>
                                                    <span className="property-id-tag">#{p._id ? p._id.toString().slice(-6).toUpperCase() : ''}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                },
                                { 
                                    key: 'city', 
                                    label: 'Location', 
                                    sortable: true, 
                                    render: (p) => (
                                        <div className="location-cell">
                                            <span className="location-main">{p.city || 'Unknown City'}</span>
                                            <span className="location-sub">
                                                {[p.province, p.country].filter(Boolean).join(', ') || 'N/A'}
                                            </span>
                                        </div>
                                    ) 
                                },
                                { 
                                    key: 'creator.firstName', 
                                    label: 'Owner / Host', 
                                    sortable: true, 
                                    render: (p) => {
                                        const hostName = [p.creator?.firstName, p.creator?.lastName].filter(Boolean).join(' ') || 'Property Host';
                                        const initial = (p.creator?.firstName?.[0] || 'H').toUpperCase();
                                        return (
                                            <div className="owner-cell">
                                                {p.creator?.profileImagePath ? (
                                                    <img 
                                                        src={resolveImageUrl(p.creator.profileImagePath, '/assets/default.jpg')} 
                                                        alt={hostName} 
                                                        className="owner-table-avatar"
                                                        onError={(e) => { e.target.onerror = null; e.target.src = '/assets/default.jpg'; }}
                                                    />
                                                ) : (
                                                    <div className="owner-avatar-fallback">
                                                        {initial}
                                                    </div>
                                                )}
                                                <div className="owner-text">
                                                    <div className="owner-name-row">
                                                        <span className="owner-name">{hostName}</span>
                                                        {p.creator?.isVerified && (
                                                            <span className="verified-host-tag" title="Verified Host">Verified</span>
                                                        )}
                                                    </div>
                                                    {p.creator?.email && (
                                                        <span className="owner-email">{p.creator.email}</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    }
                                },
                                { 
                                    key: 'price', 
                                    label: 'Pricing', 
                                    sortable: true, 
                                    render: (p) => (
                                        <div className="pricing-cell">
                                            <span className="price-amount">${p.price}</span>
                                            <span className="price-period">/ night</span>
                                        </div>
                                    ) 
                                },
                                { 
                                    key: 'isApproved', 
                                    label: 'Status', 
                                    sortable: true, 
                                    render: (p) => {
                                        const status = p.isApproved || 'pending';
                                        return (
                                            <span className={`status-badge-table ${status}`}>
                                                {status.toUpperCase()}
                                            </span>
                                        );
                                    }
                                },
                                { 
                                    key: 'isFeatured', 
                                    label: 'Featured', 
                                    sortable: true, 
                                    render: (p) => (
                                        <button 
                                            className="feature-toggle-icon" 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleFeatured(p._id);
                                            }}
                                            title={p.isFeatured ? "Featured property (click to remove)" : "Click to mark as featured"}
                                        >
                                            {p.isFeatured ? <Star sx={{ color: "#f59e0b" }} /> : <StarBorder />}
                                        </button>
                                    ) 
                                },
                                { 
                                    key: 'actions', 
                                    label: 'Actions', 
                                    render: (p) => {
                                        const status = p.isApproved || 'pending';
                                        return (
                                            <div className="table-actions" onClick={(e) => e.stopPropagation()}>
                                                {status === "pending" && (
                                                    <>
                                                        <button 
                                                            className="approve-action-btn" 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                approveListing(p._id, "approved");
                                                            }}
                                                        >
                                                            Approve
                                                        </button>
                                                        <button 
                                                            className="reject-action-btn" 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                approveListing(p._id, "rejected");
                                                            }}
                                                        >
                                                            Reject
                                                        </button>
                                                    </>
                                                )}
                                                {status === "approved" && (
                                                    <>
                                                        <button 
                                                            className="pause-action-btn" 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                approveListing(p._id, "paused");
                                                            }}
                                                        >
                                                            Pause
                                                        </button>
                                                        <button 
                                                            className="suspend-action-btn" 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                approveListing(p._id, "suspended");
                                                            }}
                                                        >
                                                            Suspend
                                                        </button>
                                                    </>
                                                )}
                                                {status === "paused" && (
                                                    <button 
                                                        className="approve-action-btn" 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            approveListing(p._id, "approved");
                                                        }}
                                                    >
                                                        Start
                                                    </button>
                                                )}
                                                {status === "rejected" && (
                                                    <button 
                                                        className="approve-action-btn" 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            approveListing(p._id, "approved");
                                                        }}
                                                    >
                                                        Re-approve
                                                    </button>
                                                )}
                                                {status === "suspended" && (
                                                    <button 
                                                        className="approve-action-btn" 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            approveListing(p._id, "approved");
                                                        }}
                                                    >
                                                        Reactivate
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    }
                                }
                            ]}
                            data={filteredProperties}
                            searchKeys={['title', 'city', 'province', 'country', 'creator.firstName', 'creator.lastName', 'creator.email', 'category', 'type', 'isApproved']}
                            pageSize={10}
                            emptyMessage={propertyStatusFilter === 'all' ? "No property listings found." : `No listings with status "${propertyStatusFilter}".`}
                            onRowClick={(p) => navigate(`/properties/${p._id}`)}
                        />
                    </div>
                )}

                {/* 4. BOOKINGS VIEW */}
                {activeTab === "bookings" && (
                    <div className="tab-view bookings-tab">
                        <h1>Bookings & Dispute Refunds</h1>

                        {/* Status Filter Tabs */}
                        <div className="booking-filter-tabs desktop-only">
                            <button
                                className={bookingStatusFilter === "all" ? "filter-btn active" : "filter-btn"}
                                onClick={() => setBookingStatusFilter("all")}
                            >
                                All Bookings ({bookingCounts.all})
                            </button>
                            <button
                                className={bookingStatusFilter === "upcoming" ? "filter-btn active" : "filter-btn"}
                                onClick={() => setBookingStatusFilter("upcoming")}
                            >
                                Upcoming ({bookingCounts.upcoming})
                            </button>
                            <button
                                className={bookingStatusFilter === "pending" ? "filter-btn active pending-tab-btn" : "filter-btn pending-tab-btn"}
                                onClick={() => setBookingStatusFilter("pending")}
                            >
                                Pending ({bookingCounts.pending})
                            </button>
                            <button
                                className={bookingStatusFilter === "completed" ? "filter-btn active" : "filter-btn"}
                                onClick={() => setBookingStatusFilter("completed")}
                            >
                                Completed ({bookingCounts.completed})
                            </button>
                            <button
                                className={bookingStatusFilter === "cancelled" ? "filter-btn active" : "filter-btn"}
                                onClick={() => setBookingStatusFilter("cancelled")}
                            >
                                Cancelled / Rejected ({bookingCounts.cancelled})
                            </button>
                        </div>

                        {/* Mobile Status Filter Dropdown */}
                        <div className="mobile-status-filter-container mobile-only">
                            <div className="status-select-card">
                                <div className="select-label">
                                    <FilterList sx={{ fontSize: 18 }} />
                                    <span>Status</span>
                                </div>
                                <div className="select-input-wrapper">
                                    <select
                                        value={bookingStatusFilter}
                                        onChange={(e) => setBookingStatusFilter(e.target.value)}
                                        className="status-dropdown-select"
                                    >
                                        <option value="all">All Bookings ({bookingCounts.all})</option>
                                        <option value="upcoming">Upcoming ({bookingCounts.upcoming})</option>
                                        <option value="pending">Pending ({bookingCounts.pending})</option>
                                        <option value="completed">Completed ({bookingCounts.completed})</option>
                                        <option value="cancelled">Cancelled / Rejected ({bookingCounts.cancelled})</option>
                                    </select>
                                    <KeyboardArrowDown className="select-arrow-icon" />
                                </div>
                            </div>
                        </div>

                        <DataTable
                            columns={[
                                { key: 'invoiceRef', label: 'Booking Ref', sortable: true, render: (b) => <strong>{b.invoiceRef || (`INV-${b._id.toString().substr(-6).toUpperCase()}`)}</strong> },
                                { key: 'listingId.title', label: 'Property', sortable: true, render: (b) => (
                                    <div>
                                        <strong>{b.listingId?.title}</strong>
                                        <br />
                                        <small style={{ color: 'var(--secondary-text-color)' }}>
                                            {new Date(b.startDate).toLocaleDateString()} - {new Date(b.endDate).toLocaleDateString()} ({b.dayCount || Math.max(1, Math.round((new Date(b.endDate) - new Date(b.startDate)) / (1000 * 60 * 60 * 24)))} {(b.dayCount || Math.max(1, Math.round((new Date(b.endDate) - new Date(b.startDate)) / (1000 * 60 * 60 * 24)))) > 1 ? 'nights' : 'night'})
                                        </small>
                                    </div>
                                )},
                                { key: 'customerId.firstName', label: 'Guest', sortable: true, render: (b) => `${b.customerId?.firstName || ''} ${b.customerId?.lastName || ''}` },
                                { key: 'hostId.firstName', label: 'Host', sortable: true, render: (b) => `${b.hostId?.firstName || ''} ${b.hostId?.lastName || ''}` },
                                { key: 'totalPrice', label: 'Total Paid', sortable: true, render: (b) => `$${Number(b.totalPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                                { key: 'status', label: 'Status', sortable: true, render: (b) => <span className={`status-badge-table ${b.status}`}>{b.status}</span> },
                                { key: 'actions', label: 'Actions', render: (b) => (
                                    <div className="table-actions">
                                        <button
                                            className="table-action-btn invoice-btn"
                                            style={{ background: "var(--primary-color, #22c55e)", color: "white", padding: "6px 14px", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "5px" }}
                                            onClick={() => openAuthenticatedPdf(`/bookings/${b._id}/invoice`).catch(err => {
                                                console.error(err);
                                                dispatch(setToast({ message: "Unable to open invoice. Payment may not be completed yet.", type: "error" }));
                                            })}
                                            title="View / Download Invoice"
                                        >
                                            <Receipt sx={{ fontSize: 14 }} /> Invoice
                                        </button>
                                    </div>
                                )}
                            ]}
                            data={filteredBookings}
                            searchKeys={['listingId.title', 'customerId.firstName', 'customerId.lastName', 'hostId.firstName', 'hostId.lastName', 'status']}
                            pageSize={10}
                            emptyMessage={bookingStatusFilter === 'all' ? "No bookings found." : `No bookings with status "${bookingStatusFilter}".`}
                        />
                    </div>
                )}

                {/* 6. COUPONS VIEW */}
                {activeTab === "coupons" && (
                    <div className="tab-view coupons-tab">
                        <h1>Coupon Codes & Discounts</h1>
                        
                        <div className="coupons-stack-vertical" style={{ display: 'flex', flexDirection: 'column', gap: '30px', marginBottom: '30px' }}>
                            <div className="card-inner create-coupon-card" style={{ padding: '24px', borderRadius: '16px', background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #edf2f7)', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                                <h3>Create New Coupon</h3>
                                <form onSubmit={handleCreateCoupon} className="create-coupon-form" style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
                                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontSize: '13px', fontWeight: '600' }}>Coupon Code</label>
                                        <input
                                            type="text"
                                            required
                                            value={couponCode}
                                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                            placeholder="e.g. WELCOME20"
                                            style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color, #eaeaea)', background: 'var(--input-bg)' }}
                                        />
                                    </div>
                                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontSize: '13px', fontWeight: '600' }}>Discount Type</label>
                                        <select
                                            value={couponDiscountType}
                                            onChange={(e) => setCouponDiscountType(e.target.value)}
                                            style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color, #eaeaea)', background: 'var(--input-bg)' }}
                                        >
                                            <option value="percentage">Percentage (%)</option>
                                            <option value="flat">Flat Amount ($)</option>
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontSize: '13px', fontWeight: '600' }}>Discount Value</label>
                                        <input
                                            type="number"
                                            required
                                            value={couponDiscountValue}
                                            onChange={(e) => setCouponDiscountValue(e.target.value)}
                                            placeholder="e.g. 10"
                                            style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color, #eaeaea)', background: 'var(--input-bg)' }}
                                        />
                                    </div>
                                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontSize: '13px', fontWeight: '600' }}>Start Date</label>
                                        <input
                                            type="date"
                                            required
                                            value={couponStartDate}
                                            onChange={(e) => setCouponStartDate(e.target.value)}
                                            style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color, #eaeaea)', background: 'var(--input-bg)' }}
                                        />
                                    </div>
                                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontSize: '13px', fontWeight: '600' }}>End Date</label>
                                        <input
                                            type="date"
                                            required
                                            value={couponEndDate}
                                            onChange={(e) => setCouponEndDate(e.target.value)}
                                            style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color, #eaeaea)', background: 'var(--input-bg)' }}
                                        />
                                    </div>
                                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontSize: '13px', fontWeight: '600' }}>Coupon Quantity (1 - 100)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="100"
                                            value={couponUsageLimit}
                                            onChange={(e) => setCouponUsageLimit(e.target.value)}
                                            placeholder="1 - 100 (Max 100)"
                                            style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color, #eaeaea)', background: 'var(--input-bg)' }}
                                        />
                                    </div>
                                    <div className="coupon-form-actions" style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', marginTop: '4px' }}>
                                        <button type="submit" className="action-submit-btn coupon-submit-btn" style={{ padding: '12px 24px', background: 'var(--primary-color, #22c55e)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', alignSelf: 'flex-end' }}>
                                            Generate Coupon
                                        </button>
                                    </div>
                                </form>
                            </div>

                            <div style={{ background: 'var(--card-bg, #fff)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color, #edf2f7)', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                                <h3>Active Coupon Codes</h3>
                                <DataTable
                                    columns={[
                                        { key: 'code', label: 'Code', sortable: true, render: (c) => <strong>{c.code}</strong> },
                                        { key: 'discountValue', label: 'Discount', sortable: true, render: (c) => c.discountType === 'percentage' ? `${c.discountValue}%` : `$${c.discountValue}` },
                                        { key: 'usageCount', label: 'Qty / Used', sortable: true, render: (c) => `${c.usageCount} / ${c.usageLimit || '∞'}` },
                                        { key: 'startDate', label: 'Duration', sortable: true, render: (c) => `${new Date(c.startDate).toLocaleDateString()} - ${new Date(c.endDate).toLocaleDateString()}` },
                                        { key: 'isActive', label: 'Status', sortable: true, render: (c) => {
                                            const isExpired = new Date(c.endDate) < new Date();
                                            const isLimitFilled = c.usageLimit !== null && c.usageCount >= c.usageLimit;
                                            const isEffectiveActive = c.isActive && !isExpired && !isLimitFilled;
                                            return (
                                                <span className={`status-badge-table ${isEffectiveActive ? 'active-coupon' : 'inactive-coupon'}`}>
                                                    {isExpired ? 'EXPIRED' : isLimitFilled ? 'FILLED (INACTIVE)' : c.isActive ? 'ACTIVE' : 'INACTIVE'}
                                                </span>
                                            );
                                        }},
                                        { key: 'actions', label: 'Actions', render: (c) => (
                                            <div className="table-actions" style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', gap: '6px' }}>
                                                <button 
                                                    className="edit-coupon-btn" 
                                                    style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--primary-color, #22c55e)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }} 
                                                    onClick={() => handleOpenEditCoupon(c)}
                                                    title="Edit coupon"
                                                >
                                                    <Edit sx={{ fontSize: 13 }} /> Edit
                                                </button>
                                                <button 
                                                    className="reject-action-btn" 
                                                    style={{ padding: '6px 12px', fontSize: '12px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }} 
                                                    onClick={() => handleDeleteCoupon(c._id)}
                                                    title="Delete coupon"
                                                >
                                                    <Delete sx={{ fontSize: 13 }} /> Delete
                                                </button>
                                            </div>
                                        )}
                                    ]}
                                    data={coupons}
                                    searchKeys={['code', 'discountType']}
                                    pageSize={5}
                                    emptyMessage="No coupon codes defined."
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* 7. COMMISSION VIEW */}
                {activeTab === "commission" && (
                    <div className="tab-view commission-tab">
                        <h1>Commission Fees Configuration</h1>
                        <p className="subtitle" style={{ color: 'var(--secondary-text-color)', marginBottom: '30px' }}>Adjust global fee rates. These will apply to all future reservations and payout calculations.</p>

                        <div className="card-inner" style={{ padding: '28px', borderRadius: '16px', background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #edf2f7)', maxWidth: '600px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                            <h3>Platform Fee Structure</h3>
                            <form onSubmit={handleUpdateSettings} style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
                                <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <label style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-color)' }}>Platform Booking Fee</label>
                                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--secondary-text-color)' }}>Charged to the guest on checkout transactions.</p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            max="100"
                                            step="0.1"
                                            value={platformFeePercent}
                                            onChange={(e) => setPlatformFeePercent(e.target.value)}
                                            style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color, #eaeaea)', background: 'var(--input-bg)', width: '80px', textAlign: 'right', fontWeight: '600' }}
                                        />
                                        <span style={{ fontWeight: '600' }}>%</span>
                                    </div>
                                </div>

                                <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <label style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-color)' }}>Host Service Payout Fee</label>
                                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--secondary-text-color)' }}>Deducted from the host's gross payout earnings.</p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            max="100"
                                            step="0.1"
                                            value={hostFeePercent}
                                            onChange={(e) => setHostFeePercent(e.target.value)}
                                            style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color, #eaeaea)', background: 'var(--input-bg)', width: '80px', textAlign: 'right', fontWeight: '600' }}
                                        />
                                        <span style={{ fontWeight: '600' }}>%</span>
                                    </div>
                                </div>

                                <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <label style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-color)' }}>Guest Transaction Tax</label>
                                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--secondary-text-color)' }}>Additional VAT or sales tax applied during checkout.</p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            max="100"
                                            step="0.1"
                                            value={guestFeePercent}
                                            onChange={(e) => setGuestFeePercent(e.target.value)}
                                            style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color, #eaeaea)', background: 'var(--input-bg)', width: '80px', textAlign: 'right', fontWeight: '600' }}
                                        />
                                        <span style={{ fontWeight: '600' }}>%</span>
                                    </div>
                                </div>

                                <button type="submit" className="action-submit-btn" style={{ padding: '14px', background: 'var(--primary-color, #22c55e)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', marginTop: '10px' }}>
                                    Save Changes
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* 8. REVIEWS VIEW */}
                {activeTab === "reviews" && (
                    <div className="tab-view reviews-tab">
                        <h1>Reviews Moderation</h1>
                        <p className="subtitle" style={{ color: 'var(--secondary-text-color)', marginBottom: '30px' }}>Moderate and delete listings reviews/ratings from comment sections.</p>

                        <DataTable
                            columns={[
                                { key: 'customerId.firstName', label: 'Reviewer', sortable: true, render: (r) => (
                                    <div>
                                        <strong>{r.customerId?.firstName} {r.customerId?.lastName}</strong>
                                        <br />
                                        <small style={{ color: 'var(--secondary-text-color)' }}>{r.customerId?.email}</small>
                                    </div>
                                )},
                                { key: 'listingId.title', label: 'Listing Target', sortable: true, render: (r) => r.listingId?.title || '-' },
                                { key: 'rating', label: 'Rating', sortable: true, render: (r) => (
                                    <span className="rating-stars">
                                        <Star sx={{ fontSize: 16, verticalAlign: 'middle', marginRight: '2px' }} />
                                        {r.rating} / 5
                                    </span>
                                )},
                                { key: 'comment', label: 'Comment Details', render: (r) => {
                                    const text = r.comment || '';
                                    const isTruncated = text.length > 50;
                                    const displayComment = isTruncated ? `${text.substring(0, 50).trim()}...` : text;
                                    return (
                                        <div style={{ maxWidth: '280px', lineHeight: 1.4 }}>
                                            <span 
                                                style={{ 
                                                    display: 'block', 
                                                    overflow: 'hidden', 
                                                    textOverflow: 'ellipsis', 
                                                    whiteSpace: 'nowrap',
                                                    color: 'var(--text-color)' 
                                                }} 
                                                title={text}
                                            >
                                                "{displayComment}"
                                            </span>
                                        </div>
                                    );
                                }},
                                { key: 'createdAt', label: 'Date', sortable: true, render: (r) => new Date(r.createdAt).toLocaleDateString() },
                                { key: 'actions', label: 'Actions', render: (r) => (
                                    <div className="table-actions">
                                        <button 
                                            className="table-action-btn view-btn" 
                                            style={{ background: 'var(--brand-green, #22c55e)', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }} 
                                            onClick={() => setViewReview(r)}
                                            title="View full review"
                                        >
                                            <Visibility sx={{ fontSize: 13 }} /> View
                                        </button>
                                    </div>
                                )}
                            ]}
                            data={reviews}
                            searchKeys={['comment', 'customerId.firstName', 'customerId.lastName', 'listingId.title']}
                            pageSize={10}
                            emptyMessage="No guest reviews available."
                        />
                    </div>
                )}

                {/* 9. REPORTS VIEW */}
                {activeTab === "reports" && (
                    <div className="tab-view reports-tab">
                        <h1>User Moderation Flags & Reports</h1>
                        <p className="subtitle" style={{ color: 'var(--secondary-text-color)', marginBottom: '30px' }}>Review user flags against properties or content violating platform safety codes.</p>

                        <DataTable
                            columns={[
                                { key: 'reporterId.firstName', label: 'Reporter', sortable: true, render: (rep) => (
                                    <div>
                                        <strong>{rep.reporterId?.firstName} {rep.reporterId?.lastName}</strong>
                                        <br />
                                        <small style={{ color: 'var(--secondary-text-color)' }}>{rep.reporterId?.email}</small>
                                    </div>
                                )},
                                { key: 'targetType', label: 'Target Type', sortable: true, render: (rep) => <span style={{ textTransform: 'capitalize', fontWeight: '600' }}>{rep.targetType}</span> },
                                { key: 'reason', label: 'Reason Category', sortable: true, render: (rep) => <strong>{rep.reason}</strong> },
                                { key: 'description', label: 'Flag description', render: (rep) => (
                                    <div className="cell-text-wrap" style={{ maxWidth: '250px' }}>
                                        {rep.description || 'No description provided.'}
                                    </div>
                                )},
                                { key: 'screenshot', label: 'Screenshot', render: (rep) => {
                                    if (!rep.imagePath) return <span style={{ color: 'var(--secondary-text-color)' }}>No Image</span>;
                                    const imgUrl = rep.imagePath.startsWith('http') ? rep.imagePath : `${BACKEND_BASE_URL}/${rep.imagePath.replace(/^public[/\\]/, '')}`;
                                    return (
                                        <a href={imgUrl} target="_blank" rel="noopener noreferrer">
                                            <img
                                                src={imgUrl}
                                                alt="Screenshot"
                                                style={{ width: '60px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                                            />
                                        </a>
                                    );
                                }},
                                { key: 'status', label: 'Resolution', sortable: true, render: (rep) => (
                                    <span className={`status-badge-table ${rep.status}`}>
                                        {rep.status.toUpperCase()}
                                    </span>
                                )},
                                { key: 'createdAt', label: 'Reported On', sortable: true, render: (rep) => new Date(rep.createdAt).toLocaleDateString() },
                                { key: 'actions', label: 'Actions', render: (rep) => (
                                    <div className="table-actions">
                                        {rep.status === 'pending' ? (
                                            <>
                                                <button className="primary" onClick={() => handleResolveReport(rep._id, 'resolved', rep.targetId)}>
                                                    Suspend Target
                                                </button>
                                                <button style={{ padding: '6px 12px', fontSize: '12px', background: '#eaeaea', border: 'none', borderRadius: '6px', cursor: 'pointer' }} onClick={() => handleResolveReport(rep._id, 'dismissed')}>
                                                    Dismiss
                                                </button>
                                            </>
                                        ) : (
                                            <span style={{ color: 'var(--secondary-text-color)', fontSize: '12px' }}>Resolved</span>
                                        )}
                                    </div>
                                )}
                            ]}
                            data={reports}
                            searchKeys={['reason', 'description', 'targetType', 'reporterId.firstName', 'reporterId.lastName']}
                            pageSize={10}
                            emptyMessage="No safety reports flagged."
                        />
                    </div>
                )}

                {/* 10. HOST REQUESTS VIEW */}
                {activeTab === "host-requests" && (
                    <div className="tab-view host-requests-tab">
                        <h1>Host Applications</h1>
                        <p className="subtitle" style={{ color: 'var(--secondary-text-color)', marginBottom: '30px' }}>Approve or reject requests from users applying to host listings.</p>
                        <DataTable
                            columns={[
                                { key: 'firstName', label: 'Name', sortable: true, render: (r) => <strong>{r.firstName} {r.lastName}</strong> },
                                { key: 'email', label: 'Email', sortable: true },
                                { key: 'phone', label: 'Phone', render: (r) => r.phone || '-' },
                                { key: 'bio', label: 'Bio / Experience', render: (r) => <div style={{ maxWidth: '250px', fontSize: '13px' }}>{r.bio || 'No details provided.'}</div> },
                                { key: 'actions', label: 'Actions', render: (r) => (
                                    <div className="table-actions">
                                        <button className="approve-action-btn" style={{ background: '#dcfce7', color: '#16a34a', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, marginRight: '8px' }} onClick={() => handleApproveHost(r._id)}>Approve</button>
                                        <button className="reject-action-btn" style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleRejectHost(r._id)}>Reject</button>
                                    </div>
                                )}
                            ]}
                            data={hostRequests}
                            searchKeys={['firstName', 'lastName', 'email', 'bio']}
                            pageSize={10}
                            emptyMessage="No pending host applications."
                        />
                    </div>
                )}

                {/* 4.5 ANALYSIS DASHBOARD VIEW */}
                {
                    activeTab === "analysis" && (
                        <div className="tab-view analysis-tab">
                            <h1>Business Intelligence & Analysis</h1>
                            <p className="subtitle" style={{ color: 'var(--secondary-text-color)', marginBottom: '30px' }}>Visual metrics tracking property bookings, category revenues, and status distributions.</p>

                            <div className="analysis-charts-grid">
                                {/* 1. Income & Revenue (Primary Priority - Financial Health) */}
                                <div className="chart-card wide-chart">
                                    <h3>Income & Revenue Stream</h3>
                                    <p>Monthly net income after 5% platform fee deduction.</p>
                                    <div className="income-stats-row">
                                        <div className="income-stat-box gross">
                                            <div className="stat-label">Gross Revenue</div>
                                            <div className="stat-val">${stats.totalRevenue.toLocaleString()}</div>
                                        </div>
                                        <div className="income-stat-box fee">
                                            <div className="stat-label">Platform Fee (5%)</div>
                                            <div className="stat-val">-${stats.hostFeesCollected.toLocaleString()}</div>
                                        </div>
                                        <div className="income-stat-box net">
                                            <div className="stat-label">Net Income</div>
                                            <div className="stat-val">${stats.netIncome.toLocaleString()}</div>
                                        </div>
                                    </div>
                                    {monthlyStats.length > 0 ? (
                                        <BarChart data={monthlyStats.map(m => ({ ...m, revenue: m.netRevenue }))} />
                                    ) : (
                                        <p style={{ textAlign: 'center', color: '#888', padding: '40px 0' }}>No monthly data recorded yet.</p>
                                    )}
                                </div>

                                {/* 2. User & Host Distribution */}
                                <div className="chart-card">
                                    <h3>User & Host Distribution</h3>
                                    <p>Breakdown of registered Users vs Hosts.</p>
                                    <DonutChart
                                        data={userRoleStats}
                                        colors={["#3b82f6", "#10b981"]}
                                    />
                                </div>

                                {/* 3. Trip Booking Statuses (Third Priority - Operational Transactions) */}
                                <div className="chart-card">
                                    <h3>Trip Booking Statuses</h3>
                                    <p>Distribution of bookings across all statuses.</p>
                                    <TripBookingStatusesWidget bookings={bookings} />
                                </div>

                                {/* 4. Properties by Category (Fourth Priority - Inventory/Catalog Diversity) */}
                                <div className="chart-card">
                                    <h3>Properties by Category</h3>
                                    <p>Total active properties listed under each lifestyle category.</p>
                                    <DonutChart
                                        data={propertyCategoryStats}
                                        colors={["#f87171", "#fb923c", "#fbbf24", "#34d399", "#2dd4bf", "#38bdf8", "#60a5fa", "#818cf8", "#a78bfa", "#c084fc", "#f472b6", "#fb7185"]}
                                    />
                                </div>

                                {/* 5. Property Type Distribution (Fifth Priority - Space Type breakdown) */}
                                <div className="chart-card">
                                    <h3>Property Type Distribution</h3>
                                    <p>Count of properties listed by rental space configuration.</p>
                                    <DonutChart
                                        data={propertyTypeStats}
                                        colors={["#6366f1", "#ec4899", "#14b8a6", "#8b5cf6", "#f43f5e"]}
                                    />
                                </div>

                                {/* 6. Property Approval Status (Sixth Priority - Internal Moderation Status) */}
                                <div className="chart-card">
                                    <h3>Property Approval Status</h3>
                                    <p>Breakdown of active, pending, paused, or rejected properties.</p>
                                    <DonutChart
                                        data={propertyStatusStats}
                                        colors={["#f59e0b", "#10b981", "#ef4444", "#3b82f6"]}
                                    />
                                </div>
                            </div>
                        </div>
                    )
                }


            </div>
            <ConfirmationModal
                open={refundModal.isOpen}
                title="Confirm Refund"
                message="Are you sure you want to cancel and refund this booking?"
                type="confirm"
                onConfirm={confirmRefund}
                onCancel={cancelRefund}
            />
            <ConfirmationModal
                open={deleteModalState.isOpen}
                title={deleteModalState.title}
                message={deleteModalState.message}
                type="confirm"
                onConfirm={deleteModalState.onConfirm}
                onCancel={() => setDeleteModalState(prev => ({ ...prev, isOpen: false }))}
            />
            <ConfirmationModal
                open={roleModalState.isOpen}
                title={roleModalState.targetRole === 'host' ? "Confirm Host Promotion" : "Confirm Demote to User"}
                message={
                    roleModalState.targetRole === 'host'
                        ? `Are you sure you want to promote ${roleModalState.userName} from USER to HOST? They will be granted permissions to list and manage properties.`
                        : `Are you sure you want to convert ${roleModalState.userName} from HOST to regular USER? Their hosting privileges will be revoked.`
                }
                type="confirm"
                onConfirm={confirmRoleChange}
                onCancel={() => setRoleModalState(prev => ({ ...prev, isOpen: false }))}
            />

            {/* Modal for Review Details */}
            <Dialog 
                open={!!viewReview} 
                onClose={() => setViewReview(null)} 
                fullWidth 
                maxWidth="sm" 
                PaperProps={{ sx: { borderRadius: '16px', bgcolor: 'var(--card-bg, #fff)', color: 'var(--text-color, #1a202c)', p: 2.5 } }}
            >
                <DialogTitle sx={{ fontWeight: 700, px: 0, pt: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Review Details</span>
                    {viewReview && (
                        <span style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b' }}>
                            <Star sx={{ fontSize: 18 }} /> {viewReview.rating} / 5
                        </span>
                    )}
                </DialogTitle>
                <DialogContent sx={{ px: 0, py: 1.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* Property Card with Image */}
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center', padding: '12px', background: 'var(--input-bg, #f8fafc)', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                        <img 
                            src={resolveImageUrl(viewReview?.listingId?.listingPhotoPaths?.[0], '/assets/default.jpg')} 
                            alt={viewReview?.listingId?.title || 'Property'} 
                            style={{ width: '90px', height: '68px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)', flexShrink: 0 }}
                            onError={(e) => { e.target.onerror = null; e.target.src = '/assets/default.jpg'; }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--brand-green, #22c55e)', letterSpacing: '0.5px' }}>
                                Property
                            </div>
                            <h4 style={{ margin: '2px 0 0', fontSize: '15px', color: 'var(--text-color)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {viewReview?.listingId?.title || 'Listing Stay'}
                            </h4>
                            <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: 'var(--secondary-text-color)' }}>
                                {viewReview?.listingId?.city ? `${viewReview.listingId.city}, ${viewReview.listingId.province || ''}, ${viewReview.listingId.country || ''}` : ''}
                                {viewReview?.listingId?.category ? ` • ${viewReview.listingId.category}` : ''}
                            </p>
                        </div>
                    </div>

                    {/* Guest & Review Meta */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '13px', color: 'var(--secondary-text-color)', padding: '0 4px' }}>
                        <div>
                            <strong>Guest:</strong> {viewReview?.customerId?.firstName} {viewReview?.customerId?.lastName} ({viewReview?.customerId?.email})
                        </div>
                        <div>
                            <strong>Date:</strong> {new Date(viewReview?.createdAt || Date.now()).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </div>
                    </div>

                    {/* Full Review Comment */}
                    <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e2e8f0)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--secondary-text-color)', marginBottom: '6px' }}>
                            Guest Feedback:
                        </div>
                        <p style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.6, fontStyle: 'italic', color: 'var(--text-color)' }}>
                            "{viewReview?.comment}"
                        </p>
                    </div>
                </DialogContent>
                <DialogActions sx={{ px: 0, pb: 0 }}>
                    <Button onClick={() => setViewReview(null)} variant="contained" sx={{ bgcolor: 'var(--brand-green, #22c55e)', '&:hover': { bgcolor: '#16a34a' }, borderRadius: '8px', textTransform: 'none', px: 3, fontWeight: 600 }}>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Property Verification & Inspection Modal */}
            <Dialog 
                open={!!selectedProperty} 
                onClose={() => setSelectedProperty(null)} 
                maxWidth="md" 
                fullWidth
                PaperProps={{ sx: { borderRadius: '16px', bgcolor: 'var(--card-bg, #fff)', color: 'var(--text-color, #1a202c)', p: { xs: 1.5, sm: 2.5 } } }}
            >
                <DialogTitle sx={{ fontWeight: 700, px: 0, pt: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>Verify Property Listing</span>
                        {selectedProperty && (
                            <span className={`status-badge-table ${selectedProperty.isApproved || 'pending'}`}>
                                {(selectedProperty.isApproved || 'pending').toUpperCase()}
                            </span>
                        )}
                    </div>
                    {selectedProperty && (
                        <Button 
                            variant="outlined" 
                            size="small"
                            onClick={() => window.open(`/properties/${selectedProperty._id}`, '_blank')}
                            startIcon={<OpenInNew />}
                            sx={{ textTransform: 'none', borderRadius: '8px' }}
                        >
                            Open Live Page
                        </Button>
                    )}
                </DialogTitle>
                <DialogContent sx={{ px: 0, py: 1 }}>
                    {selectedProperty && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                            {/* Photo Gallery Preview */}
                            {selectedProperty.listingPhotoPaths && selectedProperty.listingPhotoPaths.length > 0 && (
                                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px' }}>
                                    {selectedProperty.listingPhotoPaths.map((photo, idx) => (
                                        <img 
                                            key={idx}
                                            src={resolveImageUrl(photo, '/assets/default.jpg')}
                                            alt={`Preview ${idx + 1}`}
                                            style={{ width: '150px', height: '100px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)', flexShrink: 0 }}
                                            onError={(e) => { e.target.onerror = null; e.target.src = '/assets/default.jpg'; }}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Property Main Details */}
                            <div style={{ background: 'var(--bg-color, #f8fafc)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-color)' }}>
                                    {selectedProperty.title}
                                </h2>
                                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--secondary-text-color)' }}>
                                    {selectedProperty.category} &bull; {selectedProperty.type} &bull; {selectedProperty.streetAddress ? `${selectedProperty.streetAddress}, ` : ''}{selectedProperty.city}, {selectedProperty.province}, {selectedProperty.country}
                                </p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '13px', fontWeight: 600, color: 'var(--text-color)' }}>
                                    <span style={{ color: 'var(--primary, #16a34a)' }}>${selectedProperty.price} / night</span>
                                    <span>&bull;</span>
                                    <span>{selectedProperty.guestCount} Guests</span>
                                    <span>&bull;</span>
                                    <span>{selectedProperty.bedroomCount} Bedrooms</span>
                                    <span>&bull;</span>
                                    <span>{selectedProperty.bedCount} Beds</span>
                                    <span>&bull;</span>
                                    <span>{selectedProperty.bathroomCount} Baths</span>
                                </div>
                            </div>

                            {/* Owner Details Section */}
                            <div style={{ background: 'var(--bg-color, #f8fafc)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                                <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--secondary-text-color)', marginBottom: '10px' }}>
                                    Submitted By Property Owner
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                                    <div style={{ width: '50px', height: '50px', borderRadius: '50%', overflow: 'hidden', backgroundColor: '#e2e8f0', flexShrink: 0 }}>
                                        {selectedProperty.creator?.profileImagePath ? (
                                            <img 
                                                src={resolveImageUrl(selectedProperty.creator.profileImagePath, '/assets/default.jpg')}
                                                alt={selectedProperty.creator.firstName || 'Owner'}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                onError={(e) => { e.target.onerror = null; e.target.src = '/assets/default.jpg'; }}
                                            />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#10b981', color: '#fff', fontWeight: 700 }}>
                                                {(selectedProperty.creator?.firstName?.[0] || 'O').toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ flex: 1, minWidth: '200px' }}>
                                        <div style={{ fontWeight: 700, fontSize: '15px' }}>
                                            {selectedProperty.creator?.firstName || ''} {selectedProperty.creator?.lastName || ''}
                                            {selectedProperty.creator?.isVerified && (
                                                <span style={{ marginLeft: '8px', fontSize: '11px', background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '12px' }}>Verified Host</span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--secondary-text-color)' }}>
                                            {selectedProperty.creator?.email || 'No email provided'} {selectedProperty.creator?.phone ? `• ${selectedProperty.creator.phone}` : ''}
                                        </div>
                                    </div>
                                    <Button 
                                        variant="outlined" 
                                        size="small"
                                        onClick={() => navigate(`/chat/${selectedProperty.creator?._id || selectedProperty.creator}`)}
                                        sx={{ textTransform: 'none', borderRadius: '8px' }}
                                    >
                                        Message Host
                                    </Button>
                                </div>
                            </div>

                            {/* Description & Highlights */}
                            {selectedProperty.description && (
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>Description</div>
                                    <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: 'var(--text-color)' }}>{selectedProperty.description}</p>
                                </div>
                            )}

                            {selectedProperty.highlight && (
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>Highlight</div>
                                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-color)' }}>
                                        <strong>{selectedProperty.highlight}:</strong> {selectedProperty.highlightDesc}
                                    </p>
                                </div>
                            )}

                            {/* Amenities pills */}
                            {(() => {
                                const cleanAmenities = normalizeAmenities(selectedProperty.amenities);
                                return cleanAmenities.length > 0 ? (
                                    <div>
                                        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>Amenities Offered</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                            {cleanAmenities.map((item, idx) => (
                                                <span key={idx} style={{ background: 'rgba(0,0,0,0.06)', padding: '4px 10px', borderRadius: '14px', fontSize: '12px', fontWeight: 600 }}>
                                                    {item}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ) : null;
                            })()}
                        </div>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 0, pb: 0, pt: 2, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                    <Button onClick={() => setSelectedProperty(null)} sx={{ textTransform: 'none' }}>
                        Close
                    </Button>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {selectedProperty?.isApproved !== 'approved' && (
                            <Button 
                                variant="contained"
                                sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' }, textTransform: 'none', fontWeight: 700, px: 2.5 }}
                                onClick={() => {
                                    approveListing(selectedProperty._id, 'approved');
                                    setSelectedProperty(prev => ({ ...prev, isApproved: 'approved' }));
                                }}
                            >
                                Accept & Approve Property
                            </Button>
                        )}
                        {selectedProperty?.isApproved !== 'rejected' && (
                            <Button 
                                variant="outlined"
                                color="error"
                                sx={{ textTransform: 'none', fontWeight: 600 }}
                                onClick={() => {
                                    approveListing(selectedProperty._id, 'rejected');
                                    setSelectedProperty(prev => ({ ...prev, isApproved: 'rejected' }));
                                }}
                            >
                                Reject Property
                            </Button>
                        )}
                    </div>
                </DialogActions>
            </Dialog>

            {/* Edit Coupon Modal */}
            <Dialog 
                open={!!editingCoupon} 
                onClose={() => setEditingCoupon(null)} 
                maxWidth="sm" 
                fullWidth
                PaperProps={{ sx: { borderRadius: '16px', bgcolor: 'var(--card-bg, #fff)', color: 'var(--text-color, #1a202c)', p: 2.5 } }}
            >
                <DialogTitle sx={{ fontWeight: 700, px: 0, pt: 0, fontSize: '18px' }}>
                    Edit Coupon Details
                </DialogTitle>
                {editingCoupon && (
                    <form onSubmit={handleUpdateCoupon}>
                        <DialogContent sx={{ px: 0, py: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-color)' }}>Coupon Code</label>
                                <input
                                    type="text"
                                    required
                                    value={editingCoupon.code}
                                    onChange={(e) => setEditingCoupon({ ...editingCoupon, code: e.target.value.toUpperCase() })}
                                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color, #eaeaea)', background: 'var(--input-bg)', color: 'var(--text-color)' }}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-color)' }}>Discount Type</label>
                                    <select
                                        value={editingCoupon.discountType}
                                        onChange={(e) => setEditingCoupon({ ...editingCoupon, discountType: e.target.value })}
                                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color, #eaeaea)', background: 'var(--input-bg)', color: 'var(--text-color)' }}
                                    >
                                        <option value="percentage">Percentage (%)</option>
                                        <option value="flat">Flat Amount ($)</option>
                                    </select>
                                </div>
                                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-color)' }}>Discount Value</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={editingCoupon.discountValue}
                                        onChange={(e) => setEditingCoupon({ ...editingCoupon, discountValue: e.target.value })}
                                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color, #eaeaea)', background: 'var(--input-bg)', color: 'var(--text-color)' }}
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-color)' }}>Start Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={editingCoupon.startDate}
                                        onChange={(e) => setEditingCoupon({ ...editingCoupon, startDate: e.target.value })}
                                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color, #eaeaea)', background: 'var(--input-bg)', color: 'var(--text-color)' }}
                                    />
                                </div>
                                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-color)' }}>End Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={editingCoupon.endDate}
                                        onChange={(e) => setEditingCoupon({ ...editingCoupon, endDate: e.target.value })}
                                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color, #eaeaea)', background: 'var(--input-bg)', color: 'var(--text-color)' }}
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-color)' }}>Coupon Quantity (1 - 100)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        placeholder="1 - 100 (Max 100)"
                                        value={editingCoupon.usageLimit}
                                        onChange={(e) => {
                                            const newLimit = e.target.value;
                                            const isFilled = newLimit !== "" && (editingCoupon.usageCount || 0) >= Number(newLimit);
                                            setEditingCoupon({
                                                ...editingCoupon,
                                                usageLimit: newLimit,
                                                isActive: isFilled ? false : editingCoupon.isActive
                                            });
                                        }}
                                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color, #eaeaea)', background: 'var(--input-bg)', color: 'var(--text-color)' }}
                                    />
                                    {editingCoupon.usageLimit !== "" && (editingCoupon.usageCount || 0) >= Number(editingCoupon.usageLimit) && (
                                        <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: '600', marginTop: '2px' }}>
                                            Quantity filled up ({editingCoupon.usageCount}/{editingCoupon.usageLimit}). Auto-set to Inactive.
                                        </span>
                                    )}
                                </div>
                                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-color)' }}>Status</label>
                                    <select
                                        value={editingCoupon.isActive ? 'active' : 'inactive'}
                                        disabled={editingCoupon.usageLimit !== "" && (editingCoupon.usageCount || 0) >= Number(editingCoupon.usageLimit)}
                                        onChange={(e) => setEditingCoupon({ ...editingCoupon, isActive: e.target.value === 'active' })}
                                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color, #eaeaea)', background: 'var(--input-bg)', color: 'var(--text-color)' }}
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>
                        </DialogContent>
                        <DialogActions sx={{ px: 0, pb: 0, pt: 2, display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <Button onClick={() => setEditingCoupon(null)} sx={{ textTransform: 'none' }}>
                                Cancel
                            </Button>
                            <Button 
                                type="submit" 
                                variant="contained" 
                                sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' }, textTransform: 'none', fontWeight: 700, px: 3 }}
                            >
                                Save Changes
                            </Button>
                        </DialogActions>
                    </form>
                )}
            </Dialog>
    </div>
    )
};

export default AdminDashboard;
