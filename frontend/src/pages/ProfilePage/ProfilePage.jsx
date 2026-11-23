import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setUpdateUser } from '../../redux/state';
import Loader from '../../components/Loader/Loader';
import '../../styles/ProfilePage.scss';

import { apiPatch } from '../../utils/api';
import { fileToBase64 } from '../../utils/fileToBase64';
import { BACKEND_BASE_URL } from '../../config/constants';

const ProfilePage = () => {
    const user = useSelector((state) => state.user.user);
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        location: "",
        bio: "",
        profileImage: null,
    });

    const [updating, setUpdating] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    const isAdmin = user?.role === 'admin';

    // Sync formData when user details load or update
    useEffect(() => {
        if (user) {
            setFormData({
                firstName: user.role === 'admin' ? 'Meetora' : (user.firstName || ""),
                lastName: user.role === 'admin' ? '' : (user.lastName || ""),
                email: user.email || "",
                phone: user.phone || "",
                location: user.location || "",
                bio: user.bio || "",
                profileImage: null,
            });
        } else {
            const timer = setTimeout(() => {
                if (!user) {
                    navigate("/login");
                }
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [user, navigate]);

    // Check if any fields have actually changed from the database values
    const hasChanges = 
        user && (
            (!isAdmin && (
                (formData.firstName || "").trim() !== (user.firstName || "").trim() ||
                (formData.lastName || "").trim() !== (user.lastName || "").trim()
            )) ||
            formData.phone !== (user.phone || "") ||
            formData.location !== (user.location || "") ||
            formData.bio !== (user.bio || "") ||
            formData.profileImage !== null
        );

    const handleChange = (e) => {
        const { name, value, files } = e.target;
        setFormData({
            ...formData,
            [name]: name === "profileImage" ? files[0] : value,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!hasChanges) {
            setSuccessMessage("No changes detected.");
            return;
        }

        setUpdating(true);
        setErrorMessage("");
        setSuccessMessage("");

        try {
            let profileImageBase64 = null;
            if (formData.profileImage) {
                profileImageBase64 = await fileToBase64(formData.profileImage);
            }

            const payload = {
                firstName: isAdmin ? "Meetora" : (formData.firstName || "").trim(),
                lastName: isAdmin ? "" : (formData.lastName || "").trim(),
                phone: formData.phone,
                location: formData.location,
                bio: formData.bio,
                ...(profileImageBase64 ? { profileImage: profileImageBase64 } : {})
            };

            const response = await apiPatch(`/users/${user._id}/update`, payload);

            const data = await response.json();

            if (response.ok) {
                dispatch(setUpdateUser(data.user));
                setSuccessMessage("Profile updated successfully!");
            } else {
                setErrorMessage(data.message || "Failed to update profile.");
            }
        } catch (error) {
            console.error("Error updating profile:", error);
            setErrorMessage("An error occurred during updating.");
        } finally {
            setUpdating(false);
        }
    };

    if (!user) {
        return <Loader />;
    }

    const existingAvatar = user.profileImagePath
        ? (user.profileImagePath.startsWith('http://') || user.profileImagePath.startsWith('https://')
            ? user.profileImagePath
            : `${BACKEND_BASE_URL}/${user.profileImagePath.replaceAll('\\', '/').replace(/^.*public\//, '').replace(/^\/+/, '')}`)
        : null;

    return updating ? (
        <Loader />
    ) : (
        <div className='profile-edit-page'>
            <div className="profile-edit-container">
                <h1>Your Profile</h1>
                <p className="subtitle">View your profile details and update your contact or bio information below.</p>
                
                <form onSubmit={handleSubmit} className="profile-form">
                    {successMessage && <div className="alert success">{successMessage}</div>}
                    {errorMessage && <div className="alert error">{errorMessage}</div>}

                    <div className="profile-image-section">
                        <div className="avatar-preview">
                            {formData.profileImage ? (
                                <img src={URL.createObjectURL(formData.profileImage)} alt="New avatar preview" />
                            ) : existingAvatar ? (
                                <img src={existingAvatar} alt="Current avatar" />
                            ) : (
                                <div className="avatar-initials">
                                    {user.firstName ? user.firstName.charAt(0).toUpperCase() : "U"}
                                </div>
                            )}
                        </div>
                        
                        <input 
                            type="file"
                            id="profileImageInput"
                            name="profileImage"
                            onChange={handleChange}
                            accept="image/*"
                            style={{ display: "none" }}
                        />
                        <label htmlFor="profileImageInput" className="upload-btn">
                            Upload New Photo
                        </label>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>First Name {isAdmin && "(read-only)"}</label>
                            <input 
                                type="text" 
                                name="firstName"
                                placeholder="First Name"
                                value={isAdmin ? "Meetora" : formData.firstName}
                                onChange={handleChange}
                                disabled={isAdmin}
                                className={isAdmin ? "disabled-input" : ""}
                                required={!isAdmin}
                            />
                        </div>
                        
                        <div className="form-group">
                            <label>Last Name {isAdmin && "(read-only)"}</label>
                            <input 
                                type="text" 
                                name="lastName"
                                placeholder={isAdmin ? "" : "Last Name"}
                                value={isAdmin ? "" : formData.lastName}
                                onChange={handleChange}
                                disabled={isAdmin}
                                className={isAdmin ? "disabled-input" : ""}
                                required={!isAdmin}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Email Address (read-only)</label>
                        <input 
                            type="email" 
                            name="email"
                            value={formData.email} 
                            disabled 
                            className="disabled-input"
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Phone Number</label>
                            <input 
                                type="text" 
                                name="phone"
                                placeholder="e.g. +1 234 567 890"
                                value={formData.phone}
                                onChange={handleChange}
                            />
                        </div>
                        
                        <div className="form-group">
                            <label>Location</label>
                            <input 
                                type="text" 
                                name="location"
                                placeholder="e.g. New York, USA"
                                value={formData.location}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Bio / About Me</label>
                        <textarea 
                            name="bio"
                            placeholder="Tell hosts and guests a bit about yourself..."
                            value={formData.bio}
                            onChange={handleChange}
                            rows="4"
                            className="textarea-input"
                        />
                    </div>

                    <button type="submit" disabled={!hasChanges} className="save-btn">
                        Save Changes
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ProfilePage;
