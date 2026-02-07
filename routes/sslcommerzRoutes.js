// routes/sslcommerzRoutes.js
const express = require('express');
const router = express.Router();
const { Payment, EventRegistration, Event } = require('../models');
const { sendEmail, templates } = require('../services/emailService');
const { generateRegistrationReceipt } = require('../services/pdfService');

// ✅ SUCCESS CALLBACK
// ✅ SUCCESS CALLBACK (UPDATED FOR EVENT PAYMENTS)
router.post('/success', async (req, res) => {
    try {
        const { tran_id, val_id, amount, card_type, value_a, value_b, value_c } = req.body;

        console.log('✅ SSLCommerz Success Callback:', { tran_id, val_id, amount });

        // Find payment
        const payment = await Payment.findOne({ where: { transactionId: tran_id } });

        if (!payment) {
            console.error('❌ Payment not found:', tran_id);
            return res.redirect(`${process.env.CLIENT_URL}/payment-failed?error=payment_not_found`);
        }

        // Update payment status
        payment.status = 'paid';
        payment.paymentMethod = card_type || 'sslcommerz';
        payment.paidAt = new Date();
        payment.notes = `Validated: ${val_id}`;
        await payment.save();

        console.log('✅ Payment marked as paid:', payment.id);

        // ✅ HANDLE EVENT REGISTRATION PAYMENT
        if (payment.type === 'event' && payment.eventRegistrationId) {
            const registration = await EventRegistration.findByPk(payment.eventRegistrationId, {
                include: [{ model: Event, as: 'event' }]
            });

            if (registration) {
                // Update registration status
                registration.status = 'confirmed';
                registration.confirmedAt = new Date();
                await registration.save();

                console.log('✅ Registration confirmed:', registration.registrationId);

                // TODO: Generate PDF receipt and send email
                try {
                    const { sendEmail, templates } = require('../services/emailService');

                    const emailTemplate = templates.registrationConfirmation(
                        registration,
                        registration.event,
                        payment
                    );

                    await sendEmail({
                        to: registration.email,
                        subject: emailTemplate.subject,
                        html: emailTemplate.html
                    });

                    console.log('✅ Confirmation email sent');
                } catch (emailError) {
                    console.error('❌ Email error:', emailError);
                }

                return res.redirect(
                    `${process.env.CLIENT_URL}/payment-success?registration=${registration.registrationId}&type=event`
                );
            }
        }

        // ✅ HANDLE MEMBERSHIP PAYMENT (existing logic)
        return res.redirect(`${process.env.CLIENT_URL}/payment-success?transaction=${tran_id}`);

    } catch (error) {
        console.error('❌ Error in success callback:', error);
        return res.redirect(`${process.env.CLIENT_URL}/payment-failed?error=processing_error`);
    }
});


// ✅ FAIL CALLBACK
router.post('/fail', async (req, res) => {
    try {
        const { tran_id } = req.body;

        console.log('❌ SSLCommerz Failure Callback:', req.body);

        const payment = await Payment.findOne({ where: { transactionId: tran_id } });

        if (payment) {
            payment.status = 'failed';
            await payment.save();

            // Update registration
            const registration = await EventRegistration.findOne({
                where: { paymentId: payment.id }
            });

            if (registration) {
                registration.status = 'pending_payment';
                await registration.save();
            }
        }

        return res.redirect(`${process.env.CLIENT_URL}/payment/failed?transaction=${tran_id}`);
    } catch (error) {
        console.error('❌ Error in fail callback:', error);
        return res.redirect(`${process.env.CLIENT_URL}/payment/failed?error=unknown`);
    }
});

// ✅ CANCEL CALLBACK
router.post('/cancel', async (req, res) => {
    try {
        const { tran_id } = req.body;

        console.log('⚠️ SSLCommerz Cancel Callback:', req.body);

        const payment = await Payment.findOne({ where: { transactionId: tran_id } });

        if (payment) {
            payment.status = 'cancelled';
            await payment.save();
        }

        return res.redirect(`${process.env.CLIENT_URL}/payment/cancelled?transaction=${tran_id}`);
    } catch (error) {
        console.error('❌ Error in cancel callback:', error);
        return res.redirect(`${process.env.CLIENT_URL}/payment/cancelled?error=unknown`);
    }
});

// ✅ IPN CALLBACK (Instant Payment Notification)
router.post('/ipn', async (req, res) => {
    try {
        console.log('🔔 SSLCommerz IPN Callback:', req.body);

        const { tran_id, val_id, amount, status } = req.body;

        // Validate and update payment
        const payment = await Payment.findOne({ where: { transactionId: tran_id } });

        if (payment && status === 'VALID') {
            payment.status = 'completed';
            payment.paidAt = new Date();
            await payment.save();

            console.log('✅ IPN processed successfully');
        }

        return res.status(200).send('IPN received');
    } catch (error) {
        console.error('❌ Error in IPN callback:', error);
        return res.status(500).send('IPN processing failed');
    }
});

module.exports = router;
