import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setToast } from '../../redux/state';
import { CheckCircle, ErrorOutline, InfoOutlined, Close } from '@mui/icons-material';
import '../../styles/Toast.scss';

const Toast = () => {
    const toast = useSelector((state) => state.user?.toast);
    const dispatch = useDispatch();

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => {
                dispatch(setToast(null));
            }, 3500);
            return () => clearTimeout(timer);
        }
    }, [toast, dispatch]);

    if (!toast) return null;

    const getIcon = () => {
        switch (toast.type) {
            case 'success':
                return <CheckCircle className="toast-icon success" />;
            case 'error':
                return <ErrorOutline className="toast-icon error" />;
            default:
                return <InfoOutlined className="toast-icon info" />;
        }
    };

    return (
        <div className={`toast-notification-box ${toast.type || 'info'}`}>
            <div className="toast-left">
                {getIcon()}
                <span className="toast-message">{toast.message}</span>
            </div>
            <button className="toast-close-btn" onClick={() => dispatch(setToast(null))}>
                <Close sx={{ fontSize: 16 }} />
            </button>
        </div>
    );
};

export default Toast;
