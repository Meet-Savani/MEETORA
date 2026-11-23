import React, { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { CheckCircle, Lock, Security, Close } from '@mui/icons-material';
import '../../styles/PaymentProcessing.scss';
import { BACKEND_BASE_URL } from '../../config/constants';
import { resolveImageUrl } from '../../utils/image';

const STEPS = [
    { 
        id: 'verify', 
        label: 'Connecting to Bank Gateway', 
        detail: 'Establishing 256-bit encrypted connection...' 
    },
    { 
        id: 'authorize', 
        label: 'Authorizing Transaction', 
        detail: 'Verifying card authorization and fraud check...' 
    },
    { 
        id: 'finalize', 
        label: 'Securing Your Reservation', 
        detail: 'Locking property dates and generating invoice...' 
    },
];

const PaymentProcessing = ({ amount, listingTitle, listingPhoto, onComplete, onCancel }) => {
    const [activeStep, setActiveStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState([]);
    const timersRef = useRef([]);

    useEffect(() => {
        // Lock body scrolling while processing
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const runSteps = async () => {
            try {
                // Step 1: Connecting to Bank Gateway (1700ms)
                setActiveStep(0);
                await delay(1700);
                setCompletedSteps([0]);

                // Step 2: Authorizing Transaction (1800ms)
                setActiveStep(1);
                await delay(1800);
                setCompletedSteps([0, 1]);

                // Step 3: Securing Reservation (1500ms)
                setActiveStep(2);
                await delay(1500);
                setCompletedSteps([0, 1, 2]);

                // Small delay before transition
                await delay(400);
                onComplete?.();
            } catch (err) {
                console.log("Payment processing cancelled or interrupted");
            }
        };

        runSteps();

        return () => {
            timersRef.current.forEach(clearTimeout);
            document.body.style.overflow = prevOverflow || 'unset';
        };
    }, [onComplete]);

    const delay = (ms) => {
        return new Promise((resolve) => {
            const timer = setTimeout(resolve, ms);
            timersRef.current.push(timer);
        });
    };

    const getStepStatus = (index) => {
        if (completedSteps.includes(index)) return 'completed';
        if (activeStep === index) return 'active';
        return 'pending';
    };

    const handleCancel = () => {
        timersRef.current.forEach(clearTimeout);
        onCancel?.();
    };

    const progressPercent = Math.min(
        100,
        Math.round(((completedSteps.length + (activeStep >= 0 && completedSteps.length < STEPS.length ? 0.5 : 0)) / STEPS.length) * 100)
    );

    const photoUrl = resolveImageUrl(listingPhoto, null);

    return ReactDOM.createPortal(
        <div className="payment-processing-overlay">
            <div className="payment-processing-card">
                {/* Security Shield Badge */}
                <div className="security-icon-wrapper">
                    <div className="pulse-glow-ring" />
                    <div className="security-icon-circle">
                        <Security className="main-sec-icon" />
                    </div>
                </div>

                {/* Header Information */}
                <div className="processing-header">
                    <h2>Processing Payment</h2>
                    <p className="processing-sub">Please wait while your payment is securely verified</p>
                    
                    {amount && (
                        <div className="processing-amount-tag">
                            <span>Amount:</span>
                            <strong>{amount}</strong>
                        </div>
                    )}
                </div>

                {/* Property Pill if provided */}
                {listingTitle && (
                    <div className="listing-secure-pill">
                        {photoUrl && <img src={photoUrl} alt="" className="pill-img" />}
                        <span className="pill-title">{listingTitle}</span>
                    </div>
                )}

                {/* Stepper with live progress state */}
                <ul className="processing-steps">
                    {STEPS.map((step, index) => {
                        const status = getStepStatus(index);
                        return (
                            <li key={step.id} className={`processing-step ${status}`}>
                                <div className="step-icon-wrapper">
                                    {status === 'completed' ? (
                                        <CheckCircle className="step-icon completed" />
                                    ) : status === 'active' ? (
                                        <div className="step-spinner" />
                                    ) : (
                                        <div className="step-dot pending" />
                                    )}
                                </div>
                                <div className="step-text-group">
                                    <span className="step-label">{step.label}</span>
                                    {status === 'active' && (
                                        <span className="step-detail">{step.detail}</span>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>

                {/* Progress Bar */}
                <div className="processing-progress-bar">
                    <div
                        className="processing-progress-fill"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>

                {/* Trust Footer */}
                <div className="security-footer">
                    <Lock sx={{ fontSize: 13 }} />
                    <span>256-Bit SSL Encrypted &bull; PCI-DSS Certified</span>
                </div>

                {/* Cancel button available only before authorization completes */}
                {activeStep === 0 && (
                    <button type="button" className="processing-cancel-btn" onClick={handleCancel}>
                        <Close fontSize="small" /> Cancel Transaction
                    </button>
                )}
            </div>
        </div>,
        document.body
    );
};

export default PaymentProcessing;
