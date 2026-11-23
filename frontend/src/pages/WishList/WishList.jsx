import React from 'react'
import '../../styles/List.scss'
import { useSelector } from 'react-redux'
import Navbar from '../../components/Navbar/Navbar';
import ListingCard from '../../components/ListingCard/ListingCard';

const WishList = () => {

    const wishList = useSelector((state) => state.user.user?.wishList);

    return (
        <div className='list-page'>
            <h1 className="title-list">Your Wish List</h1>
            {wishList && wishList.length > 0 ? (
                <div className="list">
                    {wishList.map(({ _id, creator, listingPhotoPaths, city, province, country, category, type, price, booking=false }) => (
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
                            booking={booking} />
                    ))}
                </div>
            ) : (
                <div style={{ textAlign: "center", margin: "60px auto", color: "var(--secondary-text-color)", fontSize: "18px" }}>
                    No properties added to your wish list yet. Start exploring properties to save them here!
                </div>
            )}
        </div>
    )
}

export default WishList
