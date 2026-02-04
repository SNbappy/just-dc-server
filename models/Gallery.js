const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Please provide a title'],
            trim: true,
        },
        description: {
            type: String,
            default: '',
            maxlength: 500,
        },
        images: [
            {
                url: {
                    type: String,
                    required: true,
                },
                caption: {
                    type: String,
                    default: '',
                },
                uploadedAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        category: {
            type: String,
            enum: ['Event', 'Workshop', 'Competition', 'Meeting', 'Achievement', 'Other'],
            default: 'Other',
        },
        eventDate: {
            type: Date,
        },
        isPublished: {
            type: Boolean,
            default: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// Index for sorting
gallerySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Gallery', gallerySchema);
