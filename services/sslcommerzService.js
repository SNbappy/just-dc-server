// services/sslcommerzService.js
const SSLCommerzPayment = require('sslcommerz-lts');
const Payment = require('../models/Payment');
const EventRegistration = require('../models/EventRegistration');
const Event = require('../models/Event');
const { sendEmail, templates } = require('./emailService');
const { generateRegistrationReceipt } = require('./pdfService');

const store_id = process.env.SSL_STORE_ID || process.env.SSLCOMMERZ_STORE_ID;
const store_passwd = process.env.SSL_STORE_PASSWORD || process.env.SSLCOMMERZ_STORE_PASSWORD;
const is_live = process.env.NODE_ENV === 'production'; // true for live, false for sandbox

/**
 * Initialize SSLCommerz payment
 * @param {Object} paymentData - Payment initialization data
 * @returns {Promise<Object>} - Payment gateway URL and session
 */
exports.initPayment = async (paymentData) => {
    const {
        amount,
        transactionId,
        customerName,
        customerEmail,
        customerPhone,
        productName,
        registrationId = '',
        eventId = '',
        userId = ''
    } = paymentData;

    const serverUrl = process.env.SERVER_URL || process.env.BACKEND_URL || 'http://localhost:5000';

    const data = {
        total_amount: parseFloat(amount),
        currency: 'BDT',
        tran_id: transactionId, // use unique tran_id for each api call
        success_url: `${serverUrl}/api/sslcommerz/success`,
        fail_url: `${serverUrl}/api/sslcommerz/fail`,
        cancel_url: `${serverUrl}/api/sslcommerz/cancel`,
        ipn_url: `${serverUrl}/api/sslcommerz/ipn`,
        shipping_method: 'NO',
        product_name: productName,
        product_category: 'Event Registration',
        product_profile: 'general',
        cus_name: customerName,
        cus_email: customerEmail,
        cus_add1: 'Dhaka',
        cus_add2: 'Bangladesh',
        cus_city: 'Dhaka',
        cus_state: 'Dhaka',
        cus_postcode: '1000',
        cus_country: 'Bangladesh',
        cus_phone: customerPhone,
        cus_fax: customerPhone,
        ship_name: customerName,
        ship_add1: 'Dhaka',
        ship_add2: 'Bangladesh',
        ship_city: 'Dhaka',
        ship_state: 'Dhaka',
        ship_postcode: 1000,
        ship_country: 'Bangladesh',
        value_a: registrationId, // Registration ID
        value_b: eventId, // Event ID
        value_c: userId || 'guest', // User ID or 'guest'
        multi_card_name: 'mastercard,visacard,amexcard,bkash,nagad,rocket',
    };

    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);

    try {
        const apiResponse = await sslcz.init(data);

        console.log('✅ SSLCommerz Init Response:', {
            status: apiResponse.status,
            sessionkey: apiResponse.sessionkey,
            GatewayPageURL: apiResponse.GatewayPageURL
        });

        if (apiResponse.status === 'SUCCESS') {
            return {
                success: true,
                gatewayUrl: apiResponse.GatewayPageURL,
                sessionKey: apiResponse.sessionkey,
                transactionId: transactionId
            };
        } else {
            throw new Error(apiResponse.failedreason || 'Payment initialization failed');
        }
    } catch (error) {
        console.error('❌ SSLCommerz Init Error:', error);
        throw error;
    }
};

/**
 * Validate payment with SSLCommerz
 * @param {string} val_id - Validation ID from SSLCommerz
 * @returns {Promise<Object>} - Validation response
 */
exports.validatePayment = async (val_id) => {
    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);

    try {
        const validation = await sslcz.validate({ val_id });

        console.log('✅ SSLCommerz Validation Response:', {
            status: validation.status,
            tran_id: validation.tran_id,
            amount: validation.amount
        });

        return validation;
    } catch (error) {
        console.error('❌ SSLCommerz Validation Error:', error);
        throw error;
    }
};

/**
 * Handle successful payment
 * @param {Object} paymentData - Payment data from SSLCommerz
 */
