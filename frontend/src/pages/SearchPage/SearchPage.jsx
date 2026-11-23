import React, { useEffect, useState } from 'react'
import '../../styles/List.scss'
import ListingCard from '../../components/ListingCard/ListingCard';
import Loader from '../../components/Loader/Loader';
import { useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { setListings } from '../../redux/state';
import { BACKEND_BASE_URL } from '../../config/constants';

const SearchPage = () => {
    const [loading, setLoading] = useState(true);
    const { search } = useParams();
    const dispatch = useDispatch();
    const listings = useSelector((state) => state.user.listings || []);

    const getSearchListings = async () => {
        try {
            const response = await fetch(`${BACKEND_BASE_URL}/properties/search/${search}`, {
                method: 'GET'
            });
            const data = await response.json();
            dispatch(setListings(data));
            setLoading(false);
        } catch (error) {
            console.log('Search list fetch failed!', error);
            setLoading(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        getSearchListings();
    }, [search]);

    return loading ? <Loader /> : (
        <div className="list-page">
            <h1 className="title-list">{search === 'all' ? 'All Properties' : `Results for "${decodeURIComponent(search)}"`}</h1>
            <div className="list">
                {listings?.length > 0 ? listings.map(({ _id, creator, listingPhotoPaths, city, province, country, category, type, price, title, isFeatured, bookingType, booking = false }) => (
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
                        booking={booking}
                    />
                )) : (
                    <p className="no-trips">No properties found for this search.</p>
                )}
            </div>
        </div>
    );
};

export default SearchPage;
