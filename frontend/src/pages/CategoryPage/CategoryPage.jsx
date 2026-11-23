import React, { useEffect, useState } from 'react'
import '../../styles/List.scss'
import Loader from '../../components/Loader/Loader';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { setListings } from '../../redux/state';
import ListingCard from '../../components/ListingCard/ListingCard';
import { ArrowBackIos } from '@mui/icons-material';

import { BACKEND_BASE_URL } from '../../config/constants';

const CategoryPage = () => {

    const [loading, setLoading] = useState(true);
    const { category } = useParams();
    const dispatch = useDispatch();
    const listings = useSelector((state) => state.user.listings || []);
    const navigate = useNavigate();

    const getFeedListings = async () => {
        setLoading(true);
        dispatch(setListings([]));
        try {
            const response = await fetch(`${BACKEND_BASE_URL}/properties?category=${category}`, {
                method: "GET"
            });

            const data = await response.json();
            dispatch(setListings(data));
        } catch (error) {
            console.log(error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        getFeedListings();
    }, [category]);

    return loading ? <Loader /> : (
        <div className="list-page">
            <button className="back-btn" onClick={() => navigate(-1)}>
                <ArrowBackIos sx={{ fontSize: '16px' }} />
                Back
            </button>
            <h1 className="title-list">{category} listings</h1>
            {Array.isArray(listings) && listings.length > 0 ? (
                <div className="list">
                    {listings.map(({ _id, creator, listingPhotoPaths, city, province, country, category, type, price, booking = false }) => (
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
                            booking={booking}
                        />
                    ))}
                </div>
            ) : (
                <div className="empty-message">
                    <h2>No listings found</h2>
                    <p>We couldn't find any "{category}" listings. Explore other categories above.</p>
                    <div className="sparkle" />
                </div>
            )}
        </div>
    )
}

export default CategoryPage
