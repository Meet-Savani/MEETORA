import React, { useState, useEffect } from 'react'
import '../../styles/Login.scss'
import { setLogin, setToast } from '../../redux/state';
import { useDispatch } from 'react-redux';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ErrorOutline } from '@mui/icons-material';

import { BACKEND_BASE_URL } from '../../config/constants';

const LoginPage = () => {

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();

    // Clear any residual toast when mounting login page
    useEffect(() => {
        dispatch(setToast(null));
    }, [dispatch]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        const cleanEmail = email.trim();
        if (!cleanEmail || !password) {
            setError("Please enter both email and password.");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${BACKEND_BASE_URL}/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email: cleanEmail, password }),
            });

            const data = await response.json();

            if (response.ok && data) {
                setError("");
                dispatch(setToast(null));
                dispatch(
                    setLogin({
                        user: data.user,
                        token: data.token, 
                    })
                );
                const from = location.state?.from || (data.user.role === 'admin' ? "/admin/dashboard" : "/");
                navigate(from, { replace: true });
            } else {
                setError(data?.message || "Invalid email or password");
            }
        } catch (err) {
            console.error("Login failed:", err.message);
            setError("Unable to connect to the server. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className='login'>
            <div className="login_content">
                <form className='login_content_form' onSubmit={handleSubmit}>
                    <input
                        type="email" 
                        placeholder='Email'
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value);
                            if (error) setError("");
                        }}
                        required />
                    <input
                        type="password" 
                        placeholder='Password'
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            if (error) setError("");
                        }}
                        required />

                    {error && (
                        <div className="login_error_line" role="alert">
                            <ErrorOutline sx={{ fontSize: 18 }} />
                            <span>{error}</span>
                        </div>
                    )}
                    
                    <button type="submit" disabled={loading}>
                        {loading ? "LOGGING IN..." : "LOGIN"}
                    </button>
                </form>
                <Link to="/register">Don't have an account? Sign In Here</Link>
            </div>
        </div>
    )
}

export default LoginPage
