import React, { useState, useEffect } from 'react'
import '../../styles/ListingCard.scss'
import { ArrowBackIos, ArrowForwardIos, Favorite, Star } from '@mui/icons-material'
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { setWishList } from '../../redux/state';
import useCurrency from '../../hooks/useCurrency';
import { apiFetch, apiPatch, apiDelete } from '../../utils/api';
import { BACKEND_BASE_URL } from '../../config/constants';
import { resolveImageUrl } from '../../utils/image';

const resolvePhotoUrl = (photo) => {
    return resolveImageUrl(photo, '/assets/default.jpg');
};

const ListingCard = ({
    listingId, creator, listingPhotoPaths, city, province, country, category, type, price, title, isFeatured, bookingType, startDate, endDate, totalPrice, booking,
    avgRating: propAvgRating, reviewCount: propReviewCount, showHost
}) => {

    // Slider for Image 
    const [currentIndex, setCurrentIndex] = useState(0);
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useDispatch();
    const { formatPrice } = useCurrency();

    // Resolve property owner details
    const [owner, setOwner] = useState(
        creator && typeof creator === 'object' ? creator : null
    );

    useEffect(() => {
        if (creator && typeof creator === 'object' && (creator.firstName || creator.profileImagePath)) {
            setOwner(creator);
            return;
        }

        const creatorId = typeof creator === 'string' ? creator : creator?._id;
        if (!creatorId) return;

        let isMounted = true;
        const fetchOwner = async () => {
            try {
                const res = await fetch(`${BACKEND_BASE_URL}/users/${creatorId}`);
                if (res.ok && isMounted) {
                    const data = await res.json();
                    if (data?.user) {
                        setOwner(data.user);
                    } else if (data) {
                        setOwner(data);
                    }
                }
            } catch (err) {
                console.error("Error fetching listing owner:", err);
            }
        };
        fetchOwner();
        return () => { isMounted = false; };
    }, [creator]);

    const firstName = owner?.firstName?.trim() || '';
    const lastName = owner?.lastName?.trim() || '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ');
    const ownerName = fullName || 'Property Host';

    const getInitials = (first, last, name) => {
        if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
        if (first) return first.slice(0, 2).toUpperCase();
        if (name && name !== 'Property Host') {
            const parts = name.split(' ').filter(Boolean);
            if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
            return parts[0].slice(0, 2).toUpperCase();
        }
        return 'PH';
    };
    const ownerInitials = getInitials(firstName, lastName, ownerName);

    const profileImgUrl = resolveImageUrl(owner?.profileImagePath, null);
    const [imgError, setImgError] = useState(false);

    useEffect(() => {
        setImgError(false);
    }, [profileImgUrl]);

    const [ratingData, setRatingData] = useState(
        propAvgRating !== undefined && propAvgRating !== null && propReviewCount > 0
            ? { avgRating: Number(propAvgRating), reviewCount: Number(propReviewCount) }
            : null
    );

    useEffect(() => {
        let isMounted = true;
        const fetchRating = async () => {
            try {
                const response = await fetch(`${BACKEND_BASE_URL}/properties/${listingId}/rating`);
                if (response.ok && isMounted) {
                    const data = await response.json();
                    if (data && typeof data.avgRating === 'number') {
                        setRatingData(data);
                    }
                }
            } catch (err) {
                console.error("Error fetching rating summary:", err);
            }
        };

        if (listingId) {
            fetchRating();
        }

        return () => { isMounted = false; };
    }, [listingId]);

    const goToPrevSlide = () => {
        if(currentIndex === 0) return;
        setCurrentIndex(currentIndex - 1); 
    }
    
    const goToNextSlide = () => {
        if(currentIndex === listingPhotoPaths.length - 1) return;
        setCurrentIndex(currentIndex + 1); 
    }

    const handleCardClick = () => {
        navigate(`/properties/${listingId}`);
    };

    // Add to wishlist 
    const user = useSelector((state) => state.user.user);
    const wishList = user?.wishList || [];

    const isLiked = wishList.find((item) => item?._id === listingId);
    
    const creatorId = creator?._id || creator;
    const isCreator = user?._id && creatorId && user._id.toString() === creatorId.toString();
    
    const patchWishList = async () => {
        if(!user?._id) return;

        try {
            const response = await apiPatch(`/users/${user?._id}/${listingId}`, {});

            if (!response.ok) {
                console.error("Failed to update wishlist:", response.status);
                return;
            }
            
            const data = await response.json();
            dispatch(setWishList(data.wishList));
        } catch(error) {
            console.error("Error updating wishlist:", error);
        }
    }

    return (
        <div className='listing-card' onClick={handleCardClick}>
            <div className="slider-container">
                <div className="slider" style={{ transform: `translateX(-${currentIndex * 100}%)`}}>
                    {listingPhotoPaths?.length > 0 ? listingPhotoPaths.map((photo, index) => {
                        const isNearby = Math.abs(index - currentIndex) <= 1;
                        return (
                            <div className="slide" key={index}>
                                {isNearby ? (
                                    <img 
                                        src={resolvePhotoUrl(photo)}
                                        alt={title || `photo ${index + 1}`}
                                        loading="lazy"
                                        decoding="async"
                                        onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.src = "/assets/default.jpg";
                                        }}
                                    />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', minHeight: '200px', backgroundColor: '#f3f4f6' }} />
                                )}
                            </div>
                        );
                    }) : (
                        <div className="slide">
                            <img 
                                src="/assets/default.jpg" 
                                alt={title || "Property"} 
                                loading="lazy" 
                            />
                        </div>
                    )}
                </div>

                {listingPhotoPaths?.length > 1 && (
                    <>
                        <div className={`prev-button ${currentIndex === 0 ? 'disabled' : ''}`} onClick={(e) => {
                                e.stopPropagation();
                                goToPrevSlide(e)
                            }}>
                            <ArrowBackIos sx={{ fontSize: "14px", transform: "translateX(2px)" }} />
                        </div>
                        <div className={`next-button ${currentIndex === listingPhotoPaths.length - 1 ? 'disabled' : ''}`} onClick={(e) => {
                                e.stopPropagation();
                                goToNextSlide(e)
                            }}>
                            <ArrowForwardIos sx={{ fontSize: "14px" }} />
                        </div>
                        <div className="slider-dots">
                            {listingPhotoPaths.map((_, index) => (
                                <span 
                                    key={index} 
                                    className={`dot ${index === currentIndex ? 'active' : ''}`}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>

            <div className="card-badges">
                {isFeatured && <span className="badge badge-featured">Featured</span>}
            </div>

            <div className="card-header">
                <div className="property-info">
                    {title && <h3 className="property-title">{title}</h3>}
                    <p className="property-location">{city}, {province}</p>
                </div>
                {ratingData && ratingData.reviewCount > 0 && Number(ratingData.avgRating) > 0 ? (
                    <div className="card-rating">
                        <Star sx={{ color: "#f59e0b", fontSize: 16 }} />
                        <span>{Number(ratingData.avgRating).toFixed(1)}</span>
                    </div>
                ) : (
                    <div className="card-rating card-rating-none">
                        <span className="no-review-badge">New</span>
                    </div>
                )}
            </div>
            <p className="property-meta">{category} · {type}</p>
            
            {!booking ? (
                <>
                    <p><span>{formatPrice(price)}</span> per night</p>
                </>
            ) : (
                <>
                    <p>{startDate} - {endDate}</p>
                    <p><span>{formatPrice(totalPrice)}</span> total</p>
                </>
            )}


            {user && !isCreator && (
                <button 
                    className="favorite" 
                    onClick={(e) => {
                        e.stopPropagation();
                        patchWishList();
                    }} 
                    disabled={!user}>
                    {isLiked ? (
                        <Favorite sx={{color: "red" }} />
                    ) : (
                        <Favorite sx={{ color: "white" }} />
                    )}
                </button>
            )}
            
        </div>
    )
}

export default ListingCard
