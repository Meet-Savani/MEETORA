import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/Loader/Loader';
import { NotificationsActive, Info, CreditCard, CalendarToday, LocalOffer, Delete } from '@mui/icons-material';
import { setToast } from '../../redux/state';
import '../../styles/Notifications.scss';
import { apiFetch, apiPatch, apiDelete } from '../../utils/api';
import ConfirmationModal from '../../components/ConfirmationModal/ConfirmationModal';

const NotificationsPage = () => {
    const [loading, setLoading] = useState(true);
    const [notifications, setNotifications] = useState([]);
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, notifId: null });
    
    const user = useSelector((state) => state.user.user);
    const userId = user?._id;
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const fetchNotifications = async () => {
        if (!userId) return;
        try {
            const response = await apiFetch(`/notifications/${userId}`);
            const data = await response.json();
            if (response.ok) {
                const fetchedNotifs = data.notifications || [];
                setNotifications(fetchedNotifs);

                // Auto-read on load if there are unread notifications
                if (fetchedNotifs.some(n => !n.isRead)) {
                    apiPatch(`/notifications/${userId}/mark-read`, {}).catch(err => console.error("Error auto-marking read:", err));
                }
            }
        } catch (err) {
            console.error("Error fetching notifications:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!userId) {
            navigate('/login');
            return;
        }
        fetchNotifications();
    }, [userId]);

    const handleDelete = (notifId) => {
        setDeleteModal({ isOpen: true, notifId });
    };

    const confirmDelete = async () => {
        const notifId = deleteModal.notifId;
        try {
            const response = await apiDelete(`/notifications/${notifId}`);
            if (response.ok) {
                setNotifications((prev) => prev.filter((n) => n._id !== notifId));
                dispatch(setToast({ message: "Notification deleted successfully.", type: "success" }));
            }
        } catch (err) {
            console.error("Error deleting notification:", err);
        } finally {
            setDeleteModal({ isOpen: false, notifId: null });
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case 'booking':
                return <CalendarToday className="notif-icon booking" />;
            case 'payment':
                return <CreditCard className="notif-icon payment" />;
            case 'promo':
                return <LocalOffer className="notif-icon promo" />;
            default:
                return <Info className="notif-icon default" />;
        }
    };

    return loading ? <Loader /> : (
        <div className="notifications-page">
            <div className="notifications-header">
                <div className="header-left">
                    <NotificationsActive className="header-icon" />
                    <h1>Notifications</h1>
                </div>
            </div>

            <div className="notifications-list">
                {notifications.length > 0 ? (
                    notifications.map((notif) => (
                        <div key={notif._id} className={`notification-item ${notif.isRead ? 'read' : 'unread'}`}>
                            <div className="icon-wrapper">
                                {getIcon(notif.type)}
                            </div>
                            <div className="notif-content">
                                <div className="notif-header-row">
                                    <div className="title-with-badge">
                                        <h3>{notif.title}</h3>
                                        {!notif.isRead && <span className="unread-dot" title="Unread"></span>}
                                    </div>
                                    <span className="notif-time">
                                        {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <p className="notif-message">{notif.message}</p>
                            </div>
                            <button className="delete-notif-btn" onClick={() => handleDelete(notif._id)} title="Delete notification">
                                <Delete sx={{ fontSize: 20 }} />
                            </button>
                        </div>
                    ))
                ) : (
                    <div className="empty-notifications">
                        <NotificationsActive className="empty-icon" />
                        <h2>All caught up!</h2>
                        <p>No new notifications at this time.</p>
                    </div>
                )}
            </div>
            <ConfirmationModal
                open={deleteModal.isOpen}
                title="Delete Notification"
                message="Are you sure you want to delete this notification?"
                type="confirm"
                onConfirm={confirmDelete}
                onCancel={() => setDeleteModal({ isOpen: false, notifId: null })}
            />
        </div>
    );
};

export default NotificationsPage;
