import React, { useEffect, useState } from 'react'
import { categories } from '../../data'
import '../../styles/Listings.scss'
import ListingCard from '../ListingCard/ListingCard'
import '../../styles/EmptyMessage.scss'
import { useDispatch, useSelector } from 'react-redux'
import { setListings } from '../../redux/state'
import { useNavigate } from 'react-router-dom'

import { BACKEND_BASE_URL } from '../../config/constants'

const Listings = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [selectedCategory, setSelectedCategory] = useState("All");
    const listings = useSelector((state) => state.user.listings || []);
    const [limit, setLimit] = useState(9);

    useEffect(() => {
        const updateLimit = () => {
            const width = window.innerWidth;
            if (width <= 480) {
                setLimit(4);
            } else if (width <= 1024) {
                setLimit(6);
            } else {
                setLimit(9);
            }
        };

        updateLimit();
        window.addEventListener('resize', updateLimit);
        return () => window.removeEventListener('resize', updateLimit);
    }, []);

    const getFeedListings = async () => {
        try {
            const response = await fetch(
                selectedCategory !== "All"
                    ? `${BACKEND_BASE_URL}/properties?category=${selectedCategory}`
                    : `${BACKEND_BASE_URL}/properties`,
                { method: "GET" }
            );
            const data = await response.json();
            dispatch(setListings(data));
        } catch (error) {
            console.log(error);
        }
    };

    useEffect(() => {
        getFeedListings();
    }, [selectedCategory]);

    return (
        <div>
            <div className='category-list'>
                {categories?.map((category, index) => (
                    <div className={`category ${category.label === selectedCategory ? "selected" : ""}`} key={index} onClick={() => setSelectedCategory(category.label)}>
                        <div className='category_icon'>{category.icon}</div>
                        <p>{category.label}</p>
                    </div>
                ))}
            </div>
            {listings && listings.length > 0 ? (
                <>
                    <div className='listings'>
                        {Array.isArray(listings) && listings.slice(0, limit).map((listing) => (
                            <ListingCard
                                key={listing._id}
                                listingId={listing._id}
                                creator={listing.creator}
                                listingPhotoPaths={listing.listingPhotoPaths}
                                city={listing.city}
                                province={listing.province}
                                country={listing.country}
                                category={listing.category}
                                type={listing.type}
                                price={listing.price}
                                title={listing.title}
                                isFeatured={listing.isFeatured}
                                bookingType={listing.bookingType}
                                avgRating={listing.avgRating}
                                reviewCount={listing.reviewCount}
                            />
                        ))}
                    </div>
                    {listings.length > limit && (
                        <div className="view-all-container">
                            <button className="view-all-btn" onClick={() => navigate('/explore')}>
                                View All
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <div className="listings-empty">
                    <div className="empty-message">
                        <h2>{selectedCategory} doesn't exist</h2>
                        <p>We couldn't find any listings for this category. Explore other categories above.</p>
                        <div className="sparkle" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default Listings;