exports.handleSuccess = async (paymentData) => {
    const {
        tran_id,
        val_id,
        amount,
        card_type,
        card_brand,
        bank_tran_id,
        value_a: registrationId,
        value_b: eventId,
        value_c: userId
    } = paymentData;

    try {
        // Validate with SSLCommerz
        const validation = await exports.validatePayment(val_id);

        if (validation.status !== 'VALID' && validation.status !== 'VALIDATED') {
            throw new Error('Payment validation failed');
        }

        // Find payment record
        const payment = await Payment.findOne({
            where: { transactionId: tran_id }
        });

        if (!payment) {
            throw new Error('Payment record not found');
        }

        // Update payment
        await payment.update({
            status: 'completed',
            paymentMethod: card_type || 'sslcommerz',
            paidAt: new Date(),
            notes: `Bank TXN: ${bank_tran_id}, Card: ${card_brand}`,
        });

        // Update registration status
        const registration = await EventRegistration.findOne({
            where: { registrationId: registrationId },
            include: [{ model: Event, as: 'event' }]
        });

        if (registration) {
            await registration.update({
                status: 'confirmed',
                confirmedAt: new Date(),
                paymentId: payment.id
            });

            // Generate PDF receipt
            try {
                const pdfResult = await generateRegistrationReceipt({
                    registration,
                    event: registration.event,
                    payment
                });

                await registration.update({
                    pdfReceiptUrl: pdfResult.url
                });

                // Send confirmation email
                const emailTemplate = templates.registrationConfirmation(
                    registration,
                    registration.event,
                    payment
                );

                await sendEmail({
                    to: registration.email,
                    subject: emailTemplate.subject,
                    html: emailTemplate.html,
                    attachments: [{
                        filename: pdfResult.filename,
                        path: pdfResult.filepath
                    }]
                });

                console.log('✅ Payment confirmed, PDF & email sent:', registrationId);
            } catch (error) {
                console.error('❌ PDF/Email error (payment still successful):', error);
            }
        }

        return {
            success: true,
            payment,
            registration
        };

    } catch (error) {
        console.error('❌ Error handling successful payment:', error);
        throw error;
    }
};

/**
 * Handle failed payment
 */
exports.handleFailure = async (paymentData) => {
    const { tran_id, value_a: registrationId } = paymentData;

    try {
        const payment = await Payment.findOne({
            where: { transactionId: tran_id }
        });

        if (payment) {
            await payment.update({
                status: 'failed',
                notes: 'Payment failed via SSLCommerz'
            });

            console.log('❌ Payment failed:', tran_id);
        }

        return { success: false, payment };
    } catch (error) {
        console.error('❌ Error handling failed payment:', error);
        throw error;
    }
};

/**
 * Handle cancelled payment
 */
exports.handleCancel = async (paymentData) => {
    const { tran_id } = paymentData;

    try {
        const payment = await Payment.findOne({
            where: { transactionId: tran_id }
        });

        if (payment) {
            await payment.update({
                status: 'cancelled',
                notes: 'Payment cancelled by user'
            });

            console.log('⚠️ Payment cancelled:', tran_id);
        }

        return { success: false, payment };
    } catch (error) {
        console.error('❌ Error handling cancelled payment:', error);
        throw error;
    }
};

/**
 * Initiate refund
 * @param {Object} refundData - Refund data
 */
exports.initiateRefund = async (refundData) => {
    const { bank_tran_id, refund_amount, refund_remarks } = refundData;

    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);

    try {
        const refund = await sslcz.initiateRefund({
            refund_amount,
            refund_remarks,
            bank_tran_id,
            refe_id: `REFUND-${Date.now()}`
        });

        console.log('✅ Refund initiated:', refund);

        return refund;
    } catch (error) {
        console.error('❌ Refund Error:', error);
        throw error;
    }
};

/**
 * Query refund status
 */
exports.queryRefundStatus = async (refund_ref_id) => {
    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);

    try {
        const status = await sslcz.refundQuery({ refund_ref_id });

        console.log('✅ Refund Status:', status);

        return status;
    } catch (error) {
        console.error('❌ Refund Query Error:', error);
        throw error;
    }
};

/**
 * Query transaction status
 */
exports.queryTransaction = async (tran_id) => {
    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);

    try {
        const transaction = await sslcz.transactionQueryByTransactionId({ tran_id });

        console.log('✅ Transaction Query:', transaction);

        return transaction;
    } catch (error) {
        console.error('❌ Transaction Query Error:', error);
        throw error;
    }
};

module.exports = exports;
