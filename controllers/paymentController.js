// controllers/paymentController.js
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
            ? User.findAll({
                where: { id: { [Op.in]: userIds } },
                attributes: ['id', 'name', 'email', 'studentId', 'phone']
            })
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

const isValidMonth = (month) => typeof month === 'string' && /^\d{4}-\d{2}$/.test(month);

// @desc    Get all payments
// @route   GET /api/payments
// @access  Private/Admin/Moderator/President/GS
exports.getAllPayments = async (req, res) => {
    try {
        const { type, status, month, userId, year } = req.query;

        const where = {};
        if (type) where.type = type;
        if (status) where.status = status;
        if (month) where.month = month;
        if (year) where.year = Number(year);
        if (userId) where.userId = Number(userId);

        const payments = await Payment.findAll({
            where,
            order: [['createdAt', 'DESC']]
        });

        const data = await attachPopulate(payments);

        return res.status(200).json({
            success: true,
            count: data.length,
            data
        });
    } catch (error) {
        console.error('Error fetching payments:', error);
        return res.status(500).json({
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

        return res.status(200).json({
            success: true,
            count: data.length,
            data
        });
    } catch (error) {
        console.error('Error fetching user payments:', error);
        return res.status(500).json({
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
        if (amount === undefined || amount === null || !type) {
            return res.status(400).json({
                success: false,
                message: 'Please provide amount and payment type'
            });
        }

        const numericAmount = Number(amount);
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Amount must be a positive number'
            });
        }

        if (!['registration', 'monthly'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment type'
            });
        }

        // Monthly requires a valid month format
        if (type === 'monthly') {
            if (!month || !isValidMonth(month)) {
                return res.status(400).json({
                    success: false,
                    message: 'For monthly payments, month is required in YYYY-MM format'
                });
            }
        }

        // Registration: allow only one active/pending/paid record
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

        // Monthly: prevent duplicates for same month (pending/paid)
        if (type === 'monthly') {
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

        const year = type === 'monthly' ? parseInt(month.split('-')[0], 10) : null;
        const dueDate = type === 'monthly' ? new Date(`${month}-05T00:00:00.000Z`) : null;

        const payment = await Payment.create({
            userId: req.user.id,
            amount: numericAmount,
            type,
            paymentMethod: paymentMethod || null,
            transactionId: transactionId || null,
            month: type === 'monthly' ? month : null,
            year: type === 'monthly' ? year : null,
            dueDate,
            notes: notes || null,
            status: 'pending'
        });

        const data = await attachPopulate(payment);

        return res.status(201).json({
            success: true,
            message: 'Payment submitted successfully. Waiting for verification.',
            data
        });
    } catch (error) {
        console.error('Error creating payment:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create payment',
            error: error.message
        });
    }
};

// @desc    Verify payment
// @route   PUT /api/payments/:id/verify
// @access  Private/Admin/Moderator/President/GS
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

        // Prevent re-verifying already finalized payments
        if (['paid', 'failed', 'refunded'].includes(payment.status)) {
            return res.status(400).json({
                success: false,
                message: `Payment is already finalized as "${payment.status}"`
            });
        }

        await payment.update({
            status,
            verifiedBy: req.user.id,
            verifiedAt: new Date(),
            paidAt: status === 'paid' ? new Date() : null,
            notes: notes !== undefined ? notes : payment.notes
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

        return res.status(200).json({
            success: true,
            message: `Payment ${status === 'paid' ? 'verified' : 'rejected'} successfully`,
            data
        });
    } catch (error) {
        console.error('Error verifying payment:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to verify payment',
            error: error.message
        });
    }
};

// @desc    Get payment statistics
// @route   GET /api/payments/stats
// @access  Private/Admin/Moderator/President/GS
exports.getPaymentStats = async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        const stats = {
            totalRevenue: 0,
            registrationRevenue: 0,
            monthlyRevenue: 0,
            pendingPayments: 0,
            paidThisMonth: 0,
            overduePayments: 0
        };

        // Use DB aggregates (fast)
        const [totalRevenue, registrationRevenue, monthlyRevenue] = await Promise.all([
            Payment.sum('amount', { where: { status: 'paid' } }),
            Payment.sum('amount', { where: { status: 'paid', type: 'registration' } }),
            Payment.sum('amount', { where: { status: 'paid', type: 'monthly' } })
        ]);

        stats.totalRevenue = Number(totalRevenue || 0);
        stats.registrationRevenue = Number(registrationRevenue || 0);
        stats.monthlyRevenue = Number(monthlyRevenue || 0);

        stats.pendingPayments = await Payment.count({ where: { status: 'pending' } });

        // Paid this month based on paidAt (works for both registration + monthly)
        stats.paidThisMonth = await Payment.count({
            where: {
                status: 'paid',
                paidAt: { [Op.gte]: startOfMonth, [Op.lt]: startOfNextMonth }
            }
        });

        stats.overduePayments = await Payment.count({ where: { status: 'overdue' } });

        return res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching payment stats:', error);
        return res.status(500).json({
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

        if (!month || !isValidMonth(month)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide month in YYYY-MM format'
            });
        }

        // Get all approved members
        const members = await User.findAll({
            where: {
                role: { [Op.in]: ['member', 'executive_member', 'general_secretary', 'president', 'moderator', 'admin'] },
                membershipStatus: 'approved',
                isActive: true
            },
            attributes: ['id', 'name']
        });

        const createdPayments = [];
        const skippedUsers = [];

        const year = parseInt(month.split('-')[0], 10);
        const dueDate = new Date(`${month}-05T00:00:00.000Z`);

        for (const member of members) {
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
                    year,
                    dueDate,
                    status: 'pending'
                });
                createdPayments.push(payment);
            } else {
                skippedUsers.push(member.name);
            }
        }

        return res.status(201).json({
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
        return res.status(500).json({
            success: false,
            message: 'Failed to generate monthly payments',
            error: error.message
        });
    }
};
