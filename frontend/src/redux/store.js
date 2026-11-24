import { configureStore, combineReducers } from "@reduxjs/toolkit";
import {
    persistStore,
    persistReducer,
    createTransform,
    FLUSH,
    REHYDRATE,
    PAUSE,
    PERSIST,
    PURGE,
    REGISTER,
} from "redux-persist";
import storage from "redux-persist/lib/storage";
import state from "./state";
import currencyReducer from './currencySlice';

// Strip transient UI state like toast from persistent storage
const userTransform = createTransform(
    (inboundState) => {
        if (!inboundState) return inboundState;
        const { toast, ...rest } = inboundState;
        return rest;
    },
    (outboundState) => {
        if (!outboundState) return outboundState;
        return { ...outboundState, toast: null };
    },
    { whitelist: ['user'] }
);

const persistConfig = {
    key: "root",
    version: 1,
    storage,
    whitelist: ["user", "currency"],
    transforms: [userTransform],
};

const rootReducer = combineReducers({
  user: state,
  currency: currencyReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
            },
        }),
});

export let persistor = persistStore(store);
