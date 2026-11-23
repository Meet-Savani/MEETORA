import { createSlice } from '@reduxjs/toolkit'

const initialState = {
    user: null,
    token: null,
    toast: null,
    listings: [],
}

export const userSlice = createSlice({
    name: "user",
    initialState,
    reducers: {
        setLogin: (state, action) => {
            if (!state) return;
            state.user = action.payload.user;
            state.token = action.payload.token;
        },
        setLogout: (state) => {
            if (!state) return;
            state.user = null;
            state.token = null;
        },
        setUpdateUser: (state, action) => {
            if (!state) return;
            state.user = { ...state.user, ...action.payload };
        },
        setListings: (state, action) => {
    // API returns { listings: [...], message: "..." }
    // Store only the array of listings for component consumption
    if (action.payload && Array.isArray(action.payload.listings)) {
        state.listings = action.payload.listings;
    } else if (Array.isArray(action.payload)) {
        // Fallback if payload is already an array
        state.listings = action.payload;
    } else {
        state.listings = [];
    }
},
        setTripList: (state, action) => {
            if (!state) return;
            if (state.user) state.user.tripList = action.payload;
        },
        setWishList: (state, action) => {
            if (!state) return;
            if (state.user) state.user.wishList = action.payload;
        },
        setPropertyList: (state, action) => {
            if (!state) return;
            if (state.user) state.user.propertyList = action.payload;
        },
        setReservationList: (state, action) => {
            if (!state) return;
            if (state.user) state.user.reservationList = action.payload;
        },
        setToast: (state, action) => {
            if (!state) return;
            state.toast = action.payload;
        }
    }
})

export const { setLogin, setLogout, setUpdateUser, setListings, setTripList, setWishList, setPropertyList, setReservationList, setToast } = userSlice.actions;
export default userSlice.reducer;