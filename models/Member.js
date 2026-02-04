const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please provide member name'],
            trim: true,
        },
        role: {
            type: String,
            required: [true, 'Please provide member role'],
            enum: ['President', 'Vice President', 'General Secretary', 'Treasurer', 'Executive Member', 'Member'],
        },
        department: {
            type: String,
            required: [true, 'Please provide department'],
            trim: true,
        },
        batch: {
            type: String,
            required: [true, 'Please provide batch'],
            trim: true,
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
        },
        phone: {
            type: String,
            trim: true,
        },
        image: {
            type: String,
            default: '',
        },
        bio: {
            type: String,
            default: '',
            maxlength: 500,
        },
        socialLinks: {
            facebook: { type: String, default: '' },
            linkedin: { type: String, default: '' },
            twitter: { type: String, default: '' },
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        priority: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

// Index for sorting
memberSchema.index({ priority: -1, createdAt: -1 });

module.exports = mongoose.model('Member', memberSchema);
