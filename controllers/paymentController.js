const Payment = require('../models/Payment');
const User = require('../models/User');

// @desc    Get all payments
// @route   GET /api/payments
// @access  Private/Admin/President/GS
exports.getAllPayments = async (req, res) => {
    try {
        const { type, status, month, userId } = req.query;

        const query = {};
        if (type) query.type = type;
        if (status) query.status = status;
        if (month) query.month = month;
        if (userId) query.user = userId;

        const payments = await Payment.find(query)
            .populate('user', 'name email studentId phone')
            .populate('verifiedBy', 'name')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: payments.length,
            data: payments,
        });
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};

// @desc    Get user's payments
// @route   GET /api/payments/my-payments
// @access  Private
exports.getMyPayments = async (req, res) => {
    try {
        const payments = await Payment.find({ user: req.user.id })
            .populate('verifiedBy', 'name')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: payments.length,
            data: payments,
        });
    } catch (error) {
        console.error('Error fetching user payments:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};

// @desc    Create payment record
// @route   POST /api/payments
// @access  Private
exports.createPayment = async (req, res) => {
    try {
        const { amount, type, paymentMethod, transactionId, month, notes } = req.body;

        // Validate required fields
        if (!amount || !type) {
            return res.status(400).json({
                success: false,
                message: 'Please provide amount and payment type',
            });
        }

        // Check if registration payment already exists
        if (type === 'registration') {
            const existingPayment = await Payment.findOne({
                user: req.user.id,
                type: 'registration',
                status: { $in: ['paid', 'pending'] },
            });

            if (existingPayment) {
                return res.status(400).json({
                    success: false,
                    message: 'Registration payment already exists',
                });
            }
        }

        // Check if monthly payment for this month already exists
        if (type === 'monthly' && month) {
            const existingPayment = await Payment.findOne({
                user: req.user.id,
                type: 'monthly',
                month,
                status: { $in: ['paid', 'pending'] },
            });

            if (existingPayment) {
                return res.status(400).json({
                    success: false,
                    message: 'Payment for this month already exists',
                });
            }
        }

        const payment = await Payment.create({
            user: req.user.id,
            amount,
            type,
            paymentMethod,
            transactionId,
            month: type === 'monthly' ? month : undefined,
            year: type === 'monthly' && month ? parseInt(month.split('-')[0]) : undefined,
            dueDate: type === 'monthly' ? new Date(month + '-05') : undefined,
            notes,
            status: 'pending',
        });

        await payment.populate('user', 'name email');

        res.status(201).json({
            success: true,
            message: 'Payment submitted successfully. Waiting for verification.',
            data: payment,
        });
    } catch (error) {
        console.error('Error creating payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create payment',
            error: error.message,
        });
    }
};

// @desc    Verify payment
// @route   PUT /api/payments/:id/verify
// @access  Private/Admin/President/GS
exports.verifyPayment = async (req, res) => {
    try {
        const { status, notes } = req.body;

        if (!['paid', 'failed'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be "paid" or "failed"',
            });
        }

        const payment = await Payment.findById(req.params.id);

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found',
            });
        }

        payment.status = status;
        payment.verifiedBy = req.user.id;
        payment.verifiedAt = new Date();
        if (status === 'paid') {
            payment.paidAt = new Date();
        }
        if (notes) {
            payment.notes = notes;
        }

        await payment.save();

        // Update user's payment status
        if (status === 'paid') {
            const user = await User.findById(payment.user);

            if (payment.type === 'registration') {
                user.registrationFeePaid = true;
                user.registrationPaymentDate = new Date();
            } else if (payment.type === 'monthly') {
                user.lastMonthlyPayment = new Date();
                user.monthlyFeeStatus = 'current';
            }

            await user.save();
        }

        await payment.populate([
            { path: 'user', select: 'name email' },
            { path: 'verifiedBy', select: 'name' },
        ]);

        res.status(200).json({
            success: true,
            message: `Payment ${status === 'paid' ? 'verified' : 'rejected'} successfully`,
            data: payment,
        });
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify payment',
            error: error.message,
        });
    }
};

// @desc    Get payment statistics
// @route   GET /api/payments/stats
// @access  Private/Admin/President/GS
exports.getPaymentStats = async (req, res) => {
    try {
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

        const stats = {
            totalRevenue: 0,
            registrationRevenue: 0,
            monthlyRevenue: 0,
            pendingPayments: 0,
            paidThisMonth: 0,
            overduePayments: 0,
        };

        // Total revenue (all paid payments)
        const paidPayments = await Payment.find({ status: 'paid' });
        stats.totalRevenue = paidPayments.reduce((sum, p) => sum + p.amount, 0);

        // Registration revenue
        const regPayments = await Payment.find({ type: 'registration', status: 'paid' });
        stats.registrationRevenue = regPayments.reduce((sum, p) => sum + p.amount, 0);

        // Monthly revenue
        const monthlyPayments = await Payment.find({ type: 'monthly', status: 'paid' });
        stats.monthlyRevenue = monthlyPayments.reduce((sum, p) => sum + p.amount, 0);

        // Pending payments
        stats.pendingPayments = await Payment.countDocuments({ status: 'pending' });

        // Paid this month
        stats.paidThisMonth = await Payment.countDocuments({
            status: 'paid',
            month: currentMonth,
        });

        // Overdue payments
        stats.overduePayments = await Payment.countDocuments({ status: 'overdue' });

        res.status(200).json({
            success: true,
            data: stats,
        });
    } catch (error) {
        console.error('Error fetching payment stats:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};

// @desc    Generate monthly payment records for all members
// @route   POST /api/payments/generate-monthly
// @access  Private/Admin
exports.generateMonthlyPayments = async (req, res) => {
    try {
        const { month } = req.body; // Format: YYYY-MM

        if (!month) {
            return res.status(400).json({
                success: false,
                message: 'Please provide month in YYYY-MM format',
            });
        }

        // Get all approved members
        const members = await User.find({
            role: { $in: ['member', 'executive_member', 'general_secretary', 'president'] },
            membershipStatus: 'approved',
            isActive: true,
        });

        const createdPayments = [];
        const skippedUsers = [];

        for (const member of members) {
            // Check if payment already exists for this month
            const existingPayment = await Payment.findOne({
                user: member._id,
                type: 'monthly',
                month,
            });

            if (!existingPayment) {
                const payment = await Payment.create({
                    user: member._id,
                    amount: 30,
                    type: 'monthly',
                    month,
                    year: parseInt(month.split('-')[0]),
                    dueDate: new Date(month + '-05'),
                    status: 'pending',
                });
                createdPayments.push(payment);
            } else {
                skippedUsers.push(member.name);
            }
        }

        res.status(201).json({
            success: true,
            message: `Monthly payments generated for ${month}`,
            data: {
                created: createdPayments.length,
                skipped: skippedUsers.length,
                skippedUsers,
            },
        });
    } catch (error) {
        console.error('Error generating monthly payments:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate monthly payments',
            error: error.message,
        });
    }
};
