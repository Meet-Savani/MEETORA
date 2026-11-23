import React, { useState } from 'react'
import '../../styles/CreateListing.scss'
import '../../components/Navbar/Navbar'
import { categories, types, facilities } from '../../data'
import { RemoveCircleOutline, AddCircleOutline } from '@mui/icons-material'
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { IoIosImage } from 'react-icons/io'
import { BiTrash } from 'react-icons/bi'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'

import { apiPost } from '../../utils/api';
import { fileToBase64 } from '../../utils/fileToBase64';
import { setToast } from '../../redux/state';

const CreateListing = () => {

    const [category, setCategory] = useState("");
    const [type, setType] = useState("");

    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [submitting, setSubmitting] = useState(false);

    // Location 
    const [formLocation, setFormLocation] = useState({
        streetAddress: "",
        aptSuite: "",
        city: "",
        province: "",
        country: ""
    });

    const handleChangeLocation = (e) => {
        const { name, value } = e.target;
        setFormLocation({
            ...formLocation,
            [name]: value
        })
    }

    // Basic Counts 
    const [guestCount, setGuestCount] = useState(1);
    const [bedroomCount, setBedroomCount] = useState(1);
    const [bedCount, setBedCount] = useState(1);
    const [bathroomCount, setBathroomCount] = useState(1);

    const [amenities, setAmenities] = useState([]);
    const handleSelectAmenities = (facility) => {
        if ((amenities || []).includes(facility)) {
            setAmenities((prevAmenities) => prevAmenities.filter((option) => option !== facility))
        } else {
            setAmenities((prev) => [...prev, facility])
        }
    }

    // Upload, Drag, Drop and Remove Photos 
    const [photos, setPhotos] = useState([]);

    const handleUploadPhotos = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const newItems = files.map((file, i) => ({
            id: `${file.name}-${file.size}-${Date.now()}-${i}`,
            file,
            preview: URL.createObjectURL(file)
        }));

        setPhotos((prevPhotos) => [...prevPhotos, ...newItems]);
        e.target.value = '';
    };

    const handleDragPhoto = (result) => {
        if (!result.destination) return;
        const items = Array.from(photos);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        setPhotos(items);
    };

    const handleRemovePhoto = (indexToRemove) => {
        setPhotos((prevPhotos) => {
            const item = prevPhotos[indexToRemove];
            if (item && item.preview) {
                try { URL.revokeObjectURL(item.preview); } catch { }
            }
            return prevPhotos.filter((_, index) => index !== indexToRemove);
        });
    };

    React.useEffect(() => {
        return () => {
            photos.forEach((item) => {
                if (item && item.preview) {
                    try { URL.revokeObjectURL(item.preview); } catch { }
                }
            });
        };
    }, []);

    // Description 
    const [formDescription, setFormDescription] = useState({
        title: "",
        description: "",
        highlight: "",
        highlightDesc: "",
        price: 0
    });

    const handleChangeDescription = (e) => {
        const { name, value } = e.target;
        setFormDescription({
            ...formDescription,
            [name]: value
        })
    }

    const user = useSelector((state) => state.user.user);
    const creatorId = user?._id;

    React.useEffect(() => {
        if (!user || user.role !== 'host') {
            navigate('/');
        }
    }, [user, navigate]);

    const handlePost = async (e) => {
        e.preventDefault();

        if (photos.length === 0) {
            dispatch(setToast({ message: "At least one property photo is required.", type: "error" }));
            return;
        }

        setSubmitting(true);

        try {
            // Convert all selected photos to Base64 data strings for Cloudinary
            const photoDataStrings = await Promise.all(
                photos.map(p => fileToBase64(p.file || p))
            );

            const payload = {
                creator: creatorId,
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
                amenities,
                title: formDescription.title,
                description: formDescription.description,
                highlight: formDescription.highlight,
                highlightDesc: formDescription.highlightDesc,
                price: formDescription.price,
                listingPhotos: photoDataStrings
            };

            const response = await apiPost('/properties/create', payload);
            const data = await response.json();

            if (response.ok) {
                dispatch(setToast({ message: "Property added successfully!", type: "success" }));
                navigate('/');
            } else {
                dispatch(setToast({ message: data.message || "Failed to create listing.", type: "error" }));
            }
        } catch (error) {
            console.error("Error creating listing:", error);
            dispatch(setToast({ message: error.message || "Failed to add property.", type: "error" }));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div>
            <div className="create-listing">
                <h1>Publish Your Place</h1>
                <form onSubmit={handlePost}>
                    <div className="create-listing_step1">
                        <h2>Step-1: Tell us about your place</h2>
                        <hr />
                        <h3>Which of these categories best describes your place?</h3>
                        <div className="category-list">
                            {categories?.map((item, index) => (
                                <div className={`category ${category === item.label ? "selected" : ""}`} key={index} onClick={() => setCategory(item.label)}>
                                    <div className="category_icon">{item.icon}</div>
                                    <p>{item.label}</p>
                                </div>
                            ))}
                        </div>

                        <h3>What type of place will guests have?</h3>
                        <div className="type-list">
                            {types?.map((item, index) => (
                                <div className={`type ${type === item.name ? "selected" : ""}`} key={index} onClick={() => setType(item.name)}>
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
                                    placeholder='Street Address'
                                    name='streetAddress'
                                    value={formLocation.streetAddress}
                                    onChange={handleChangeLocation}
                                    required />
                            </div>
                        </div>
                        <div className="half">
                            <div className="location">
                                <p>Apartment, Suite, etc. (if applicable)</p>
                                <input
                                    type="text"
                                    placeholder='Apt, Suit, etc. (if applicable)'
                                    name='aptSuite'
                                    value={formLocation.aptSuite}
                                    onChange={handleChangeLocation}
                                    required />
                            </div>
                            <div className="location">
                                <p>City</p>
                                <input
                                    type="text"
                                    placeholder='City'
                                    name='city'
                                    value={formLocation.city}
                                    onChange={handleChangeLocation}
                                    required />
                            </div>
                        </div>
                        <div className="half">
                            <div className="location">
                                <p>Province</p>
                                <input
                                    type="text"
                                    placeholder='Province'
                                    name='province'
                                    value={formLocation.province}
                                    onChange={handleChangeLocation}
                                    required />
                            </div>
                            <div className="location">
                                <p>Country</p>
                                <input
                                    type="text"
                                    placeholder='Country'
                                    name='country'
                                    value={formLocation.country}
                                    onChange={handleChangeLocation}
                                    required />
                            </div>
                        </div>

                        <h3>Share some basics about your place</h3>
                        <div className="basics">
                            <div className="basic">
                                <p>Guests</p>
                                <div className="basic_count">
                                    <RemoveCircleOutline
                                        onClick={() => { guestCount > 1 && setGuestCount(guestCount - 1) }}
                                        sx={{ fontSize: "25px", cursor: "pointer", "&:hover": { color: "var(--accent-color)" } }} />
                                    <p>{guestCount}</p>
                                    <AddCircleOutline
                                        onClick={() => { setGuestCount(guestCount + 1) }}
                                        sx={{ fontSize: "25px", cursor: "pointer", "&:hover": { color: "var(--accent-color)" } }} />
                                </div>
                            </div>
                            <div className="basic">
                                <p>Bedrooms</p>
                                <div className="basic_count">
                                    <RemoveCircleOutline
                                        onClick={() => { bedroomCount > 1 && setBedroomCount(bedroomCount - 1) }}
                                        sx={{ fontSize: "25px", cursor: "pointer", "&:hover": { color: "var(--accent-color)" } }} />
                                    <p>{bedroomCount}</p>
                                    <AddCircleOutline
                                        onClick={() => { setBedroomCount(bedroomCount + 1) }}
                                        sx={{ fontSize: "25px", cursor: "pointer", "&:hover": { color: "var(--accent-color)" } }} />
                                </div>
                            </div>
                            <div className="basic">
                                <p>Beds</p>
                                <div className="basic_count">
                                    <RemoveCircleOutline
                                        onClick={() => { bedCount > 1 && setBedCount(bedCount - 1) }}
                                        sx={{ fontSize: "25px", cursor: "pointer", "&:hover": { color: "var(--accent-color)" } }} />
                                    <p>{bedCount}</p>
                                    <AddCircleOutline
                                        onClick={() => { setBedCount(bedCount + 1) }}
                                        sx={{ fontSize: "25px", cursor: "pointer", "&:hover": { color: "var(--accent-color)" } }} />
                                </div>
                            </div>
                            <div className="basic">
                                <p>Bathrooms</p>
                                <div className="basic_count">
                                    <RemoveCircleOutline
                                        onClick={() => { bathroomCount > 1 && setBathroomCount(bathroomCount - 1) }}
                                        sx={{ fontSize: "25px", cursor: "pointer", "&:hover": { color: "var(--accent-color)" } }} />
                                    <p>{bathroomCount}</p>
                                    <AddCircleOutline
                                        onClick={() => { setBathroomCount(bathroomCount + 1) }}
                                        sx={{ fontSize: "25px", cursor: "pointer", "&:hover": { color: "var(--accent-color)" } }} />
                                </div>
                            </div>

                        </div>

                    </div>

                    <div className="create-listing_step2">
                        <h2>Step-2: Make your place stand out</h2>
                        <hr />

                        <h3>Tell guests what your place has to offer</h3>
                        <div className="amenities">
                            {facilities?.map((item, index) => (
                                <div className={`facility ${(amenities || []).includes(item.name) ? "selected" : ""}`} key={index} onClick={() => handleSelectAmenities(item.name)}>
                                    <div className="facility_icon">{item.icon}</div>
                                    <p>{item.name}</p>
                                </div>
                            ))}
                        </div>

                        <h3>Add some photos of your place</h3>
                        <DragDropContext onDragEnd={handleDragPhoto}>
                            <Droppable droppableId='photos' direction='horizontal'>
                                {(provided) => (
                                    <div className="photos" {...provided.droppableProps} ref={provided.innerRef}>
                                        {photos.length < 1 && (
                                            <>
                                                <input id='upload-image-alone' type="file" style={{ display: "none" }} accept='image/*' onChange={handleUploadPhotos} multiple />
                                                <label htmlFor="upload-image-alone" className='alone'>
                                                    <div className="icon"><IoIosImage /> </div>
                                                    <p>Upload from your device</p>
                                                </label>
                                            </>
                                        )}

                                        {photos.length >= 1 && (
                                            <>
                                                {photos.map((photo, index) => (
                                                    <Draggable key={photo.id || index} draggableId={photo.id ? String(photo.id) : String(index)} index={index} >
                                                        {(provided) => (
                                                            <div className="photo" ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                                                                <img src={photo.preview || (photo instanceof File ? URL.createObjectURL(photo) : photo)} alt="place" />
                                                                <button type="button" onClick={() => handleRemovePhoto(index)}>
                                                                    <BiTrash />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                <input id='upload-image-more' type="file" style={{ display: "none" }} accept='image/*' onChange={handleUploadPhotos} multiple />
                                                <label htmlFor="upload-image-more" className='together'>
                                                    <div className="icon"><IoIosImage /> </div>
                                                    <p>Upload from your device</p>
                                                </label>
                                            </>
                                        )}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </DragDropContext>

                        <h3>What make your place attractive and exciting?</h3>
                        <div className="description">
                            <p>Title</p>
                            <input
                                type="text"
                                placeholder='Title'
                                name='title'
                                value={formDescription.title}
                                onChange={handleChangeDescription}
                                required />

                            <p>Description</p>
                            <textarea
                                placeholder='Description'
                                name='description'
                                value={formDescription.description}
                                onChange={handleChangeDescription}
                                required />

                            <p>Highlight</p>
                            <input
                                type="text"
                                placeholder='Highlight'
                                name='highlight'
                                value={formDescription.highlight}
                                onChange={handleChangeDescription}
                                required />

                            <p>Highlight Details</p>
                            <textarea
                                placeholder='Highlight Details'
                                name='highlightDesc'
                                value={formDescription.highlightDesc}
                                onChange={handleChangeDescription}
                                required />

                            <p>Now, set your PRICE (in USD)</p>
                            <span>$</span>
                            <input
                                type="number"
                                placeholder='100'
                                name="price"
                                className='price'
                                value={formDescription.price}
                                onChange={handleChangeDescription}
                                required />
                        </div>
                    </div>

                    <button className='submit_btn' type='submit'>CREATE YOUR LISTING</button>
                </form>
            </div>
        </div>
    )
}

export default CreateListing
