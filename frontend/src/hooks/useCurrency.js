import { useSelector } from 'react-redux';

const currencySymbols = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'CHF',
  NZD: 'NZ$',
  AED: 'AED',
  SGD: 'S$'
};

const useCurrency = () => {
  const { selected, rates } = useSelector((state) => state.currency);

  const formatPrice = (priceInUSD) => {
    const rate = rates[selected] || 1;
    const convertedPrice = priceInUSD * rate;
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: selected || 'USD',
      currencyDisplay: 'symbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(convertedPrice);
  };

  return { formatPrice, selectedCurrency: selected, symbol: currencySymbols[selected] || '$' };
};

export default useCurrency;
