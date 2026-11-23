import React, { useEffect, useRef, useState } from 'react';
import { IconButton } from "@mui/material";
import { Search, Person, Menu } from "@mui/icons-material";
import '../../styles/Navbar.scss';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { setLogout } from '../../redux/state';
import { Select, MenuItem } from '@mui/material';
import { setCurrency, loadCurrencyFromStorage, fetchRates } from '../../redux/currencySlice';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import { BACKEND_BASE_URL } from '../../config/constants';
import { resolveImageUrl } from '../../utils/image';

const Navbar = ({ theme, setTheme }) => {

    const [dropdownMenu, setDropdownMenu] = useState(false);
    const user = useSelector((state) => state.user?.user);
    const selectedCurrency = useSelector((state) => state.currency.selected);
    const dispatch = useDispatch();
    const [search, setSearch] = useState("");
    const [liveResults, setLiveResults] = useState([]);
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const searchContainerRef = useRef(null);
    const navigate = useNavigate();
    const menuRef = useRef(null);
    const [navAvatarError, setNavAvatarError] = useState(false);

    useEffect(() => {
        setNavAvatarError(false);
    }, [user?.profileImagePath]);

    const getAvatarUrl = (path) => resolveImageUrl(path, null);

    // Live search debounced fetch
    useEffect(() => {
        const query = search.trim();
        if (query.length < 2) {
            setLiveResults([]);
            setShowSearchDropdown(false);
            return;
        }

        setIsSearching(true);
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`${BACKEND_BASE_URL}/properties/search/${encodeURIComponent(query)}`);
                if (res.ok) {
                    const data = await res.json();
                    const results = Array.isArray(data?.listings) ? data.listings : (Array.isArray(data) ? data : []);
                    setLiveResults(results.slice(0, 5));
                    setShowSearchDropdown(true);
                }
            } catch (err) {
                console.error("Live search failed:", err);
            } finally {
                setIsSearching(false);
            }
        }, 220);

        return () => clearTimeout(timer);
    }, [search]);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setDropdownMenu(false);
            }
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
                setShowSearchDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSearchSubmit = (e) => {
        if (e) e.preventDefault();
        const query = search.trim();
        if (!query) return;
        setShowSearchDropdown(false);
        navigate(`/properties/search/${encodeURIComponent(query)}`);
    };

    const handleSelectResult = (listingId) => {
        setShowSearchDropdown(false);
        setSearch("");
        navigate(`/properties/${listingId}`);
    };

    const handleCurrencyChange = (e) => {
        const newCurr = e.target.value;
        dispatch(setCurrency(newCurr));
        dispatch(fetchRates());
    };

    return (
        <div className='navbar'>
            <a href="/" className='navbar_logo'>
                <img 
                    src={theme === 'light' ? "/assets/logo-dark.png" : "/assets/logo-light.png"}
                    alt="MEETORA logo" />
            </a>

            <div className="navbar_search_container" ref={searchContainerRef}>
                <form className="navbar_search" onSubmit={handleSearchSubmit}>
                    <input 
                        type="text" 
                        placeholder='Search properties, cities, categories...' 
                        value={search}
                        onFocus={() => { if (search.trim().length >= 2 && liveResults.length > 0) setShowSearchDropdown(true); }}
                        onChange={(e) => setSearch(e.target.value)} 
                    /> 
                    <IconButton type="submit" disabled={search.trim() === ""} aria-label="Search">
                        <Search />
                    </IconButton>
                </form>

                {showSearchDropdown && search.trim().length >= 2 && (
                    <div className="navbar_search_dropdown">
                        {isSearching ? (
                            <div className="search-dropdown-loading">Searching...</div>
                        ) : liveResults.length > 0 ? (
                            <>
                                <div className="search-dropdown-header">Matching Properties</div>
                                {liveResults.map((item) => {
                                    const photo = resolveImageUrl(item.listingPhotoPaths && item.listingPhotoPaths[0], '/assets/default.jpg');
                                    return (
                                        <div 
                                            key={item._id} 
                                            className="search-dropdown-item" 
                                            onClick={() => handleSelectResult(item._id)}
                                        >
                                            <img src={photo} alt={item.title} className="item-thumb" />
                                            <div className="item-info">
                                                <div className="item-title">{item.title}</div>
                                                <div className="item-sub">{item.city}, {item.country} • {item.category}</div>
                                            </div>
                                            <div className="item-price">${item.price}/night</div>
                                        </div>
                                    );
                                })}
                                <button type="button" className="search-dropdown-viewall" onClick={handleSearchSubmit}>
                                    View all results for "{search.trim()}"
                                </button>
                            </>
                        ) : (
                            <div className="search-dropdown-empty">
                                No properties found for "{search.trim()}"
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="navbar_right" ref={menuRef}>
                <div className="navbar_desktop_controls">
                    {/* Theme Toggle */}
                    <ThemeToggle theme={theme} setTheme={setTheme} />

                    {/* Currency Selector */}
                    <div className="currency-selector" style={{ marginRight: '12px' }}>
                    <Select
                        value={selectedCurrency}
                        onChange={handleCurrencyChange}
                        variant="outlined"
                        size="small"
                        sx={{ 
                            color: 'var(--text-color)', 
                            fontSize: '14px',
                            fontWeight: '600',
                            minWidth: '80px',
                            height: '40px',
                            borderRadius: '20px',
                            border: '1px solid var(--border-color, #eaeaea)',
                            backgroundColor: 'var(--bg-color)',
                            '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                            '&:hover': {
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                            },
                            '& .MuiSvgIcon-root': { color: 'var(--text-color)' }
                        }}
                        MenuProps={{
                            disableScrollLock: true,
                            PaperProps: {
                                sx: {
                                    bgcolor: 'var(--card-bg)',
                                    color: 'var(--text-color)'
                                }
                            }
                        }}
                    >
                        <MenuItem value="USD">USD</MenuItem>
                        <MenuItem value="EUR">EUR</MenuItem>
                        <MenuItem value="GBP">GBP</MenuItem>
                        <MenuItem value="INR">INR</MenuItem>
                        <MenuItem value="AUD">AUD</MenuItem>
                        <MenuItem value="CAD">CAD</MenuItem>
                        <MenuItem value="CHF">CHF</MenuItem>
                        <MenuItem value="NZD">NZD</MenuItem>
                        <MenuItem value="AED">AED</MenuItem>
                        <MenuItem value="SGD">SGD</MenuItem>
                    </Select>
                    </div>
                </div>

                {user ? ( 
                    user.role === 'admin' ? (
                        <Link to="/admin/dashboard" className='host' style={{ fontWeight: '600' }}>Admin Panel</Link>
                    ) : user.role === 'host' ? (
                        <Link to="/create-listing" className='host'>Host a Home</Link>
                    ) : (
                        <Link to="/become-host" className='host'>Become A Host</Link>
                    )
                ) : ( 
                    <Link to="/become-host" className='host'>Become A Host</Link>
                )}

                <button 
                    className='navbar_right_account' 
                    onClick={() => setDropdownMenu(!dropdownMenu)}>

                    <Menu sx={{ color: 'var(--text-color)' }} />
                    {!user ? ( 
                        <Person sx={{ color: 'var(--text-color)' }} />
                    ) : user.profileImagePath && !navAvatarError ? ( 
                        <img 
                            src={getAvatarUrl(user.profileImagePath)} 
                            alt='Profile photo' 
                            style={{ objectFit: "cover", borderRadius: "50%", width: "32px", height: "32px" }} 
                            onError={() => setNavAvatarError(true)}
                        />
                    ) : (
                        <div className="profile-avatar-initials">
                            {user.firstName ? user.firstName.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : "U")}
                        </div>
                    )}
                </button>

                {/* Backdrop overlay for mobile drawer */}
                {dropdownMenu && (
                    <div className="drawer-backdrop" onClick={() => setDropdownMenu(false)} />
                )}

                {/* Account Dropdown / Mobile Drawer */}
                {dropdownMenu && !user && (
                    <div className="navbar_right_accountmenu">
                        <div className="drawer-header">
                            <h3>Menu</h3>
                            <button className="drawer-close-btn" onClick={() => setDropdownMenu(false)}>&times;</button>
                        </div>
                        <form className="mobile-drawer-search" onSubmit={(e) => {
                            e.preventDefault();
                            if (search.trim()) {
                                setDropdownMenu(false);
                                navigate(`/properties/search/${encodeURIComponent(search.trim())}`);
                            }
                        }}>
                            <input 
                                type="text" 
                                placeholder="Search properties..." 
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            <IconButton type="submit" disabled={search.trim() === ""}>
                                <Search sx={{ fontSize: 18 }} />
                            </IconButton>
                        </form>
                        <div className="drawer-links" onClick={() => setDropdownMenu(false)}>
                            <Link to="/login">Log In</Link>
                            <Link to="/register">Sign Up</Link>
                        </div>
                        
                        <div className="mobile-drawer-controls">
                            <div className="drawer-control-item">
                                <span>Theme</span>
                                <ThemeToggle theme={theme} setTheme={setTheme} />
                            </div>
                            <div className="drawer-control-item">
                                <span>Currency</span>
                                <Select
                                    value={selectedCurrency}
                                    onChange={handleCurrencyChange}
                                    variant="outlined"
                                    size="small"
                                    sx={{ 
                                        color: 'var(--text-color)', 
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        minWidth: '80px',
                                        height: '40px',
                                        borderRadius: '20px',
                                        border: '1px solid var(--border-color, #eaeaea)',
                                        backgroundColor: 'var(--bg-color)',
                                        '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                                        '&:hover': {
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                        },
                                        '& .MuiSvgIcon-root': { color: 'var(--text-color)' }
                                    }}
                                    MenuProps={{
                                        disableScrollLock: true,
                                        PaperProps: {
                                            sx: {
                                                bgcolor: 'var(--card-bg)',
                                                color: 'var(--text-color)'
                                            }
                                        }
                                    }}
                                >
                                    <MenuItem value="USD">USD</MenuItem>
                                    <MenuItem value="EUR">EUR</MenuItem>
                                    <MenuItem value="GBP">GBP</MenuItem>
                                    <MenuItem value="INR">INR</MenuItem>
                                    <MenuItem value="AUD">AUD</MenuItem>
                                    <MenuItem value="CAD">CAD</MenuItem>
                                    <MenuItem value="CHF">CHF</MenuItem>
                                    <MenuItem value="NZD">NZD</MenuItem>
                                    <MenuItem value="AED">AED</MenuItem>
                                    <MenuItem value="SGD">SGD</MenuItem>
                                </Select>
                            </div>
                        </div>
                    </div>
                )}

                {dropdownMenu && user && (
                    <div className="navbar_right_accountmenu">
                        <div className="drawer-header">
                            <h3>Menu</h3>
                            <button className="drawer-close-btn" onClick={() => setDropdownMenu(false)}>&times;</button>
                        </div>
                        <form className="mobile-drawer-search" onSubmit={(e) => {
                            e.preventDefault();
                            if (search.trim()) {
                                setDropdownMenu(false);
                                navigate(`/properties/search/${encodeURIComponent(search.trim())}`);
                            }
                        }}>
                            <input 
                                type="text" 
                                placeholder="Search properties..." 
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            <IconButton type="submit" disabled={search.trim() === ""}>
                                <Search sx={{ fontSize: 18 }} />
                            </IconButton>
                        </form>
                        <div className="drawer-links" onClick={() => setDropdownMenu(false)}>
                            {user.role === 'admin' ? (
                                <>
                                    <Link to="/admin/dashboard">Admin Panel</Link>
                                    <Link to="/chat">Messages</Link>
                                    <Link to="/notifications">Notifications</Link>
                                    <Link to="/profile">Profile</Link>
                                    <Link to="/login" onClick={() => {
                                        dispatch(setLogout())
                                    }}>Log Out</Link>
                                </>
                            ) : (
                                <>
                                    <Link to={`/${user._id}/trips`}>Trip List</Link>
                                    <Link to={`/${user._id}/wishList`}>Wish List</Link>
                                    {user.role === 'host' ? (
                                        <>
                                            <Link to={`/${user._id}/properties`}>My Properties</Link>
                                            <Link to={`/${user._id}/reservations`}>Reservations</Link>
                                            <Link to="/host/dashboard">Host Dashboard</Link>
                                            <Link to="/create-listing">Create Listing</Link>
                                        </>
                                    ) : (
                                        <Link to="/become-host">Become A Host</Link>
                                    )}
                                    <Link to="/chat">Messages</Link>
                                    <Link to="/notifications">Notifications</Link>
                                    <Link to="/profile">Profile</Link>
                                    <Link to="/login" onClick={() => {
                                        dispatch(setLogout())
                                    }}>Log Out</Link>
                                </>
                            )}
                        </div>
                        
                        <div className="mobile-drawer-controls">
                            <div className="drawer-control-item">
                                <span>Theme</span>
                                <ThemeToggle theme={theme} setTheme={setTheme} />
                            </div>
                            <div className="drawer-control-item">
                                <span>Currency</span>
                                <Select
                                    value={selectedCurrency}
                                    onChange={handleCurrencyChange}
                                    variant="outlined"
                                    size="small"
                                    sx={{ 
                                        color: 'var(--text-color)', 
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        minWidth: '80px',
                                        height: '40px',
                                        borderRadius: '20px',
                                        border: '1px solid var(--border-color, #eaeaea)',
                                        backgroundColor: 'var(--bg-color)',
                                        '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                                        '&:hover': {
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                        },
                                        '& .MuiSvgIcon-root': { color: 'var(--text-color)' }
                                    }}
                                    MenuProps={{
                                        disableScrollLock: true,
                                        PaperProps: {
                                            sx: {
                                                bgcolor: 'var(--card-bg)',
                                                color: 'var(--text-color)'
                                            }
                                        }
                                    }}
                                >
                                    <MenuItem value="USD">USD</MenuItem>
                                    <MenuItem value="EUR">EUR</MenuItem>
                                    <MenuItem value="GBP">GBP</MenuItem>
                                    <MenuItem value="INR">INR</MenuItem>
                                    <MenuItem value="AUD">AUD</MenuItem>
                                    <MenuItem value="CAD">CAD</MenuItem>
                                    <MenuItem value="CHF">CHF</MenuItem>
                                    <MenuItem value="NZD">NZD</MenuItem>
                                    <MenuItem value="AED">AED</MenuItem>
                                    <MenuItem value="SGD">SGD</MenuItem>
                                </Select>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default Navbar
