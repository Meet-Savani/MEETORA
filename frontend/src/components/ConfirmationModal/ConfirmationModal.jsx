import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';

const ConfirmationModal = ({ open, title = 'Notification', message = '', type = 'alert', onConfirm, onCancel }) => {
  const handleClose = () => {
    if (onCancel) onCancel();
  };

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          bgcolor: 'var(--card-bg, #ffffff)',
          color: 'var(--text-color)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
          p: 1.5
        }
      }}
    >
      {title && <DialogTitle sx={{ textAlign: 'center', fontWeight: '700', fontSize: '1.25rem' }}>{title}</DialogTitle>}
      <DialogContent sx={{ py: 1 }}>
        <Typography variant="body1" sx={{ textAlign: 'center', color: 'var(--secondary-text-color)', fontSize: '15px', lineHeight: 1.6 }}>
          {message}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center', pb: 2, pt: 1.5 }}>
        {type === 'confirm' && (
          <Button
            variant="outlined"
            onClick={handleClose}
            sx={{
              mr: 1.5,
              borderRadius: '30px',
              textTransform: 'none',
              fontWeight: '700',
              px: 3.5,
              py: 1,
              borderColor: 'var(--secondary-text-color)',
              color: 'var(--text-color)',
              '&:hover': {
                borderColor: 'var(--text-color)',
                bgcolor: 'rgba(0, 0, 0, 0.05)'
              }
            }}
          >
            Cancel
          </Button>
        )}
        <Button
          variant="contained"
          onClick={handleConfirm}
          sx={{
            borderRadius: '30px',
            textTransform: 'none',
            fontWeight: '700',
            px: 3.5,
            py: 1,
            bgcolor: 'var(--primary, #22c55e)',
            color: '#ffffff',
            boxShadow: '0 4px 12px rgba(34, 197, 94, 0.25)',
            '&:hover': {
              bgcolor: 'var(--primary-hover, #16a34a)',
              boxShadow: '0 6px 15px rgba(34, 197, 94, 0.35)',
            }
          }}
        >
          {type === 'confirm' ? 'Confirm' : 'OK'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmationModal;
