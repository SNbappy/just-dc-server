const express = require('express');
const router = express.Router();
const {
    getAllPayments,
    getMyPayments,
    createPayment,
    verifyPayment,
    getPaymentStats,
    generateMonthlyPayments,
} = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');
const { isTopManagement, authorize } = require('../middleware/roleMiddleware');

// User routes
router.get('/my-payments', protect, getMyPayments);
router.post('/', protect, createPayment);

// Admin/President/GS routes
router.get('/', protect, isTopManagement, getAllPayments);
router.get('/stats', protect, isTopManagement, getPaymentStats);
router.put('/:id/verify', protect, isTopManagement, verifyPayment);
router.post('/generate-monthly', protect, authorize('admin'), generateMonthlyPayments);

module.exports = router;
