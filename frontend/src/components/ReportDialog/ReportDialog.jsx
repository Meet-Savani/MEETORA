import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, MenuItem } from '@mui/material';
import { apiPost } from '../../utils/api';
import { fileToBase64 } from '../../utils/fileToBase64';
import { useDispatch } from 'react-redux';
import { setToast } from '../../redux/state';

const ReportDialog = ({ open, onClose, targetType, targetId }) => {
    const [reason, setReason] = useState('');
    const [description, setDescription] = useState('');
    const [screenshot, setScreenshot] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const dispatch = useDispatch();

    const getTitle = () => {
        switch (targetType) {
            case 'listing': return 'Report Property Listing';
            case 'review': return 'Report Review Feedback';
            case 'host': return 'Report Host Account';
            case 'guest': return 'Report Guest User';
            default: return 'Submit Abuse Report';
        }
    };

    const handleClose = () => {
        setReason('');
        setDescription('');
        setScreenshot(null);
        onClose();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!reason) {
            dispatch(setToast({ message: "Please specify a reason.", type: "error" }));
            return;
        }

        setSubmitting(true);
        try {
            let screenshotBase64 = null;
            if (screenshot) {
                screenshotBase64 = await fileToBase64(screenshot);
            }

            const payload = {
                targetType,
                targetId,
                reason,
                description,
                screenshot: screenshotBase64
            };

            const response = await apiPost('/support/reports', payload);
            if (response.ok) {
                dispatch(setToast({ message: "Thank you. Your report has been submitted to administrators.", type: "success" }));
                handleClose();
            } else {
                const data = await response.json();
                dispatch(setToast({ message: data.message || "Failed to submit report.", type: "error" }));
            }
        } catch (err) {
            console.error(err);
            dispatch(setToast({ message: "Connection error.", type: "error" }));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog 
            open={open} 
            onClose={handleClose} 
            fullWidth 
            maxWidth="sm" 
            PaperProps={{ 
                sx: { 
                    borderRadius: '16px', 
                    bgcolor: 'var(--bg-color, #fff)', 
                    color: 'var(--text-color, #1e293b)' 
                } 
            }}
        >
            <DialogTitle sx={{ fontWeight: 700 }}>{getTitle()}</DialogTitle>
            <DialogContent>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '10px' }}>
                    <TextField
                        select
                        fullWidth
                        label="Reason for reporting"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        required
                        variant="outlined"
                    >
                        <MenuItem value="Spam or Advertising">Spam or Advertising</MenuItem>
                        <MenuItem value="Fraud or Scam">Fraud or Scam</MenuItem>
                        <MenuItem value="Inappropriate Content">Inappropriate Content</MenuItem>
                        <MenuItem value="Harassment or Abuse">Harassment or Abuse</MenuItem>
                        <MenuItem value="Incorrect Information">Incorrect Information</MenuItem>
                        <MenuItem value="Other">Other</MenuItem>
                    </TextField>

                    <TextField 
                        fullWidth 
                        multiline 
                        rows={4} 
                        label="Additional Details (optional)" 
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Provide any additional details or context..."
                        variant="outlined"
                    />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--secondary-text-color)' }}>
                            Upload Screenshot (Optional)
                        </label>
                        <input 
                            type="file" 
                            accept="image/*" 
                            onChange={(e) => setScreenshot(e.target.files[0])} 
                            style={{ 
                                padding: '8px', 
                                border: '1px solid var(--border-color, #eaeaea)', 
                                borderRadius: '6px', 
                                background: 'var(--input-bg, #fafafa)', 
                                color: 'var(--text-color)',
                                fontSize: '13px'
                            }}
                        />
                    </div>

                    <DialogActions sx={{ padding: '8px 0 0 0' }}>
                        <Button 
                            onClick={handleClose} 
                            variant="outlined" 
                            color="inherit" 
                            disabled={submitting}
                            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
                        >
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            variant="contained" 
                            color="error" 
                            disabled={submitting}
                            sx={{ 
                                borderRadius: '8px', 
                                textTransform: 'none', 
                                fontWeight: 600,
                                bgcolor: '#ef4444',
                                '&:hover': { bgcolor: '#dc2626' }
                            }}
                        >
                            {submitting ? 'Submitting...' : 'Submit Report'}
                        </Button>
                    </DialogActions>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default ReportDialog;
