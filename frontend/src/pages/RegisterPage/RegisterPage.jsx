import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { setLogin, setToast } from '../../redux/state';
import { useDispatch } from 'react-redux';
import '../../styles/Register.scss'

import { BACKEND_BASE_URL } from '../../config/constants';
import { fileToBase64 } from '../../utils/fileToBase64';

const RegisterPage = () => {

    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
        profileImage: null,
    });

    const navigate = useNavigate();
    const dispatch = useDispatch();

    const passwordMatch = formData.password === formData.confirmPassword || formData.confirmPassword === "";

    const handleChange = (e) => {
        const { name, value, files } = e.target;
        setFormData({
            ...formData,
            [name]: name === "profileImage" ? files[0] : value,
        })
    }

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            let profileImageBase64 = "";
            if (formData.profileImage) {
                profileImageBase64 = await fileToBase64(formData.profileImage);
            }

            const payload = {
                firstName: (formData.firstName || "").trim(),
                lastName: (formData.lastName || "").trim(),
                email: (formData.email || "").trim().toLowerCase(),
                password: formData.password,
                profileImage: profileImageBase64,
            };
            
            const response = await fetch(`${BACKEND_BASE_URL}/auth/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (response.ok) {
                dispatch(
                    setLogin({
                        user: data.user,
                        token: data.token,
                    })
                );
                navigate("/");
            } else {
                dispatch(setToast({ message: data.message || "Registration failed", type: "error" }));
            }
        } catch (error) {
            console.error("Error during registration:", error.message);
            dispatch(setToast({ message: error.message || "Registration error", type: "error" }));
        }
    }

    return (
        <div className='register'>
            <div className="register_content">
                <form className='register_content_form' onSubmit={handleSubmit}>
                    <input 
                        type="text"
                        placeholder='First Name'
                        name='firstName'
                        value={formData.firstName}
                        onChange={handleChange}
                        required />
                    <input 
                        type="text"
                        placeholder='Last Name'
                        value={formData.lastName}
                        onChange={handleChange}
                        name='lastName'
                        required />
                    <input 
                        type="email"
                        placeholder='Email'
                        value={formData.email}
                        onChange={handleChange}
                        name='email'
                        required />
                    <input 
                        type="password"
                        placeholder='Password'
                        value={formData.password}
                        onChange={handleChange}
                        name='password'
                        required />
                    <input 
                        type="password"
                        placeholder='Confirm Password'
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        name='confirmPassword'
                        required />

                    {!passwordMatch && (
                        <p style={{ color: "red" }}>Password do not match</p>
                    )}

                    <input 
                        type="file"
                        id='image'
                        onChange={handleChange}
                        name='profileImage'
                        accept='image/*'
                        style={{ display: 'none' }} />
                    <label htmlFor='image'>
                        <img src="/assets/addImage.png" alt="Add Profile Photo" />
                        <p>Upload Your Photo (Optional)</p>
                    </label>
                    {formData.profileImage && (
                        <img src={URL.createObjectURL(formData.profileImage)} alt={formData.firstName + " " + formData.lastName}
                        style={{ maxWidth: "80px" }} />
                    )}

                    <button type='submit' disabled={!passwordMatch}>REGISTER</button>
                </form>
                <Link to="/login">Already have an account? Log In Here</Link>
            </div>
        </div>
    )
}

export default RegisterPage
