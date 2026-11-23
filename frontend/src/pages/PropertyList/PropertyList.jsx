import React, { useEffect, useState } from 'react'
import '../../styles/List.scss'
import '../../styles/PropertyManagement.scss'
import { useDispatch, useSelector } from 'react-redux';
import { setPropertyList, setToast } from '../../redux/state';
import Loader from '../../components/Loader/Loader';
import ListingCard from '../../components/ListingCard/ListingCard';
import { useNavigate } from 'react-router-dom';
import { Edit, Delete, Archive, Unarchive, Add, FilterList, KeyboardArrowDown } from '@mui/icons-material';
import { apiFetch, apiPost, apiPatch, apiDelete } from '../../utils/api';
import ConfirmationModal from '../../components/ConfirmationModal/ConfirmationModal';

const PropertyList = () => {
    const navigate = useNavigate();
    const [actionLoading, setActionLoading] = useState(null);
    const [deleteModal, setDeleteModal] = useState({ open: false, propertyId: null, title: '' });
    const [statusFilter, setStatusFilter] = useState('all');
    const user = useSelector((state) => state.user.user);
    const propertyList = user?.propertyList || [];
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(propertyList.length === 0);

    const getPropertyList = async () => {
        if (!user?._id) return;
        try {
            const response = await apiFetch(`/users/${user._id}/properties`);
            const data = await response.json();
            if (response.ok) {
                dispatch(setPropertyList(data.properties));
            }
            setLoading(false);
        } catch (error) {
            console.log("Failed to fetch property list", error);
            setLoading(false);
        }
    };

    useEffect(() => {
        getPropertyList();
    }, [user?._id]);


    const handleArchive = async (property) => {
        setActionLoading(property._id);
        try {
            const res = await apiPatch(`/properties/${property._id}/archive`, {});
            const data = await res.json();
            if (res.ok) {
                dispatch(setToast({ message: data.message, type: 'success' }));
                getPropertyList();
            } else {
                dispatch(setToast({ message: data.message || 'Failed to update.', type: 'error' }));
            }
        } catch {
            dispatch(setToast({ message: 'Error updating property.', type: 'error' }));
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelete = async () => {
        if (!deleteModal.propertyId) return;
        setActionLoading(deleteModal.propertyId);
        try {
            const res = await apiDelete(`/properties/${deleteModal.propertyId}`);
            const data = await res.json();
            if (res.ok) {
                dispatch(setToast({ message: data.message, type: 'success' }));
                setDeleteModal({ open: false, propertyId: null, title: '' });
                getPropertyList();
            } else {
                dispatch(setToast({ message: data.message || 'Failed to delete.', type: 'error' }));
            }
        } catch {
            dispatch(setToast({ message: 'Error deleting property.', type: 'error' }));
        } finally {
            setActionLoading(null);
        }
    };

    const statusLabel = (status) => {
        const map = {
            approved: 'Live',
            pending: 'Pending Review',
            rejected: 'Rejected',
            paused: 'Paused',
            suspended: 'Suspended',
            archived: 'Archived',
        };
        return map[status] || status;
    };

    const counts = {
        all: propertyList.length,
        approved: propertyList.filter(p => !p.isArchived && p.isApproved === 'approved').length,
        pending: propertyList.filter(p => !p.isArchived && (p.isApproved === 'pending' || !p.isApproved)).length,
        rejected: propertyList.filter(p => !p.isArchived && p.isApproved === 'rejected').length,
        archived: propertyList.filter(p => p.isArchived).length,
    };

    const displayedProperties = propertyList.filter(p => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'archived') return p.isArchived;
        if (p.isArchived) return false;
        if (statusFilter === 'pending') return p.isApproved === 'pending' || !p.isApproved;
        return p.isApproved === statusFilter;
    });

    return loading ? <Loader /> : (
        <div className='list-page property-management-page'>
            <div className="property-management-header">
                <div>
                    <h1 className="title-list">Your Properties</h1>
                    <p className="subtitle">
                        Manage, edit, duplicate, filter, or archive your property listings
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button className="add-property-btn" onClick={() => navigate('/create-listing')}>
                        <Add /> Add Property
                    </button>
                </div>
            </div>

            {/* Desktop Tabs */}
            <div className="trip-tabs desktop-only">
                <button 
                    className={statusFilter === 'all' ? 'tab-btn active' : 'tab-btn'} 
                    onClick={() => setStatusFilter('all')}>
                    All Properties <span className="tab-pill">{counts.all}</span>
                </button>
                <button 
                    className={statusFilter === 'approved' ? 'tab-btn active' : 'tab-btn'} 
                    onClick={() => setStatusFilter('approved')}>
                    Live / Approved <span className="tab-pill">{counts.approved}</span>
                </button>
                <button 
                    className={statusFilter === 'pending' ? 'tab-btn active' : 'tab-btn'} 
                    onClick={() => setStatusFilter('pending')}>
                    Pending Review <span className="tab-pill">{counts.pending}</span>
                </button>
                <button 
                    className={statusFilter === 'rejected' ? 'tab-btn active' : 'tab-btn'} 
                    onClick={() => setStatusFilter('rejected')}>
                    Rejected <span className="tab-pill">{counts.rejected}</span>
                </button>
                <button 
                    className={statusFilter === 'archived' ? 'tab-btn active' : 'tab-btn'} 
                    onClick={() => setStatusFilter('archived')}>
                    Archived <span className="tab-pill">{counts.archived}</span>
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
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="status-dropdown-select"
                        >
                            <option value="all">All Properties ({counts.all})</option>
                            <option value="approved">Live / Approved ({counts.approved})</option>
                            <option value="pending">Pending Review ({counts.pending})</option>
                            <option value="rejected">Rejected ({counts.rejected})</option>
                            <option value="archived">Archived ({counts.archived})</option>
                        </select>
                        <KeyboardArrowDown className="select-arrow-icon" />
                    </div>
                </div>
            </div>

            {displayedProperties.length > 0 ? (
                <div className="property-management-grid">
                    {displayedProperties.map((property) => {
                        const { _id, creator, listingPhotoPaths, city, province, country, category, type, price, title, isFeatured, bookingType, isApproved, isArchived, avgRating, reviewCount } = property;
                        return (
                            <div className="property-management-card" key={_id}>
                                <ListingCard
                                    listingId={_id}
                                    creator={creator}
                                    listingPhotoPaths={listingPhotoPaths}
                                    city={city}
                                    province={province}
                                    country={country}
                                    category={category}
                                    type={type}
                                    price={price}
                                    title={title}
                                    isFeatured={isFeatured}
                                    bookingType={bookingType}
                                    avgRating={avgRating}
                                    reviewCount={reviewCount}
                                />
                                <div className="property-card-meta">
                                    {isArchived ? (
                                        <span className="status-badge-table archived">
                                            Archived
                                        </span>
                                    ) : (
                                        isApproved !== 'approved' && (
                                            <span className={`status-badge-table ${isApproved}`}>
                                                {statusLabel(isApproved)}
                                            </span>
                                        )
                                    )}
                                </div>
                                <div className="property-card-actions">
                                    <button
                                        title="Edit"
                                        disabled={actionLoading === _id}
                                        onClick={(e) => { e.stopPropagation(); navigate(`/properties/${_id}/edit`); }}
                                    >
                                        <Edit sx={{ fontSize: 16 }} /> Edit
                                    </button>

                                    <button
                                        title={isArchived ? 'Restore' : 'Archive'}
                                        disabled={actionLoading === _id}
                                        onClick={(e) => { e.stopPropagation(); handleArchive(property); }}
                                    >
                                        {isArchived ? <Unarchive sx={{ fontSize: 16 }} /> : <Archive sx={{ fontSize: 16 }} />}
                                        {isArchived ? 'Restore' : 'Archive'}
                                    </button>
                                    <button
                                        className="danger"
                                        title="Delete"
                                        disabled={actionLoading === _id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setDeleteModal({ open: true, propertyId: _id, title: title || 'this property' });
                                        }}
                                    >
                                        <Delete sx={{ fontSize: 16 }} /> Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="property-empty-state">
                    <p>{statusFilter === 'all' ? "You haven't listed any properties yet." : `No listings found in category "${statusLabel(statusFilter)}".`}</p>
                    {statusFilter === 'all' && <button onClick={() => navigate('/create-listing')}>Create Your First Listing</button>}
                </div>
            )}

            <ConfirmationModal
                open={deleteModal.open}
                type="confirm"
                title="Delete Property"
                message={`Are you sure you want to permanently delete "${deleteModal.title}"? This cannot be undone.`}
                onConfirm={handleDelete}
                onCancel={() => setDeleteModal({ open: false, propertyId: null, title: '' })}
            />
        </div>
    );
};

export default PropertyList;
