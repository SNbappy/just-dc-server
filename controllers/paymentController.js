const Payment = require('../models/Payment');
const User = require('../models/User');
const { Op } = require('sequelize');

// helper: attach user + verifiedBy like populate
const attachPopulate = async (payments) => {
    if (!payments) return payments;

    // single payment
    if (!Array.isArray(payments)) {
        const p = payments.toJSON ? payments.toJSON() : payments;

        const [user, verifier] = await Promise.all([
            p.userId
                ? User.findByPk(p.userId, { attributes: ['id', 'name', 'email', 'studentId', 'phone'] })
                : null,
            p.verifiedBy
                ? User.findByPk(p.verifiedBy, { attributes: ['id', 'name'] })
                : null
        ]);

        return {
            ...p,
            _id: p.id,
            user: user
                ? { _id: user.id, name: user.name, email: user.email, studentId: user.studentId, phone: user.phone }
                : null,
            verifiedBy: verifier ? { _id: verifier.id, name: verifier.name } : null
        };
    }

    // list payments
    const plain = payments.map((x) => (x.toJSON ? x.toJSON() : x));
    const userIds = [...new Set(plain.map((p) => p.userId).filter(Boolean))];
    const verifierIds = [...new Set(plain.map((p) => p.verifiedBy).filter(Boolean))];

    const [users, verifiers] = await Promise.all([
        userIds.length
            ? User.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ['id', 'name', 'email', 'studentId', 'phone'] })
            : [],
        verifierIds.length
            ? User.findAll({ where: { id: { [Op.in]: verifierIds } }, attributes: ['id', 'name'] })
            : []
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));
    const verifierMap = new Map(verifiers.map((u) => [u.id, u]));

    return plain.map((p) => {
        const u = userMap.get(p.userId);
        const v = verifierMap.get(p.verifiedBy);
        return {
            ...p,
            _id: p.id,
            user: u ? { _id: u.id, name: u.name, email: u.email, studentId: u.studentId, phone: u.phone } : null,
            verifiedBy: v ? { _id: v.id, name: v.name } : null
        };
    });
};

// @desc    Get all payments
// @route   GET /api/payments
// @access  Private/Admin/President/GS
exports.getAllPayments = async (req, res) => {
    try {
        const { type, status, month, userId } = req.query;

        const where = {};
        if (type) where.type = type;
        if (status) where.status = status;
        if (month) where.month = month;
        if (userId) where.userId = userId;

        const payments = await Payment.findAll({
            where,
            order: [['createdAt', 'DESC']]
        });

        const data = await attachPopulate(payments);

        res.status(200).json({
            success: true,
            count: data.length,
            data
        });
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// @desc    Get user's payments
// @route   GET /api/payments/my-payments
// @access  Private
exports.getMyPayments = async (req, res) => {
    try {
        const payments = await Payment.findAll({
            where: { userId: req.user.id },
            order: [['createdAt', 'DESC']]
        });

        const data = await attachPopulate(payments);

        res.status(200).json({
            success: true,
            count: data.length,
            data
        });
    } catch (error) {
        console.error('Error fetching user payments:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
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
                message: 'Please provide amount and payment type'
            });
        }

        // Check if registration payment already exists
        if (type === 'registration') {
            const existingPayment = await Payment.findOne({
                where: {
                    userId: req.user.id,
                    type: 'registration',
                    status: { [Op.in]: ['paid', 'pending'] }
                }
            });

            if (existingPayment) {
                return res.status(400).json({
                    success: false,
                    message: 'Registration payment already exists'
                });
            }
        }

        // Check if monthly payment for this month already exists
        if (type === 'monthly' && month) {
            const existingPayment = await Payment.findOne({
                where: {
                    userId: req.user.id,
                    type: 'monthly',
                    month,
                    status: { [Op.in]: ['paid', 'pending'] }
                }
            });

            if (existingPayment) {
                return res.status(400).json({
                    success: false,
                    message: 'Payment for this month already exists'
                });
            }
        }

        const year = type === 'monthly' && month ? parseInt(month.split('-')[0], 10) : null;
        const dueDate = type === 'monthly' && month ? new Date(`${month}-05`) : null;

        const payment = await Payment.create({
            userId: req.user.id,
            amount,
            type,
            paymentMethod,
            transactionId,
            month: type === 'monthly' ? month : null,
            year: type === 'monthly' ? year : null,
            dueDate,
            notes,
            status: 'pending'
        });

        const data = await attachPopulate(payment);

        res.status(201).json({
            success: true,
            message: 'Payment submitted successfully. Waiting for verification.',
            data
        });
    } catch (error) {
        console.error('Error creating payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create payment',
            error: error.message
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
                message: 'Invalid status. Must be "paid" or "failed"'
            });
        }

        const payment = await Payment.findByPk(req.params.id);

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        await payment.update({
            status,
            verifiedBy: req.user.id,
            verifiedAt: new Date(),
            paidAt: status === 'paid' ? new Date() : payment.paidAt,
            notes: notes ? notes : payment.notes
        });

        // Update user's payment status
        if (status === 'paid') {
            const user = await User.findByPk(payment.userId);

            if (user) {
                if (payment.type === 'registration') {
                    await user.update({
                        registrationFeePaid: true,
                        registrationPaymentDate: new Date()
                    });
                } else if (payment.type === 'monthly') {
                    await user.update({
                        lastMonthlyPayment: new Date(),
                        monthlyFeeStatus: 'current'
                    });
                }
            }
        }

        const data = await attachPopulate(payment);

        res.status(200).json({
            success: true,
            message: `Payment ${status === 'paid' ? 'verified' : 'rejected'} successfully`,
            data
        });
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify payment',
            error: error.message
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
            overduePayments: 0
        };

        // Total revenue (all paid payments)
        const paidPayments = await Payment.findAll({ where: { status: 'paid' } });
        stats.totalRevenue = paidPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

        // Registration revenue
        const regPayments = await Payment.findAll({ where: { type: 'registration', status: 'paid' } });
        stats.registrationRevenue = regPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

        // Monthly revenue
        const monthlyPayments = await Payment.findAll({ where: { type: 'monthly', status: 'paid' } });
        stats.monthlyRevenue = monthlyPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

        // Pending payments
        stats.pendingPayments = await Payment.count({ where: { status: 'pending' } });

        // Paid this month
        stats.paidThisMonth = await Payment.count({
            where: {
                status: 'paid',
                month: currentMonth
            }
        });

        // Overdue payments
        stats.overduePayments = await Payment.count({ where: { status: 'overdue' } });

        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching payment stats:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
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
                message: 'Please provide month in YYYY-MM format'
            });
        }

        // Get all approved members
        const members = await User.findAll({
            where: {
                role: { [Op.in]: ['member', 'executive_member', 'general_secretary', 'president'] },
                membershipStatus: 'approved',
                isActive: true
            },
            attributes: ['id', 'name']
        });

        const createdPayments = [];
        const skippedUsers = [];

        for (const member of members) {
            // Check if payment already exists for this month
            const existingPayment = await Payment.findOne({
                where: {
                    userId: member.id,
                    type: 'monthly',
                    month
                }
            });

            if (!existingPayment) {
                const payment = await Payment.create({
                    userId: member.id,
                    amount: 30,
                    type: 'monthly',
                    month,
                    year: parseInt(month.split('-')[0], 10),
                    dueDate: new Date(`${month}-05`),
                    status: 'pending'
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
                skippedUsers
            }
        });
    } catch (error) {
        console.error('Error generating monthly payments:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate monthly payments',
            error: error.message
        });
    }
};
