import React, { useState, useEffect, useRef } from 'react'
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

    const [previewUrl, setPreviewUrl] = useState(null);
    const fileInputRef = useRef(null);

    const navigate = useNavigate();
    const dispatch = useDispatch();

    const passwordMatch = formData.password === formData.confirmPassword || formData.confirmPassword === "";

    useEffect(() => {
        if (!formData.profileImage) {
            setPreviewUrl(null);
            return;
        }

        const objectUrl = URL.createObjectURL(formData.profileImage);
        setPreviewUrl(objectUrl);

        return () => {
            URL.revokeObjectURL(objectUrl);
        };
    }, [formData.profileImage]);

    const handleChange = (e) => {
        const { name, value, files } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === "profileImage" ? (files && files[0] ? files[0] : null) : value,
        }));
    }

    const handleRemoveImage = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setFormData(prev => ({
            ...prev,
            profileImage: null,
        }));
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

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
                        <p className="password_mismatch_error">Passwords do not match</p>
                    )}

                    <input 
                        ref={fileInputRef}
                        type="file"
                        id='image'
                        onChange={handleChange}
                        name='profileImage'
                        accept='image/*'
                        style={{ display: 'none' }} />
                    
                    {formData.profileImage && previewUrl ? (
                        <div className="register_profile_preview">
                            <img 
                                src={previewUrl} 
                                alt={formData.firstName ? `${formData.firstName} ${formData.lastName}` : "Profile Preview"}
                                className="register_profile_preview_img" 
                            />
                            <div className="register_profile_preview_info">
                                <span className="file_name">
                                    {formData.profileImage.name ? (
                                        formData.profileImage.name.length > 20 
                                            ? `${formData.profileImage.name.substring(0, 18)}...`
                                            : formData.profileImage.name
                                    ) : "Photo selected"}
                                </span>
                                <div className="preview_buttons">
                                    <label htmlFor='image' className="change_photo_label">
                                        Change
                                    </label>
                                    <span className="divider">•</span>
                                    <button 
                                        type="button" 
                                        onClick={handleRemoveImage} 
                                        className="remove_photo_btn"
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <label htmlFor='image' className="register_upload_label">
                            <img src="/assets/addImage.png" alt="Add Profile Photo" />
                            <p>Upload Your Photo (Optional)</p>
                        </label>
                    )}

                    <button type='submit' disabled={!passwordMatch}>REGISTER</button>
                </form>
                <Link to="/login">Already have an account? Log In Here</Link>
            </div>
        </div>
    )
}

export default RegisterPage
