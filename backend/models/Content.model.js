const mongoose = require('mongoose')

const ContentSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ["faq", "terms", "policy", "blog"],
            required: true,
        },
        title: {
            type: String,
            required: true,
        },
        content: {
            type: String,
            required: true,
        },
        author: {
            type: String,
            default: "Admin",
        }
    }, 
    {
        timestamps: true,
    }
);

const Content = mongoose.model("Content", ContentSchema);
module.exports = Content;
