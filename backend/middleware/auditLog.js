const AuditLog = require('../models/AuditLog.model');

const logAdminAction = (action, targetType) => async (req, res, next) => {
    res.on('finish', async () => {
        if (res.statusCode >= 200 && res.statusCode < 300 && req.user?.role === 'admin') {
            try {
                const targetId = req.params.userId
                    || req.params.listingId
                    || req.params.bookingId
                    || req.params.notifId
                    || null;

                await AuditLog.create({
                    adminId: req.user._id,
                    action,
                    targetType,
                    targetId: targetId?.toString(),
                    details: req.body?.action || req.body?.status || '',
                    ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
                });
            } catch (err) {
                console.error('Audit log failed:', err.message);
            }
        }
    });
    next();
};

module.exports = { logAdminAction };
