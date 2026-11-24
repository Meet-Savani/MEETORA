import React, { useEffect, useState } from 'react'
import Navbar from '../components/Navbar/Navbar'
import Footer from '../components/Footer/Footer'
import { Outlet, useLocation } from 'react-router-dom'

const MainLayout = () => {
    const location = useLocation();
    const isAdminRoute = location.pathname.startsWith('/admin');
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

    useEffect(() => {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    return (
        <>
            {!isAdminRoute && <Navbar theme={theme} setTheme={setTheme} />}

            <main className={isAdminRoute ? "admin-main-viewport" : ""}>
                <Outlet />
            </main>
            
            {!isAdminRoute && <Footer />}
        </>
    )
}

export default MainLayout
