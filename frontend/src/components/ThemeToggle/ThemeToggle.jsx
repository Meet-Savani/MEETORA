import React from 'react';
import { DarkMode, LightMode } from '@mui/icons-material';
import '../../styles/ThemeToggle.scss';

const ThemeToggle = ({ theme, setTheme }) => {

    const toggleTheme = () => {
        setTheme(theme === 'light' ? 'dark' : 'light');
    };

    return (
        <div className="theme-toggle" onClick={toggleTheme}>
        <div className={`toggle-switch ${theme === 'dark' ? 'active' : ''}`}>
            <div className="toggle-circle">
            {theme === 'light' ? (
                <DarkMode className="icon moon" />
            ) : (
                <LightMode className="icon sun" />
            )}
            </div>
        </div>
        </div>
    );
};

export default ThemeToggle;
