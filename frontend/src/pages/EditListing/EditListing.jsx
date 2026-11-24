import React, { useEffect, useState } from 'react';
import '../../styles/CreateListing.scss';
import '../../styles/EditListing.scss';
import { categories, types, facilities } from '../../data';
import { RemoveCircleOutline, AddCircleOutline, ArrowBackIos } from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { IoIosImage } from 'react-icons/io';
import { BiTrash } from 'react-icons/bi';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import Loader from '../../components/Loader/Loader';
import { apiFetch, apiPut } from '../../utils/api';
import { fileToBase64 } from '../../utils/fileToBase64';
import { setToast, setPropertyList, setListings } from '../../redux/state';
import { BACKEND_BASE_URL } from '../../config/constants';

const resolvePhotoUrl = (photo) => {
    if (!photo || typeof photo !== 'string') return '/assets/default.jpg';
    const trimmed = photo.trim();
    if (trimmed.startsWith('blob:') || trimmed.startsWith('data:') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
    }
    const clean = trimmed.replaceAll('\\', '/').replace(/^.*public\//, '').replace(/^\/+/, '');
    return `${BACKEND_BASE_URL}/${clean}`;
};

const EditListing = () => {
    const { listingId } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const user = useSelector((state) => state.user.user);
    const propertyList = user?.propertyList || [];
    const allListings = useSelector((state) => state.user.listings || []);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [category, setCategory] = useState("");
    const [type, setType] = useState("");

    // Location
    const [formLocation, setFormLocation] = useState({
        streetAddress: "",
        aptSuite: "",
        city: "",
        province: "",
        country: ""
    });

    // Basics
    const [guestCount, setGuestCount] = useState(1);
    const [bedroomCount, setBedroomCount] = useState(1);
    const [bedCount, setBedCount] = useState(1);
    const [bathroomCount, setBathroomCount] = useState(1);

    // Amenities
    const [amenities, setAmenities] = useState([]);

    // Photos
    const [existingPhotos, setExistingPhotos] = useState([]);
    const [newPhotos, setNewPhotos] = useState([]);

    // Description
    const [formDescription, setFormDescription] = useState({
        title: "",
        description: "",
        highlight: "",
        highlightDesc: "",
        price: 0
    });

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        const fetchListing = async () => {
            setLoading(true);
            try {
                const response = await apiFetch(`/properties/${listingId}/edit`);
                if (!response.ok) {
                    dispatch(setToast({ message: "Could not load property for editing.", type: "error" }));
                    navigate(-1);
                    return;
                }
                const data = await response.json();
                const listing = data.listing;

                if (!listing) {
                    dispatch(setToast({ message: "Property not found.", type: "error" }));
                    navigate(-1);
                    return;
                }

                setCategory(listing.category || "");
                setType(listing.type || "");

                setFormLocation({
                    streetAddress: listing.streetAddress || "",
                    aptSuite: listing.aptSuite || "",
                    city: listing.city || "",
                    province: listing.province || "",
                    country: listing.country || ""
                });

                setGuestCount(listing.guestCount || 1);
                setBedroomCount(listing.bedroomCount || 1);
                setBedCount(listing.bedCount || 1);
                setBathroomCount(listing.bathroomCount || 1);

                // Normalize amenities
                let parsedAmenities = [];
                if (Array.isArray(listing.amenities)) {
                    parsedAmenities = listing.amenities.flatMap(a => typeof a === 'string' && a.includes(',') ? a.split(',') : a);
                } else if (typeof listing.amenities === 'string') {
                    parsedAmenities = listing.amenities.split(',');
                }
                setAmenities(parsedAmenities.map(s => String(s).trim()).filter(Boolean));

                setExistingPhotos(listing.listingPhotoPaths || []);

                setFormDescription({
                    title: listing.title || "",
                    description: listing.description || "",
                    highlight: listing.highlight || "",
                    highlightDesc: listing.highlightDesc || "",
                    price: listing.price || 0
                });
            } catch (err) {
                console.error("Failed to load listing for edit:", err);
                dispatch(setToast({ message: "Error loading property details.", type: "error" }));
                navigate(-1);
            } finally {
                setLoading(false);
            }
        };

        fetchListing();
    }, [listingId, user, navigate, dispatch]);

    const handleChangeLocation = (e) => {
        const { name, value } = e.target;
        setFormLocation((prev) => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSelectAmenities = (facility) => {
        if (amenities.includes(facility)) {
            setAmenities((prev) => prev.filter((item) => item !== facility));
        } else {
            setAmenities((prev) => [...prev, facility]);
        }
    };

    const handleUploadNewPhotos = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const newItems = files.map((file, i) => ({
            id: `${file.name}-${file.size}-${Date.now()}-${i}`,
            file,
            preview: URL.createObjectURL(file)
        }));

        setNewPhotos((prev) => [...prev, ...newItems]);
        e.target.value = '';
    };

    const handleRemoveExistingPhoto = (indexToRemove) => {
        setExistingPhotos((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    };

    const handleRemoveNewPhoto = (indexToRemove) => {
        setNewPhotos((prev) => {
            const item = prev[indexToRemove];
            if (item && item.preview) {
                try { URL.revokeObjectURL(item.preview); } catch {}
            }
            return prev.filter((_, idx) => idx !== indexToRemove);
        });
    };

    useEffect(() => {
        return () => {
            newPhotos.forEach((item) => {
                if (item && item.preview) {
                    try { URL.revokeObjectURL(item.preview); } catch {}
                }
            });
        };
    }, []);

    const handleDragExistingPhoto = (result) => {
        if (!result.destination) return;
        const items = Array.from(existingPhotos);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);
        setExistingPhotos(items);
    };

    const handleDragNewPhoto = (result) => {
        if (!result.destination) return;
        const items = Array.from(newPhotos);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);
        setNewPhotos(items);
    };

    const handleChangeDescription = (e) => {
        const { name, value } = e.target;
        setFormDescription((prev) => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (existingPhotos.length + newPhotos.length === 0) {
            dispatch(setToast({ message: "At least one property photo is required.", type: "error" }));
            return;
        }

        if (!category) {
            dispatch(setToast({ message: "Please select a category for your place.", type: "error" }));
            return;
        }

        if (!type) {
            dispatch(setToast({ message: "Please select a place type.", type: "error" }));
            return;
        }

        setSaving(true);

        try {
            // Convert any newly added photos to Base64 for Cloudinary
            const newPhotoDataStrings = await Promise.all(
                newPhotos.map(p => fileToBase64(p.file || p))
            );

            const payload = {
                category,
                type,
                streetAddress: formLocation.streetAddress,
                aptSuite: formLocation.aptSuite,
                city: formLocation.city,
                province: formLocation.province,
                country: formLocation.country,
                guestCount,
                bedroomCount,
                bedCount,
                bathroomCount,
                title: formDescription.title,
                description: formDescription.description,
                highlight: formDescription.highlight,
                highlightDesc: formDescription.highlightDesc,
                price: formDescription.price,
                existingPhotos,
                newPhotos: newPhotoDataStrings,
                amenities
            };

            const response = await apiPut(`/properties/${listingId}`, payload);
            const data = await response.json();

            if (response.ok && data.listing) {
                dispatch(setToast({ message: "Property updated successfully and changes are live!", type: "success" }));

                // Update Redux propertyList cache if present
                if (propertyList && propertyList.length > 0) {
                    const updatedList = propertyList.map(p => p._id === listingId ? { ...p, ...data.listing } : p);
                    dispatch(setPropertyList(updatedList));
                }

                // Update Redux listings feed cache if present
                if (allListings && allListings.length > 0) {
                    const updatedFeed = allListings.map(l => l._id === listingId ? { ...l, ...data.listing } : l);
                    dispatch(setListings(updatedFeed));
                }

                navigate(`/properties/${listingId}`);
            } else {
                dispatch(setToast({ message: data.message || "Failed to update property.", type: "error" }));
            }
        } catch (err) {
            console.error("Error submitting property update:", err);
            dispatch(setToast({ message: "Failed to update property.", type: "error" }));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <Loader />;

    return (
        <div className="create-listing edit-listing-page">
            <div className="edit-listing-header">
                <button type="button" className="edit-back-btn" onClick={() => navigate(-1)}>
                    <ArrowBackIos sx={{ fontSize: "14px" }} /> Back
                </button>
                <h1>Edit Your Property</h1>
                <p className="edit-subtitle">Update your listing details. Changes will reflect immediately across all pages.</p>
            </div>

            <form onSubmit={handleSubmit}>
                {/* Step 1: Tell us about your place */}
                <div className="create-listing_step1">
                    <h2>Step 1: Property Details</h2>
                    <hr />

                    <h3>Which of these categories best describes your place?</h3>
                    <div className="category-list">
                        {categories?.map((item, index) => (
                            <div
                                className={`category ${category === item.label ? "selected" : ""}`}
                                key={index}
                                onClick={() => setCategory(item.label)}
                            >
                                <div className="category_icon">{item.icon}</div>
                                <p>{item.label}</p>
                            </div>
                        ))}
                    </div>

                    <h3>What type of place will guests have?</h3>
                    <div className="type-list">
                        {types?.map((item, index) => (
                            <div
                                className={`type ${type === item.name ? "selected" : ""}`}
                                key={index}
                                onClick={() => setType(item.name)}
                            >
                                <div className="type_text">
                                    <h4>{item.name}</h4>
                                    <p>{item.description}</p>
                                </div>
                                <div className="type_icon">{item.icon}</div>
                            </div>
                        ))}
                    </div>

                    <h3>Where's your place located?</h3>
                    <div className="full">
                        <div className="location">
                            <p>Street Address</p>
                            <input
                                type="text"
                                placeholder="Street Address"
                                name="streetAddress"
                                value={formLocation.streetAddress}
                                onChange={handleChangeLocation}
                                required
                            />
                        </div>
                    </div>
                    <div className="half">
                        <div className="location">
                            <p>Apartment, Suite, etc. (if applicable)</p>
                            <input
                                type="text"
                                placeholder="Apt, Suite, etc."
                                name="aptSuite"
                                value={formLocation.aptSuite}
                                onChange={handleChangeLocation}
                            />
                        </div>
                        <div className="location">
                            <p>City</p>
                            <input
                                type="text"
                                placeholder="City"
                                name="city"
                                value={formLocation.city}
                                onChange={handleChangeLocation}
                                required
                            />
                        </div>
                    </div>
                    <div className="half">
                        <div className="location">
                            <p>Province / State</p>
                            <input
                                type="text"
                                placeholder="Province / State"
                                name="province"
                                value={formLocation.province}
                                onChange={handleChangeLocation}
                                required
                            />
                        </div>
                        <div className="location">
                            <p>Country</p>
                            <input
                                type="text"
                                placeholder="Country"
                                name="country"
                                value={formLocation.country}
                                onChange={handleChangeLocation}
                                required
                            />
                        </div>
                    </div>

                    <h3>Share some basics about your place</h3>
                    <div className="basics">
                        <div className="basic">
                            <p>Guests</p>
                            <div className="basic_count">
                                <RemoveCircleOutline
                                    onClick={() => guestCount > 1 && setGuestCount(guestCount - 1)}
                                    sx={{ fontSize: "25px", cursor: "pointer", "&:hover": { color: "var(--accent-color)" } }}
                                />
                                <p>{guestCount}</p>
                                <AddCircleOutline
                                    onClick={() => setGuestCount(guestCount + 1)}
                                    sx={{ fontSize: "25px", cursor: "pointer", "&:hover": { color: "var(--accent-color)" } }}
                                />
                            </div>
                        </div>

                        <div className="basic">
                            <p>Bedrooms</p>
                            <div className="basic_count">
                                <RemoveCircleOutline
                                    onClick={() => bedroomCount > 1 && setBedroomCount(bedroomCount - 1)}
                                    sx={{ fontSize: "25px", cursor: "pointer", "&:hover": { color: "var(--accent-color)" } }}
                                />
                                <p>{bedroomCount}</p>
                                <AddCircleOutline
                                    onClick={() => setBedroomCount(bedroomCount + 1)}
                                    sx={{ fontSize: "25px", cursor: "pointer", "&:hover": { color: "var(--accent-color)" } }}
                                />
                            </div>
                        </div>

                        <div className="basic">
                            <p>Beds</p>
                            <div className="basic_count">
                                <RemoveCircleOutline
                                    onClick={() => bedCount > 1 && setBedCount(bedCount - 1)}
                                    sx={{ fontSize: "25px", cursor: "pointer", "&:hover": { color: "var(--accent-color)" } }}
                                />
                                <p>{bedCount}</p>
                                <AddCircleOutline
                                    onClick={() => setBedCount(bedCount + 1)}
                                    sx={{ fontSize: "25px", cursor: "pointer", "&:hover": { color: "var(--accent-color)" } }}
                                />
                            </div>
                        </div>

                        <div className="basic">
                            <p>Bathrooms</p>
                            <div className="basic_count">
                                <RemoveCircleOutline
                                    onClick={() => bathroomCount > 1 && setBathroomCount(bathroomCount - 1)}
                                    sx={{ fontSize: "25px", cursor: "pointer", "&:hover": { color: "var(--accent-color)" } }}
                                />
                                <p>{bathroomCount}</p>
                                <AddCircleOutline
                                    onClick={() => setBathroomCount(bathroomCount + 1)}
                                    sx={{ fontSize: "25px", cursor: "pointer", "&:hover": { color: "var(--accent-color)" } }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Step 2: Make your place stand out */}
                <div className="create-listing_step2">
                    <h2>Step 2: Amenities, Photos & Description</h2>
                    <hr />

                    <h3>Tell guests what your place has to offer</h3>
                    <div className="amenities">
                        {facilities?.map((item, index) => (
                            <div
                                className={`facility ${amenities.includes(item.name) ? "selected" : ""}`}
                                key={index}
                                onClick={() => handleSelectAmenities(item.name)}
                            >
                                <div className="facility_icon">{item.icon}</div>
                                <p>{item.name}</p>
                            </div>
                        ))}
                    </div>

                    {/* Photo Management Section */}
                    <div className="edit-photos-section">
                        <h3>Property Photos</h3>
                        <p className="photo-help-text">
                            Manage your existing photos or upload new ones. Drag to reorder, or click the trash icon to remove.
                        </p>

                        {/* Existing Photos */}
                        {existingPhotos.length > 0 && (
                            <div className="photo-subgroup">
                                <h4>Existing Photos ({existingPhotos.length})</h4>
                                <DragDropContext onDragEnd={handleDragExistingPhoto}>
                                    <Droppable droppableId="existingPhotos" direction="horizontal">
                                        {(provided) => (
                                            <div className="photos" {...provided.droppableProps} ref={provided.innerRef}>
                                                {existingPhotos.map((photo, index) => {
                                                    const photoUrl = resolvePhotoUrl(photo);
                                                    return (
                                                        <Draggable key={`exist-${photo}-${index}`} draggableId={`exist-${index}`} index={index}>
                                                            {(provided) => (
                                                                <div
                                                                    className="photo existing-photo-card"
                                                                    ref={provided.innerRef}
                                                                    {...provided.draggableProps}
                                                                    {...provided.dragHandleProps}
                                                                >
                                                                    <img 
                                                                        src={photoUrl} 
                                                                        alt={`property ${index + 1}`} 
                                                                        onError={(e) => { e.target.onerror = null; e.target.src = "/assets/default.jpg"; }}
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        title="Remove Photo"
                                                                        onClick={() => handleRemoveExistingPhoto(index)}
                                                                    >
                                                                        <BiTrash />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </Draggable>
                                                    );
                                                })}
                                                {provided.placeholder}
                                            </div>
                                        )}
                                    </Droppable>
                                </DragDropContext>
                            </div>
                        )}

                        {/* Newly Uploaded Photos */}
                        <div className="photo-subgroup">
                            <h4>Add New Photos {newPhotos.length > 0 && `(${newPhotos.length} new selected)`}</h4>
                            <DragDropContext onDragEnd={handleDragNewPhoto}>
                                <Droppable droppableId="newPhotos" direction="horizontal">
                                    {(provided) => (
                                        <div className="photos" {...provided.droppableProps} ref={provided.innerRef}>
                                            {newPhotos.map((photo, index) => (
                                                <Draggable key={photo.id || `new-${index}`} draggableId={photo.id ? String(photo.id) : `new-${index}`} index={index}>
                                                    {(provided) => (
                                                        <div
                                                            className="photo new-photo-card"
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                        >
                                                            <img src={photo.preview || (photo instanceof File ? URL.createObjectURL(photo) : photo)} alt="new upload" />
                                                            <span className="new-badge">New</span>
                                                            <button
                                                                type="button"
                                                                title="Remove Photo"
                                                                onClick={() => handleRemoveNewPhoto(index)}
                                                            >
                                                                <BiTrash />
                                                            </button>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                            <input
                                                id="newImageUpload"
                                                type="file"
                                                style={{ display: "none" }}
                                                accept="image/*"
                                                onChange={handleUploadNewPhotos}
                                                multiple
                                            />
                                            <label htmlFor="newImageUpload" className="together add-more-photos-label">
                                                <div className="icon"><IoIosImage /></div>
                                                <p>Upload Photos</p>
                                            </label>
                                        </div>
                                    )}
                                </Droppable>
                            </DragDropContext>
                        </div>
                    </div>

                    <h3>What makes your place attractive and exciting?</h3>
                    <div className="description">
                        <p>Title</p>
                        <input
                            type="text"
                            placeholder="Title"
                            name="title"
                            value={formDescription.title}
                            onChange={handleChangeDescription}
                            required
                        />

                        <p>Description</p>
                        <textarea
                            placeholder="Description"
                            name="description"
                            value={formDescription.description}
                            onChange={handleChangeDescription}
                            rows={5}
                            required
                        />

                        <p>Highlight</p>
                        <input
                            type="text"
                            placeholder="Highlight (e.g. Ocean View, Central Location)"
                            name="highlight"
                            value={formDescription.highlight}
                            onChange={handleChangeDescription}
                            required
                        />

                        <p>Highlight Details</p>
                        <textarea
                            placeholder="Highlight Details"
                            name="highlightDesc"
                            value={formDescription.highlightDesc}
                            onChange={handleChangeDescription}
                            rows={3}
                            required
                        />

                        <p>Nightly Rate (USD)</p>
                        <div className="price-input-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '20px', fontWeight: 'bold' }}>$</span>
                            <input
                                type="number"
                                placeholder="100"
                                name="price"
                                className="price"
                                min={1}
                                value={formDescription.price}
                                onChange={handleChangeDescription}
                                required
                            />
                        </div>
                    </div>
                </div>

                {/* Bottom Action Bar */}
                <div className="edit-action-bar">
                    <button
                        type="button"
                        className="edit-cancel-btn"
                        onClick={() => navigate(-1)}
                        disabled={saving}
                    >
                        Cancel
                    </button>
                    <button
                        className="submit_btn edit-save-btn"
                        type="submit"
                        disabled={saving}
                    >
                        {saving ? "Saving Changes..." : "Save Changes"}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default EditListing;
