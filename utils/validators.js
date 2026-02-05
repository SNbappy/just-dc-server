// utils/validators.js
const { body } = require('express-validator');

exports.registerValidator = [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];

exports.loginValidator = [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required')
];

exports.eventValidator = [
    body('title').trim().notEmpty().withMessage('Event title is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('date').isISO8601().withMessage('Valid date is required'),
    body('time').trim().notEmpty().withMessage('Time is required'),
    body('location').trim().notEmpty().withMessage('Location is required')
];

// ✅ Payment create validator
exports.createPaymentValidator = [
    body('amount')
        .notEmpty()
        .withMessage('Amount is required')
        .bail()
        .isNumeric()
        .withMessage('Amount must be a number')
        .bail()
        .custom((v) => Number(v) > 0)
        .withMessage('Amount must be greater than 0'),

    body('type')
        .notEmpty()
        .withMessage('Payment type is required')
        .bail()
        .isIn(['registration', 'monthly'])
        .withMessage('Invalid payment type'),

    body('month')
        .optional()
        .custom((value, { req }) => {
            if (req.body.type === 'monthly') {
                if (!value || !/^\d{4}-\d{2}$/.test(value)) {
                    throw new Error('For monthly payments, month is required in YYYY-MM format');
                }
            }
            return true;
        })
];

// ✅ Payment verify validator
exports.verifyPaymentValidator = [
    body('status')
        .notEmpty()
        .withMessage('Status is required')
        .bail()
        .isIn(['paid', 'failed'])
        .withMessage('Status must be "paid" or "failed"')
];
