import React, { useEffect, useState } from 'react';
import '../../styles/List.scss';
import ListingCard from '../../components/ListingCard/ListingCard';
import Loader from '../../components/Loader/Loader';
import { useDispatch, useSelector } from 'react-redux';
import { setListings } from '../../redux/state';
import { categories } from '../../data';
import { BACKEND_BASE_URL } from '../../config/constants';

const ExplorePage = () => {
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [sortBy, setSortBy] = useState('newest');
    const dispatch = useDispatch();
    const listings = useSelector((state) => state.user.listings || []);
    const [loading, setLoading] = useState(listings.length === 0);

    const getExploreListings = async () => {
        try {
            const url = selectedCategory !== 'All'
                ? `${BACKEND_BASE_URL}/properties?category=${selectedCategory}`
                : `${BACKEND_BASE_URL}/properties`;
            const response = await fetch(url, { method: 'GET' });
            const data = await response.json();
            dispatch(setListings(data));
            setLoading(false);
        } catch (error) {
            console.log('Explore listings fetch failed!', error);
            setLoading(false);
        }
    };

    useEffect(() => {
        setLoading(listings.length === 0);
        getExploreListings();
    }, [selectedCategory]);

    const uniqueListings = Array.from(
        new Map(listings.map((item) => [item._id?.toString() || item._id, item])).values()
    );

    const sortedListings = [...uniqueListings].sort((a, b) => {
        if (sortBy === 'price-low') return a.price - b.price;
        if (sortBy === 'price-high') return b.price - a.price;
        if (sortBy === 'newest') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        return 0;
    });

    const categoryList = Array.from(new Set(categories.map((c) => c.label)));

    return loading ? <Loader /> : (
        <div className="list-page explore-page">
            <h1 className="title-list">Explore Properties</h1>
            <p className="explore-subtitle">Discover vacation rentals across all categories</p>

            <div className="explore-filters">
                <div className="category-filter desktop-only">
                    {categoryList.map((cat) => (
                        <button
                            key={cat}
                            className={selectedCategory === cat ? 'filter-chip active' : 'filter-chip'}
                            onClick={() => setSelectedCategory(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
                <div className="mobile-category-select-wrapper mobile-only">
                    <select
                        className="mobile-category-select"
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                        {categoryList.map((cat) => (
                            <option key={cat} value={cat}>
                                {cat === 'All' ? 'All Categories' : cat}
                            </option>
                        ))}
                    </select>
                </div>
                <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                    <option value="newest">Sort: Newest</option>
                    <option value="price-low">Sort: Price Low to High</option>
                    <option value="price-high">Sort: Price High to Low</option>
                </select>
            </div>

            <div className="list">
                {sortedListings.length > 0 ? (
                    sortedListings.map(({ _id, creator, listingPhotoPaths, city, province, country, category, type, price, title, isFeatured, bookingType, avgRating, reviewCount, booking = false }) => (
                        <ListingCard
                            key={_id}
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
                            booking={booking}
                        />
                    ))
                ) : (
                    <p className="no-trips">No properties found. Try a different category.</p>
                )}
            </div>
        </div>
    );
};

export default ExplorePage;
