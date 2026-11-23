import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

const ProtectedRoute = ({ children, roles = [] }) => {
    const user = useSelector((state) => state.user?.user);
    const location = useLocation();

    if (!user) {
        return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
    }

    if (roles.length > 0 && !roles.includes(user.role)) {
        return (
            <div style={{
                minHeight: '70vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '40px 20px',
                color: 'var(--text-color)'
            }}>
                <h1 style={{ fontSize: '3.5rem', marginBottom: '16px', color: '#ef4444', fontWeight: 800 }}>403</h1>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '12px' }}>Access Denied</h2>
                <p style={{ maxWidth: '480px', color: 'var(--secondary-text-color)', marginBottom: '24px', lineHeight: 1.5 }}>
                    You do not have permission to access this page. This section requires {roles.join(' or ')} privileges.
                </p>
                <a
                    href="/"
                    style={{
                        padding: '10px 24px',
                        background: 'var(--primary-color, #22c55e)',
                        color: '#fff',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        fontWeight: '600',
                        boxShadow: '0 4px 12px rgba(34, 197, 94, 0.25)'
                    }}
                >
                    Return to Homepage
                </a>
            </div>
        );
    }

    return children;
};

export default ProtectedRoute;
