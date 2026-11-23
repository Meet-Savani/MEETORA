const mongoose = require('mongoose')

const MessageSchema = new mongoose.Schema(
    {
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        receiverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
        },
        text: {
            type: String,
            default: "",
        },
        imagePath: {
            type: String,
            default: "",
        },
        fileType: {
            type: String,
            default: "", 
        },
        fileName: {
            type: String,
            default: "",
        },
        deletedForUsers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }]
    }, 
    {
        timestamps: true,
    }
);

const Message = mongoose.model("Message", MessageSchema);
module.exports = Message;
