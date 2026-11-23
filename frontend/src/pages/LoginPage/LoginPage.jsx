import React, { useState } from 'react'
import '../../styles/Login.scss'
import { setLogin, setToast } from '../../redux/state';
import { useDispatch } from 'react-redux';
import { useNavigate, useLocation, Link } from 'react-router-dom';

import { BACKEND_BASE_URL } from '../../config/constants';

const LoginPage = () => {

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();

    const handleSubmit = async (e) => {
        e.preventDefault();

        const cleanEmail = email.trim();
        if (!cleanEmail || !password) {
            dispatch(setToast({ message: "Please enter both email and password.", type: "error" }));
            return;
        }

        try {
            const response = await fetch(`${BACKEND_BASE_URL}/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email: cleanEmail, password }),
            });

            const data = await response.json();

            if(response.ok && data) {
                dispatch(
                    setLogin({
                        user: data.user,
                        token: data.token, 
                    })
                );
                const from = location.state?.from || (data.user.role === 'admin' ? "/admin/dashboard" : "/");
                navigate(from, { replace: true });
            } else {
                dispatch(setToast({ message: data.message || "Invalid email or password", type: "error" }));
            }
        } catch (error) {
            console.log("Login failed", error.message);
            dispatch(setToast({ message: "Unable to connect to the server. Please try again.", type: "error" }));
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
                        onChange={(e) => setEmail(e.target.value)}
                        required />
                    <input
                        type="password" 
                        placeholder='Password'
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required />
                    
                    <button type="submit">LOGIN</button>
                </form>
                <Link to="/register">Don't have an account? Sign In Here</Link>
            </div>
        </div>
    )
}

export default LoginPage
