import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

// Async thunk to fetch exchange rates (base USD)
export const fetchRates = createAsyncThunk('currency/fetchRates', async (base = 'USD') => {
  try {
    const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${base}`, {
      timeout: 1000 // 1 second timeout to prevent page hangs on restricted/slow networks
    });
    return response.data.rates;
  } catch (error) {
    console.warn("Exchange rate API timed out or failed. Using offline fallback rates:", error.message);
    return {
      USD: 1,
      EUR: 0.92,
      GBP: 0.79,
      INR: 83.30,
      AUD: 1.52,
      CAD: 1.36,
      CHF: 0.88,
      NZD: 1.64,
      AED: 3.67,
      SGD: 1.34
    };
  }
});

const currencySlice = createSlice({
  name: 'currency',
  initialState: {
    selected: 'USD',
    rates: {},
    status: 'idle',
    error: null,
  },
  reducers: {
    setCurrency(state, action) {
      state.selected = action.payload;
      // Persist to localStorage
      localStorage.setItem('selectedCurrency', action.payload);
    },
    loadCurrencyFromStorage(state) {
      const stored = localStorage.getItem('selectedCurrency');
      if (stored) state.selected = stored;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRates.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchRates.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.rates = action.payload;
      })
      .addCase(fetchRates.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message;
      });
  },
});

export const { setCurrency, loadCurrencyFromStorage } = currencySlice.actions;
export default currencySlice.reducer;
