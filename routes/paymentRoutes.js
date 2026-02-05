// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();

const {
    getAllPayments,
    getMyPayments,
    createPayment,
    verifyPayment,
    getPaymentStats,
    generateMonthlyPayments
} = require('../controllers/paymentController');

const { protect } = require('../middleware/auth');
const { isAdminOrModerator, authorize } = require('../middleware/roleMiddleware');
const { createPaymentValidator, verifyPaymentValidator } = require('../utils/validators');

// User routes
router.get('/my-payments', protect, getMyPayments);
router.post('/', protect, createPaymentValidator, createPayment);

// Management routes
router.get('/', protect, isAdminOrModerator, getAllPayments);
router.get('/stats', protect, isAdminOrModerator, getPaymentStats);
router.put('/:id/verify', protect, isAdminOrModerator, verifyPaymentValidator, verifyPayment);

// Only Admin can generate monthly
router.post('/generate-monthly', protect, authorize('admin'), generateMonthlyPayments);

module.exports = router;
