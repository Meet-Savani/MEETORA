const getBackendUrl = () => {
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:3000';
        }
    }
    return import.meta.env.VITE_API_URL || 'http://localhost:3000';
};

export const BACKEND_BASE_URL = getBackendUrl().replace(/\/+$/, '');
