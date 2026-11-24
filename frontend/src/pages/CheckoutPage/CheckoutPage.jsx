import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { CreditCard, LocalOffer, CalendarToday, CheckCircleOutline, ChevronLeft } from '@mui/icons-material';
import { setToast } from '../../redux/state';
import PaymentProcessing from '../../components/PaymentProcessing/PaymentProcessing';
import '../../styles/Checkout.scss';
import useCurrency from '../../hooks/useCurrency';
import { apiPost, apiGet } from '../../utils/api';
import { BACKEND_BASE_URL } from '../../config/constants';
import { resolveImageUrl } from '../../utils/image';

const CheckoutPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { bookingForm, listing } = location.state || {};
    const { formatPrice } = useCurrency();

    const user = useSelector((state) => state.user.user);

    const [coupon, setCoupon] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState(() => {
        try {
            const saved = localStorage.getItem(`applied_coupon_${listing?._id}`);
            return saved ? JSON.parse(saved).code : '';
        } catch {
            return '';
        }
    });
    const [discount, setDiscount] = useState(() => {
        try {
            const saved = localStorage.getItem(`applied_coupon_${listing?._id}`);
            return saved ? JSON.parse(saved).discount : 0;
        } catch {
            return 0;
        }
    });
    const [couponError, setCouponError] = useState('');

    const [cardName, setCardName] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [expiry, setExpiry] = useState('');
    const [cvv, setCvv] = useState('');
    const [errors, setErrors] = useState({});

    const [processing, setProcessing] = useState(false);
    const [success, setSuccess] = useState(false);

    // Lock body scrolling when payment processing or confirmation is displayed
    React.useEffect(() => {
        if (processing || success) {
            const prevOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = prevOverflow || 'unset';
            };
        }
    }, [processing, success]);

    if (!bookingForm || !listing) {
        return (
            <div className="checkout-error-state">
                <h2>No active checkout session.</h2>
                <button onClick={() => navigate('/')}>Back to Home</button>
            </div>
        );
    }

    const baseRent = listing?.price ? (listing.price * (bookingForm.dayCount || 1)) : (bookingForm.totalPrice || 0);
    const netRent = Math.max(0, baseRent - discount);
    const sgst = Math.round(netRent * 0.09 * 100) / 100;
    const cgst = Math.round(netRent * 0.09 * 100) / 100;
    const finalPrice = Math.round((netRent + sgst + cgst) * 100) / 100;

    const handleApplyCoupon = async (e) => {
        e.preventDefault();
        setCouponError('');
        if (!coupon.trim()) return;

        try {
            const response = await apiGet(`/bookings/coupons/validate/${coupon.trim()}`);
            const data = await response.json();

            if (response.ok) {
                const cDoc = data.coupon;
                let disc = 0;
                if (cDoc.discountType === 'percentage') {
                    disc = Math.round(baseRent * (cDoc.discountValue / 100));
                } else if (cDoc.discountType === 'flat') {
                    disc = Math.min(cDoc.discountValue, baseRent);
                }
                setDiscount(disc);
                setAppliedCoupon(cDoc.code);
                localStorage.setItem(`applied_coupon_${listing._id}`, JSON.stringify({ code: cDoc.code, discount: disc }));
                dispatch(setToast({ message: 'Promo code applied successfully!', type: 'success' }));
            } else {
                setCouponError(data.message || 'Invalid promo code.');
            }
        } catch (err) {
            console.error(err);
            setCouponError('Error validating promo code.');
        }
    };

    const handleRemoveCoupon = () => {
        setDiscount(0);
        setAppliedCoupon('');
        setCoupon('');
        setCouponError('');
        localStorage.removeItem(`applied_coupon_${listing?._id}`);
        dispatch(setToast({ message: 'Promo code removed.', type: 'info' }));
    };

    const validateForm = () => {
        const errs = {};
        if (!(cardName || "").trim()) errs.cardName = 'Name on card is required';

        const cleanCard = (cardNumber || "").replace(/\s+/g, '');
        if (cleanCard.length !== 16 || !/^\d+$/.test(cleanCard)) {
            errs.cardNumber = 'Card number must be 16 digits';
        }

        if (!/^\d{2}\/\d{2}$/.test(expiry)) {
            errs.expiry = 'Expiry date must be MM/YY';
        } else {
            const [mm, yy] = (expiry || "").split('/');
            const month = parseInt(mm, 10);
            if (month < 1 || month > 12) errs.expiry = 'Invalid month';
        }

        if (cvv.length !== 3 || !/^\d+$/.test(cvv)) {
            errs.cvv = 'CVV must be 3 digits';
        }

        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handlePay = (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        setProcessing(true);
    };

    const submitBooking = async () => {
        try {
            const finalBooking = {
                ...bookingForm,
                pricePerNight: listing?.price || 0,
                subTotal: baseRent,
                couponCode: appliedCoupon,
                discountAmount: discount,
                totalPrice: finalPrice,
                paymentId: 'pay_mock_' + Math.random().toString(36).substr(2, 9)
            };

            const response = await apiPost('/bookings/create', finalBooking);

            const data = await response.json();
            setProcessing(false);

            if (response.ok) {
                setSuccess(true);
                localStorage.removeItem(`applied_coupon_${listing?._id}`);
                setTimeout(() => {
                    navigate(`/${user._id}/trips`);
                }, 3000);
            } else {
                dispatch(setToast({ message: data.message || 'Payment processing failed.', type: 'error' }));
            }
        } catch (err) {
            console.error(err);
            setProcessing(false);
            dispatch(setToast({ message: 'Something went wrong. Please check connection.', type: 'error' }));
        }
    };

    const handleProcessingComplete = () => {
        submitBooking();
    };

    const formatCardNumber = (value) => {
        const val = (value || "").replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        const matches = (val || "").match(/\d{4,16}/g);
        const match = (matches && matches[0]) || '';
        const parts = [];

        for (let i = 0, len = match.length; i < len; i += 4) {
            parts.push(match.substring(i, i + 4));
        }

        if (parts.length > 0) {
            return parts.join(' ');
        } else {
            return val;
        }
    };

    const formatExpiry = (value) => {
        const clean = (value || "").replace(/[^0-9]/g, '');
        if (clean.length >= 2) {
            return `${clean.slice(0, 2)}/${clean.slice(2, 4)}`;
        }
        return clean;
    };

    return (
        <div className="checkout-page">
            <button className="back-btn" onClick={() => navigate(-1)}>
                <ChevronLeft /> Back to details
            </button>

            <h1 className="checkout-title">Secure Checkout</h1>

            <div className="checkout-content">
                {/* Checkout forms */}
                <div className="checkout-form-container">
                    <form className="payment-card-form" onSubmit={handlePay}>
                        <div className="payment-section-header">
                            <CreditCard className="sec-icon" />
                            <h2>Credit or Debit Card</h2>
                        </div>

                        <div className="form-group">
                            <label>Cardholder Name</label>
                            <input
                                type="text"
                                placeholder="John Doe"
                                value={cardName}
                                onChange={(e) => setCardName(e.target.value)}
                                className={errors.cardName ? 'error-input' : ''}
                            />
                            {errors.cardName && <span className="err-msg">{errors.cardName}</span>}
                        </div>

                        <div className="form-group">
                            <label>Card Number</label>
                            <input
                                type="text"
                                placeholder="0000 0000 0000 0000"
                                maxLength="19"
                                value={cardNumber}
                                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                                className={errors.cardNumber ? 'error-input' : ''}
                            />
                            {errors.cardNumber && <span className="err-msg">{errors.cardNumber}</span>}
                        </div>

                        <div className="form-row">
                            <div className="form-group half-width">
                                <label>Expiry Date</label>
                                <input
                                    type="text"
                                    placeholder="MM/YY"
                                    maxLength="5"
                                    value={expiry}
                                    onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                                    className={errors.expiry ? 'error-input' : ''}
                                />
                                {errors.expiry && <span className="err-msg">{errors.expiry}</span>}
                            </div>

                            <div className="form-group half-width">
                                <label>CVV</label>
                                <input
                                    type="password"
                                    placeholder="123"
                                    maxLength="3"
                                    value={cvv}
                                    onChange={(e) => setCvv((e.target.value || "").replace(/[^0-9]/g, ''))}
                                    className={errors.cvv ? 'error-input' : ''}
                                />
                                {errors.cvv && <span className="err-msg">{errors.cvv}</span>}
                            </div>
                        </div>

                        <button type="submit" className="pay-submit-btn" disabled={processing || success}>
                            {processing ? 'Processing Payment...' : `Pay ${formatPrice(finalPrice)}`}
                        </button>
                    </form>
                </div>

                {/* Listing overview details */}
                <div className="checkout-summary-container">
                    <div className="summary-card">
                        <img
                            className="property-preview"
                            src={resolveImageUrl(listing.listingPhotoPaths && listing.listingPhotoPaths[0], "/assets/default.jpg")}
                            alt={listing.title}
                            onError={(e) => {
                                const clean = (listing.listingPhotoPaths?.[0] || "").replaceAll("\\", "/").replace(/^public\//, "");
                                if (clean && !e.target.src.endsWith(`/${clean}`)) {
                                    e.target.src = `/${clean}`;
                                } else if (clean && !e.target.src.includes('localhost:3000')) {
                                    e.target.src = `http://localhost:3000/${clean}`;
                                } else {
                                    e.target.onerror = null;
                                    e.target.src = "/assets/default.jpg";
                                }
                            }}
                        />
                        <div className="summary-details">
                            <h3>{listing.title}</h3>
                            <p className="subtitle">{listing.city}, {listing.province}, {listing.country}</p>
                            <p className="desc">{listing.category} &bull; {listing.type}</p>
                        </div>

                        <div className="booking-meta-row">
                            <CalendarToday className="meta-icon" />
                            <div>
                                <p className="meta-label">Selected Dates</p>
                                <p className="meta-value">
                                    {new Date(bookingForm.startDate).toLocaleDateString()} - {new Date(bookingForm.endDate).toLocaleDateString()}
                                </p>
                                <p className="meta-subvalue">({bookingForm.dayCount} Nights stay)</p>
                            </div>
                        </div>

                        {/* Promo / Coupon Codes */}
                        <div className="promo-section">
                            <form onSubmit={handleApplyCoupon} className="promo-form">
                                <input
                                    type="text"
                                    placeholder="Enter Promo Code Here.."
                                    value={coupon}
                                    onChange={(e) => setCoupon((e.target.value || "").toUpperCase())}
                                />
                                <button type="submit"><LocalOffer sx={{ fontSize: 16 }} /> Apply</button>
                            </form>
                            {couponError && <p className="coupon-err">{couponError}</p>}
                             {appliedCoupon && (
                                 <div className="coupon-ok-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
                                     <p className="coupon-ok" style={{ margin: 0 }}>
                                         Code <strong>{appliedCoupon}</strong> applied successfully!
                                     </p>
                                     <button
                                         type="button"
                                         onClick={handleRemoveCoupon}
                                         style={{
                                             background: '#fee2e2',
                                             color: '#ef4444',
                                             border: '1px solid #fecaca',
                                             padding: '4px 10px',
                                             borderRadius: '6px',
                                             cursor: 'pointer',
                                             fontSize: '12px',
                                             fontWeight: '600',
                                             transition: 'all 0.2s ease',
                                         }}
                                         onMouseEnter={(e) => {
                                             e.currentTarget.style.backgroundColor = '#ef4444';
                                             e.currentTarget.style.color = '#fff';
                                         }}
                                         onMouseLeave={(e) => {
                                             e.currentTarget.style.backgroundColor = '#fee2e2';
                                             e.currentTarget.style.color = '#ef4444';
                                         }}
                                     >
                                         Remove
                                     </button>
                                 </div>
                             )}
                        </div>

                        <div className="price-breakdown">
                            <div className="price-row">
                                <span>Property Rent ({bookingForm.dayCount} Nights)</span>
                                <span>{formatPrice(baseRent)}</span>
                            </div>
                            {discount > 0 && (
                                <div className="price-row discount">
                                    <span>Discount ({appliedCoupon})</span>
                                    <span>-{formatPrice(discount)}</span>
                                </div>
                            )}
                            <div className="price-row">
                                <span>SGST (9%)</span>
                                <span>+{formatPrice(sgst)}</span>
                            </div>
                            <div className="price-row">
                                <span>CGST (9%)</span>
                                <span>+{formatPrice(cgst)}</span>
                            </div>
                            <div className="price-row total">
                                <span>Total Amount to Pay</span>
                                <span>{formatPrice(finalPrice)}</span>
                            </div>
                        </div>

                        <p className="booking-type-indicator">
                            Booking Type: <strong>{listing.bookingType === 'request' ? 'Reservation Request (requires host approval)' : 'Instant Booking'}</strong>
                        </p>
                    </div>
                </div>
            </div>

            {/* Processing state screen overlays */}
            {processing && !success && (
                <PaymentProcessing
                    amount={formatPrice(finalPrice)}
                    listingTitle={listing?.title}
                    listingPhoto={listing?.listingPhotoPaths?.[0]}
                    onComplete={handleProcessingComplete}
                    onCancel={() => setProcessing(false)}
                />
            )}

            {/* Success state screen overlay mounted directly to body for fixed viewport stickiness */}
            {success && ReactDOM.createPortal(
                <div className="overlay-screen success-screen">
                    <CheckCircleOutline className="success-icon" />
                    <h2>Payment Confirmed!</h2>
                    <p>
                        {listing.bookingType === 'request'
                            ? 'Your reservation request was submitted to the host. Redirecting to trips...'
                            : 'Your booking has been completed successfully! Redirecting to trips...'}
                    </p>
                </div>,
                document.body
            )}
        </div>
    );
};

export default CheckoutPage;
