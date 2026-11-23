import { store } from '../redux/store';
import { setLogout, setToast } from '../redux/state';
import { BACKEND_BASE_URL } from '../config/constants';

export const getAuthToken = () => store.getState()?.user?.token || null;

export const getAuthHeaders = (options = {}) => {
    const headers = { ...(options.headers || {}) };
    const token = getAuthToken();

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    if (!headers.Accept) {
        headers.Accept = 'application/json';
    }

    const isFormData = options.body instanceof FormData;
    if (!isFormData && !headers['Content-Type'] && options.method && options.method !== 'GET') {
        headers['Content-Type'] = 'application/json';
    }

    return headers;
};

export const apiFetch = async (path, options = {}) => {
    const cleanBase = (BACKEND_BASE_URL || '').replace(/\/+$/, '');
    const cleanPath = (path || '').replace(/^\/+/, '');
    const url = path.startsWith('http') ? path : `${cleanBase}/${cleanPath}`;
    const headers = getAuthHeaders(options);

    const response = await fetch(url, {
        ...options,
        headers,
    });

    if (response.status === 401) {
        store.dispatch(setLogout());
        store.dispatch(setToast({ message: 'Session expired. Please log in again.', type: 'error' }));
    }

    return response;
};

export const apiGet = (path) => apiFetch(path, { method: 'GET' });

export const apiPost = (path, body) => apiFetch(path, {
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body),
});

export const apiPatch = (path, body) => apiFetch(path, {
    method: 'PATCH',
    body: body instanceof FormData ? body : JSON.stringify(body),
});

export const apiPut = (path, body) => apiFetch(path, {
    method: 'PUT',
    body: body instanceof FormData ? body : JSON.stringify(body),
});

export const apiDelete = (path) => apiFetch(path, { method: 'DELETE' });

export const openAuthenticatedPdf = async (path) => {
    const response = await apiFetch(path);
    if (!response.ok) {
        throw new Error('Unable to open document. Please try again.');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
};
