import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/Loader/Loader';
import { AccountBalanceWallet, DateRange, Assessment, ShowChart, CheckCircle, HourglassEmpty, Cancel, History } from '@mui/icons-material';
import '../../styles/HostDashboard.scss';
import useCurrency from '../../hooks/useCurrency';
import { apiFetch } from '../../utils/api';
import { BACKEND_BASE_URL } from '../../config/constants';
import { resolveImageUrl } from '../../utils/image';
import { setReservationList } from '../../redux/state';

const HostDashboard = () => {
    const dispatch = useDispatch();
    const user = useSelector((state) => state.user.user);
    const userId = user?._id;
    const navigate = useNavigate();
    const { formatPrice } = useCurrency();

    const reservationList = useSelector((state) => state.user.user?.reservationList || []);
    const [loading, setLoading] = useState(reservationList.length === 0);

    const { stats, weeklyEarnings, recentBookings } = useMemo(() => {
        let totalEarnings = 0;
        let pendingCount = 0;
        let acceptedCount = 0;
        let completedCount = 0;
        let cancelledCount = 0;
        let totalBookedDays = 0;
        const now = new Date();
        const wEarnings = [0, 0, 0, 0];

        reservationList.forEach(resv => {
            const days = Math.round((new Date(resv.endDate) - new Date(resv.startDate)) / (1000 * 60 * 60 * 24)) + 1;
            const earnings = resv.totalPrice || 0;

            if (resv.status !== 'cancelled' && resv.status !== 'rejected') {
                totalEarnings += earnings;
                totalBookedDays += days;

                // Calculate weekly grouping based on reservation date
                const resvDate = new Date(resv.createdAt || resv.startDate);
                const diffDays = Math.round((now - resvDate) / (1000 * 60 * 60 * 24));
                const weekIndex = 3 - Math.floor(diffDays / 7);
                if (weekIndex >= 0 && weekIndex < 4) {
                    wEarnings[weekIndex] += earnings;
                }
            }

            if (resv.status === 'pending') pendingCount++;
            else if (resv.status === 'accepted') acceptedCount++;
            else if (resv.status === 'completed') completedCount++;
            else if (resv.status === 'cancelled' || resv.status === 'rejected') cancelledCount++;
        });

        const occupancyRate = Math.min(Math.round((totalBookedDays / 180) * 100), 100);
        const sorted = [...reservationList].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

        return {
            stats: {
                totalEarnings: Math.round(totalEarnings),
                occupancyRate: occupancyRate || 0,
                totalReservations: reservationList.length,
                pendingCount,
                acceptedCount,
                completedCount,
                cancelledCount
            },
            weeklyEarnings: wEarnings,
            recentBookings: sorted
        };
    }, [reservationList]);

    useEffect(() => {
        if (!user || user.role !== 'host') {
            navigate('/');
            return;
        }

        const fetchReservations = async () => {
            try {
                const response = await apiFetch(`/users/${userId}/reservations`);
                const data = await response.json();

                if (response.ok) {
                    dispatch(setReservationList(data.reservations || []));
                }
            } catch (err) {
                console.error("Error fetching reservation analytics:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchReservations();
    }, [userId, user, navigate, dispatch]);

    const maxVal = Math.max(...weeklyEarnings, 100);

    return loading ? <Loader /> : (
        <div className="host-dashboard">
            <h1 className="dashboard-title">Host Performance Dashboard</h1>
            <p className="dashboard-subtitle">Track your rental statistics, occupancy analytics, and host earnings.</p>

            {/* Performance Counters Grid */}
            <div className="stats-grid">
                <div className="stat-card earnings">
                    <div className="card-left">
                        <span className="card-label">Total Rental Earnings</span>
                        <h2 className="card-value">{formatPrice(stats.totalEarnings)}</h2>
                        <span className="card-helper">From confirmed reservations</span>
                    </div>
                    <div className="card-icon-container">
                        <AccountBalanceWallet className="card-icon" />
                    </div>
                </div>

                <div className="stat-card occupancy">
                    <div className="card-left">
                        <span className="card-label">Occupancy Rate</span>
                        <h2 className="card-value">{stats.occupancyRate}%</h2>
                        <span className="card-helper">Active past 180 days</span>
                    </div>
                    <div className="card-icon-container">
                        <DateRange className="card-icon" />
                    </div>
                </div>

                <div className="stat-card bookings">
                    <div className="card-left">
                        <span className="card-label">Total Reservations</span>
                        <h2 className="card-value">{stats.totalReservations}</h2>
                        <span className="card-helper">All-time bookings count</span>
                    </div>
                    <div className="card-icon-container">
                        <Assessment className="card-icon" />
                    </div>
                </div>
            </div>

            {/* Sub-analytics breakdown */}
            <div className="dashboard-sections">
                <div className="analytics-breakdown card-box">
                    <h3><ShowChart className="sec-title-icon" /> Reservation Status Analytics</h3>
                    <div className="breakdown-grid">
                        <div className="breakdown-item pending">
                            <HourglassEmpty className="b-icon" />
                            <div className="b-meta">
                                <span className="b-count">{stats.pendingCount}</span>
                                <span className="b-label">Pending Requests</span>
                            </div>
                        </div>

                        <div className="breakdown-item accepted">
                            <CheckCircle className="b-icon" />
                            <div className="b-meta">
                                <span className="b-count">{stats.acceptedCount}</span>
                                <span className="b-label">Approved Upcoming</span>
                            </div>
                        </div>

                        <div className="breakdown-item completed">
                            <History className="b-icon" />
                            <div className="b-meta">
                                <span className="b-count">{stats.completedCount}</span>
                                <span className="b-label">Completed Stays</span>
                            </div>
                        </div>

                        <div className="breakdown-item cancelled">
                            <Cancel className="b-icon" />
                            <div className="b-meta">
                                <span className="b-count">{stats.cancelledCount}</span>
                                <span className="b-label">Cancelled/Rejected</span>
                            </div>
                        </div>
                    </div>

                    <div className="occupancy-progress-container">
                        <div className="progress-labels">
                            <span>Occupancy Threshold</span>
                            <span>{stats.occupancyRate}% / 100%</span>
                        </div>
                        <div className="progress-bar-bg">
                            <div className="progress-bar-fill" style={{ width: `${stats.occupancyRate}%` }}></div>
                        </div>
                        <p className="progress-note">
                            Tip: Update your pricing or offer coupon codes to boost listing occupancy rates!
                        </p>
                    </div>
                </div>

                {/* Weekly Earnings Trend Card */}
                <div className="weekly-trends-card card-box">
                    <h3>Weekly Earnings Growth</h3>
                    <p className="trends-desc">Weekly rental earnings over the past 4 weeks</p>
                    <div className="bar-chart-container">
                        {weeklyEarnings.map((earnings, idx) => {
                            const pct = (earnings / maxVal) * 100;
                            const label = idx === 3 ? 'This Week' : `${3 - idx}w ago`;
                            return (
                                <div key={idx} className="chart-bar-group">
                                    <div className="bar-wrapper">
                                        <div className="bar-tooltip">{formatPrice(Math.round(earnings))}</div>
                                        <div
                                            className="bar-fill"
                                            style={{ height: `${Math.max(pct, 6)}%` }}
                                        />
                                    </div>
                                    <span className="bar-label">{label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '32px' }} className="recent-activity-section card-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '10px' }}>
                    <h3 style={{ margin: 0 }}>Recent Reservation Activity</h3>
                    <button
                        onClick={() => navigate(`/${userId}/reservations`)}
                        className="all-properties-btn"
                        style={{
                            background: 'transparent',
                            border: '1px solid var(--primary-color, #22c55e)',
                            color: 'var(--primary-color, #22c55e)',
                            padding: '8px 16px',
                            borderRadius: '20px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            fontSize: '13px',
                            transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--primary-color, #22c55e)';
                            e.currentTarget.style.color = '#fff';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = 'var(--primary-color, #22c55e)';
                        }}
                    >
                        All Properties
                    </button>
                </div>
                <div className="recent-bookings-list">
                    {recentBookings.length > 0 ? (
                        recentBookings.map((booking) => {
                            const photoPath = resolveImageUrl(booking.listingId?.listingPhotoPaths && booking.listingId.listingPhotoPaths[0], "/assets/default.jpg");

                            return (
                                <div key={booking._id} className="recent-booking-item" onClick={() => {
                                    const getTargetTab = (b) => {
                                        if (b.status === "cancelled" || b.status === "rejected") return "cancelled";
                                        const start = new Date(b.startDate);
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        return start >= today ? "upcoming" : "completed";
                                    };
                                    navigate(`/${userId}/reservations`, { state: { tab: getTargetTab(booking) } });
                                }}>
                                    <img src={photoPath} alt={booking.listingId?.title} className="prop-thumb" onError={(e) => { e.target.onerror = null; e.target.src = "/assets/default.jpg"; }} />
                                    <div className="b-details">
                                        <h4>{booking.listingId?.title}</h4>
                                        <p className="guest-name">Guest: {booking.customerId?.firstName} {booking.customerId?.lastName}</p>
                                        <p className="stay-dates">{new Date(booking.startDate).toLocaleDateString()} - {new Date(booking.endDate).toLocaleDateString()}</p>
                                    </div>
                                    <div className="b-right">
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                            <span className={`status-badge ${booking.status}`}>{booking.status}</span>
                                            {booking.status === 'cancelled' && (
                                                <span style={{ fontSize: '10px', color: booking.cancelledBy === 'host' ? '#ea580c' : booking.cancelledBy === 'admin' ? '#ef4444' : 'var(--secondary-text-color)', fontWeight: 700 }}>
                                                    {booking.cancelledBy === 'host' ? 'By You' : booking.cancelledBy === 'admin' ? 'By Admin' : 'By Guest'}
                                                </span>
                                            )}
                                        </div>
                                        <span className="price-tag">{formatPrice(booking.totalPrice)}</span>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <p className="no-activity">No reservation history found on your properties yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HostDashboard;
