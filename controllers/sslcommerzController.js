const SSLCommerzPayment = require('sslcommerz-lts');
const Payment = require('../models/Payment');
const User = require('../models/User');

const store_id = process.env.SSL_STORE_ID;
const store_passwd = process.env.SSL_STORE_PASSWORD;
const is_live = false; // Set to true for production

// @desc    Initiate SSLCommerz Payment
// @route   POST /api/sslcommerz/init
// @access  Private
exports.initiatePayment = async (req, res) => {
    try {
        const { amount, type, month } = req.body;

        // Validation
        if (!amount || !type) {
            return res.status(400).json({
                success: false,
                message: 'Please provide amount and payment type',
            });
        }

        // Validate amount
        if (type === 'registration' && amount !== 150) {
            return res.status(400).json({
                success: false,
                message: 'Registration fee must be 150 BDT',
            });
        }

        if (type === 'monthly' && amount !== 30) {
            return res.status(400).json({
                success: false,
                message: 'Monthly fee must be 30 BDT',
            });
        }

        // Check if payment already exists
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

        // Create payment record
        const payment = await Payment.create({
            user: req.user.id,
            amount,
            type,
            paymentMethod: 'sslcommerz',
            month: type === 'monthly' ? month : undefined,
            year: type === 'monthly' && month ? parseInt(month.split('-')[0]) : undefined,
            status: 'pending',
        });

        // Get user details
        const user = await User.findById(req.user.id);

        // Generate transaction ID
        const tran_id = `${type.toUpperCase()}-${payment._id}`;

        // SSLCommerz payment data
        const data = {
            total_amount: amount,
            currency: 'BDT',
            tran_id: tran_id,
            success_url: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/sslcommerz/success`,
            fail_url: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/sslcommerz/fail`,
            cancel_url: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/sslcommerz/cancel`,
            ipn_url: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/sslcommerz/ipn`,
            shipping_method: 'NO',
            product_name: type === 'registration' ? 'Club Registration Fee' : 'Monthly Club Fee',
            product_category: 'Service',
            product_profile: 'non-physical-goods',
            cus_name: user.name,
            cus_email: user.email,
            cus_add1: 'Jashore',
            cus_city: 'Jashore',
            cus_postcode: '7408',
            cus_country: 'Bangladesh',
            cus_phone: user.phone || '01700000000',
            ship_name: user.name,
            ship_add1: 'Jashore',
            ship_city: 'Jashore',
            ship_postcode: '7408',
            ship_country: 'Bangladesh',
        };

        // Initialize SSLCommerz
        const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
        const apiResponse = await sslcz.init(data);

        // Update payment with transaction ID
        payment.transactionId = tran_id;
        await payment.save();

        // Return gateway URL
        res.status(200).json({
            success: true,
            message: 'Payment initiated successfully',
            data: {
                paymentUrl: apiResponse.GatewayPageURL,
                transactionId: tran_id,
                paymentId: payment._id,
            },
        });
    } catch (error) {
        console.error('Error initiating payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to initiate payment',
            error: error.message,
        });
    }
};

// @desc    Payment Success Callback
// @route   POST /api/sslcommerz/success
// @access  Public
exports.paymentSuccess = async (req, res) => {
    try {
        const { tran_id, val_id } = req.body;

        // Validate payment with SSLCommerz
        const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
        const validation = await sslcz.validate({ val_id });

        if (validation.status === 'VALID' || validation.status === 'VALIDATED') {
            // Find payment by transaction ID
            const payment = await Payment.findOne({ transactionId: tran_id });

            if (!payment) {
                return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-failed`);
            }

            // Update payment status
            payment.status = 'paid';
            payment.paidAt = new Date();
            payment.notes = `Validated: ${val_id}`;
            await payment.save();

            // Update user payment status
            const user = await User.findById(payment.user);

            if (payment.type === 'registration') {
                user.registrationFeePaid = true;
                user.registrationPaymentDate = new Date();
            } else if (payment.type === 'monthly') {
                user.lastMonthlyPayment = new Date();
                user.monthlyFeeStatus = 'current';
            }

            await user.save();

            // Redirect to success page
            res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-success?tran_id=${tran_id}`);
        } else {
            res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-failed`);
        }
    } catch (error) {
        console.error('Payment success error:', error);
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-failed`);
    }
};

// @desc    Payment Fail Callback
// @route   POST /api/sslcommerz/fail
// @access  Public
exports.paymentFail = async (req, res) => {
    try {
        const { tran_id } = req.body;

        // Update payment status
        const payment = await Payment.findOne({ transactionId: tran_id });
        if (payment) {
            payment.status = 'failed';
            await payment.save();
        }

        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-failed`);
    } catch (error) {
        console.error('Payment fail error:', error);
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-failed`);
    }
};

// @desc    Payment Cancel Callback
// @route   POST /api/sslcommerz/cancel
// @access  Public
exports.paymentCancel = async (req, res) => {
    try {
        const { tran_id } = req.body;

        // Update payment status
        const payment = await Payment.findOne({ transactionId: tran_id });
        if (payment) {
            payment.status = 'failed';
            payment.notes = 'Payment cancelled by user';
            await payment.save();
        }

        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-cancelled`);
    } catch (error) {
        console.error('Payment cancel error:', error);
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-failed`);
    }
};

// @desc    Payment IPN (Instant Payment Notification)
// @route   POST /api/sslcommerz/ipn
// @access  Public
exports.paymentIPN = async (req, res) => {
    try {
        const { tran_id, status } = req.body;

        if (status === 'VALID' || status === 'VALIDATED') {
            const payment = await Payment.findOne({ transactionId: tran_id });
            if (payment && payment.status === 'pending') {
                payment.status = 'paid';
                payment.paidAt = new Date();
                await payment.save();
            }
        }

        res.status(200).send('IPN received');
    } catch (error) {
        console.error('IPN error:', error);
        res.status(500).send('IPN error');
    }
};
