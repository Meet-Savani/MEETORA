const mongoose = require('mongoose');

const SupportTicketSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, enum: ['open', 'resolved', 'closed'], default: 'open' },
    replies: [
        {
            senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            senderRole: { type: String, enum: ['user', 'admin', 'host'] },
            message: { type: String, required: true },
            createdAt: { type: Date, default: Date.now }
        }
    ]
}, { timestamps: true });

module.exports = mongoose.model('SupportTicket', SupportTicketSchema);
