// routes/sslcommerzRoutes.js
const express = require('express');
const router = express.Router();

// SSLCommerz callback routes
router.post('/success', async (req, res) => {
    try {
        console.log('✅ SSLCommerz Success Callback', req.body);
        // TODO: Update payment status to 'completed'
        return res.redirect(`${process.env.CLIENT_URL}/payment/success`);
    } catch (error) {
        console.error('Error in success callback:', error);
        return res.redirect(`${process.env.CLIENT_URL}/payment/failed`);
    }
});

router.post('/fail', async (req, res) => {
    try {
        console.log('❌ SSLCommerz Failure Callback', req.body);
        // TODO: Update payment status to 'failed'
        return res.redirect(`${process.env.CLIENT_URL}/payment/failed`);
    } catch (error) {
        console.error('Error in fail callback:', error);
        return res.redirect(`${process.env.CLIENT_URL}/payment/failed`);
    }
});

router.post('/cancel', async (req, res) => {
    try {
        console.log('⚠️ SSLCommerz Cancel Callback', req.body);
        // TODO: Update payment status to 'cancelled'
        return res.redirect(`${process.env.CLIENT_URL}/payment/cancelled`);
    } catch (error) {
        console.error('Error in cancel callback:', error);
        return res.redirect(`${process.env.CLIENT_URL}/payment/cancelled`);
    }
});

router.post('/ipn', async (req, res) => {
    try {
        console.log('🔔 SSLCommerz IPN Callback', req.body);
        // TODO: Validate and update payment status
        return res.status(200).send('IPN received');
    } catch (error) {
        console.error('Error in IPN callback:', error);
        return res.status(500).send('IPN processing failed');
    }
});

module.exports = router;
