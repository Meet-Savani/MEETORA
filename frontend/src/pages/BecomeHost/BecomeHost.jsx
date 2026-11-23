import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
    HomeWork, TrendingUp, Security, SupportAgent,
    ArrowForward, CheckCircle, HourglassEmpty
} from '@mui/icons-material';
import '../../styles/BecomeHost.scss';
import { setUpdateUser, setToast } from '../../redux/state';
import { apiFetch, apiPost } from '../../utils/api';

const BENEFITS = [
    { icon: <TrendingUp />, title: 'Earn on your terms', desc: 'Set your own prices and availability.' },
    { icon: <Security />, title: 'Secure payouts', desc: 'Reliable and timely payments.' },
    { icon: <SupportAgent />, title: 'Dedicated support', desc: 'Our team helps you succeed as a host.' },
    { icon: <HomeWork />, title: 'Full control', desc: 'Manage listings, calendar, and reservations.' },
];

const STEPS = [
    'Create your host account',
    'List your property with photos',
    'Set pricing and house rules',
    'Start welcoming guests',
];

const BecomeHost = () => {
    const user = useSelector((state) => state.user?.user);
    const navigate = useNavigate();
    const dispatch = useDispatch();
    
    const isHost = user?.role === 'host';
    const requestStatus = user?.hostRequestStatus || 'none';

    const [phone, setPhone] = useState(user?.phone || "");
    const [bio, setBio] = useState(user?.bio || "");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const fetchUserData = async () => {
            if (user?._id) {
                try {
                    const res = await apiFetch(`/users/${user._id}`);
                    const data = await res.json();
                    if (res.ok && data.user) {
                        dispatch(setUpdateUser(data.user));
                        setPhone(data.user.phone || "");
                        setBio(data.user.bio || "");
                    }
                } catch (err) {
                    console.error("Failed to fetch user status", err);
                }
            }
        };
        fetchUserData();
    }, [user?._id, dispatch]);

    const handleGetStarted = () => {
        if (!user) {
            navigate('/register');
            return;
        }
        if (isHost) {
            navigate('/create-listing');
            return;
        }
        // Scroll to form
        const formEl = document.getElementById('host-app-section');
        if (formEl) {
            formEl.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handleSubmitApplication = async (e) => {
        e.preventDefault();
        if (!phone.trim()) {
            dispatch(setToast({ message: "Phone number is required.", type: "error" }));
            return;
        }
        if (!bio.trim()) {
            dispatch(setToast({ message: "Please tell us about your goals or experience.", type: "error" }));
            return;
        }
        setSubmitting(true);
        try {
            const res = await apiPost(`/users/${user._id}/request-host`, { phone, bio });
            const data = await res.json();
            if (res.ok && data.user) {
                dispatch(setUpdateUser(data.user));
                dispatch(setToast({ message: data.message || "Host request submitted!", type: "success" }));
            } else {
                dispatch(setToast({ message: data.message || "Failed to submit request.", type: "error" }));
            }
        } catch (err) {
            console.error(err);
            dispatch(setToast({ message: "An error occurred while submitting request.", type: "error" }));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="become-host-page">
            <section className="become-host-hero">
                <div className="hero-content">
                    <span className="hero-badge">Host with MEETORA</span>
                    <h1>Turn your space into your next opportunity</h1>
                    <p>
                        Join thousands of hosts earning by sharing their homes with travelers worldwide.
                    </p>
                    <div className="hero-actions">
                        <button className="cta-primary" onClick={handleGetStarted}>
                            {isHost ? 'List a Property' : requestStatus === 'pending' ? 'Application Under Review' : 'Get Started'}
                            <ArrowForward />
                        </button>
                        {!user && (
                            <Link to="/login" className="cta-secondary">Already have an account?</Link>
                        )}
                    </div>
                </div>
                <div className="hero-visual">
                    <img src="/assets/register.jpg" alt="Beautiful vacation rental" />
                </div>
            </section>

            <section className="become-host-benefits">
                <h2>Why host on MEETORA?</h2>
                <div className="benefits-grid">
                    {BENEFITS.map((item) => (
                        <div key={item.title} className="benefit-card">
                            <div className="benefit-icon">{item.icon}</div>
                            <h3>{item.title}</h3>
                            <p>{item.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="become-host-steps">
                <h2>How it works</h2>
                <ol className="steps-list">
                    {STEPS.map((step, i) => (
                        <li key={step}>
                            <span className="step-number">{i + 1}</span>
                            <span className="step-text">{step}</span>
                            <CheckCircle className="step-check" />
                        </li>
                    ))}
                </ol>
            </section>

            <section className="become-host-cta" id="host-app-section">
                {!user ? (
                    <>
                        <h2>Ready to become a host?</h2>
                        <p>Sign up now to submit your application and get started.</p>
                        <button className="cta-primary" onClick={handleGetStarted}>
                            Start Hosting Today
                            <ArrowForward />
                        </button>
                    </>
                ) : isHost ? (
                    <>
                        <h2>Welcome! You are a Host</h2>
                        <p>Your host account is active. Start creating your listings and welcome guests!</p>
                        <button className="cta-primary" onClick={handleGetStarted}>
                            List your property
                            <ArrowForward />
                        </button>
                    </>
                ) : requestStatus === 'pending' ? (
                    <div className="status-pending-card">
                        <div className="status-icon-wrapper">
                            <HourglassEmpty sx={{ fontSize: 40, color: 'var(--primary-color)' }} />
                        </div>
                        <h3>Application Pending</h3>
                        <p>Your application to become a host is under review by our administration team. We will notify you once it has been processed.</p>
                    </div>
                ) : (
                    <form className="host-application-form" onSubmit={handleSubmitApplication}>
                        <h2>Apply to Become a Host</h2>
                        <p className="form-desc">Provide your contact info and background so we can activate your hosting dashboard.</p>
                        
                        {requestStatus === 'rejected' && (
                            <div className="status-rejected-alert">
                                <p>Your previous host application was declined by the administrator. Please update your details below and re-submit.</p>
                            </div>
                        )}

                        <div className="form-group">
                            <label>Phone Number</label>
                            <input 
                                type="tel" 
                                placeholder="e.g. +1 555-0199" 
                                value={phone} 
                                onChange={(e) => setPhone(e.target.value)} 
                                required 
                            />
                        </div>

                        <div className="form-group">
                            <label>About You & Your Property Goals</label>
                            <textarea 
                                rows="4" 
                                placeholder="Describe the listing you plan to create or your hosting experience..." 
                                value={bio} 
                                onChange={(e) => setBio(e.target.value)} 
                                required 
                            />
                        </div>

                        <button type="submit" className="cta-primary" disabled={submitting}>
                            {submitting ? 'Submitting...' : 'Submit Host Application'}
                            <ArrowForward />
                        </button>
                    </form>
                )}
            </section>
        </div>
    );
};

export default BecomeHost;
