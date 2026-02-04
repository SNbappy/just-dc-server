const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        type: {
            type: String,
            enum: ['registration', 'monthly'],
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'paid', 'failed', 'overdue', 'refunded'],
            default: 'pending',
        },
        paymentMethod: {
            type: String,
            enum: ['bkash', 'nagad', 'rocket', 'bank', 'cash', 'sslcommerz'],
        },
        transactionId: {
            type: String,
        },
        month: {
            type: String,
        },
        year: {
            type: Number,
        },
        paidAt: {
            type: Date,
        },
        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        verifiedAt: {
            type: Date,
        },
        dueDate: {
            type: Date,
        },
        notes: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

// Index for quick queries
paymentSchema.index({ user: 1, type: 1, month: 1 });
paymentSchema.index({ status: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
