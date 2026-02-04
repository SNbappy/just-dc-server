const express = require('express');
const router = express.Router();
const {
    initiatePayment,
    paymentSuccess,
    paymentFail,
    paymentCancel,
    paymentIPN,
} = require('../controllers/sslcommerzController');
const { protect } = require('../middleware/auth');

// Initiate payment
router.post('/init', protect, initiatePayment);

// Callback routes (public)
router.post('/success', paymentSuccess);
router.post('/fail', paymentFail);
router.post('/cancel', paymentCancel);
router.post('/ipn', paymentIPN);

module.exports = router;
