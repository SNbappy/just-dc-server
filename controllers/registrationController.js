// controllers/registrationController.js
const Event = require('../models/Event');
const EventRegistration = require('../models/EventRegistration');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { sendEmail, templates } = require('../services/emailService');
const { generateRegistrationReceipt } = require('../services/pdfService');
const { initPayment } = require('../services/sslcommerzService');
const jwt = require('jsonwebtoken');

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Generate unique registration ID
 */
const generateRegistrationId = () => {
    return `REG-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
};

/**
 * Generate verification token for guest tracking
 */
const generateVerificationToken = (registrationId, email, eventId) => {
    return jwt.sign(
        { registrationId, email, eventId },
        process.env.JWT_SECRET,
        { expiresIn: '90d' } // 90 days validity
    );
};

/**
 * Normalize email
 */
const normalizeEmail = (email) => String(email || '').toLowerCase().trim();

/**
 * Check if user has access to category
 */
const checkCategoryAccess = (category, user) => {
    const accessType = category.accessControl?.type || 'public';

    if (accessType === 'public') {
        return { hasAccess: true };
    }

    if (!user) {
        return {
            hasAccess: false,
            message: 'This category requires login. Please login to register.'
        };
    }

    if (accessType === 'members_only') {
        const allowedRoles = ['member', 'admin', 'moderator', 'president', 'general_secretary', 'executive_member'];
        if (!allowedRoles.includes(user.role)) {
            return {
                hasAccess: false,
                message: 'This category is for club members only.'
            };
        }
    }

    if (accessType === 'executive_only') {
        const allowedRoles = ['admin', 'moderator', 'president', 'general_secretary', 'executive_member'];
        if (!allowedRoles.includes(user.role)) {
            return {
                hasAccess: false,
                message: 'This category is for executive committee members only.'
            };
        }
    }

    if (accessType === 'custom') {
        const allowedRoles = category.accessControl?.allowedRoles || [];
        if (!allowedRoles.includes(user.role)) {
            return {
                hasAccess: false,
                message: 'You do not have access to this category.'
            };
        }
    }

    return { hasAccess: true };
};

// =====================================================
// PUBLIC REGISTRATION
// =====================================================

/**
 * @desc    Get available registration categories for an event
 * @route   GET /api/registrations/events/:eventId/categories
 * @access  Public
 */
exports.getRegistrationCategories = async (req, res) => {
    try {
        const { eventId } = req.params;

        console.log('📋 Fetching categories for event ID:', eventId);

        const event = await Event.findByPk(eventId);

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        if (!event.registrationEnabled) {
            return res.status(400).json({
                success: false,
                message: 'Registration is not enabled for this event'
            });
        }

        const categories = event.registrationCategories?.categories || [];

        console.log('✅ Returning', categories.length, 'categories');

        // Filter categories based on user access
        const availableCategories = categories.map(category => {
            const accessCheck = checkCategoryAccess(category, req.user);

            return {
                ...category,
                hasAccess: accessCheck.hasAccess,
                accessMessage: accessCheck.message || null,
                isOpen: new Date() >= new Date(category.registrationPeriod?.opensAt || event.createdAt) &&
                    new Date() <= new Date(category.registrationPeriod?.closesAt || event.registrationDeadline || event.date),
                isFull: category.capacity?.max > 0 && category.capacity?.current >= category.capacity?.max
            };
        });

        return res.json({
            success: true,
            data: {
                event: {
                    id: event.id,
                    title: event.title,
                    date: event.date,
                    time: event.time,
                    location: event.location
                },
                categories: availableCategories
            }
        });

    } catch (error) {
        console.error('❌ Error fetching registration categories:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * @desc    Register for event (specific category)
 * @route   POST /api/registrations/events/:eventId/categories/:categoryId
 * @access  Public (with optionalAuth middleware)
 */
exports.registerForEvent = async (req, res) => {
    try {
        const { eventId, categoryId } = req.params;
        const {
            name,
            email,
            phone,
            studentId,
            department,
            batch,
            organization,
            teamName,
            teamMembers,
            customFields
        } = req.body;

        console.log('📝 New registration for event', eventId, ', category', categoryId);

        // Find event
        const event = await Event.findByPk(eventId);

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        if (!event.registrationEnabled) {
            return res.status(400).json({
                success: false,
                message: 'Registration is not enabled for this event'
            });
        }

        // Find category
        const categories = event.registrationCategories?.categories || [];
        const category = categories.find(c => c.id === categoryId);

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Registration category not found'
            });
        }

        // Check access
        const accessCheck = checkCategoryAccess(category, req.user);
        if (!accessCheck.hasAccess) {
            return res.status(403).json({
                success: false,
                message: accessCheck.message
            });
        }

        // Check if registration is open
        const now = new Date();
        const opensAt = new Date(category.registrationPeriod?.opensAt || event.createdAt);
        const closesAt = new Date(category.registrationPeriod?.closesAt || event.registrationDeadline || event.date);

        if (now < opensAt) {
            return res.status(400).json({
                success: false,
                message: 'Registration has not opened yet'
            });
        }

        if (now > closesAt) {
            return res.status(400).json({
                success: false,
                message: 'Registration has closed'
            });
        }

        // Check capacity
        if (category.capacity?.max > 0 && category.capacity?.current >= category.capacity?.max) {
            return res.status(400).json({
                success: false,
                message: 'This category is full'
            });
        }

        // Determine registration details
        const isGuest = !req.user;
        const registrationType = category.type; // 'individual' or 'team'

        let primaryName, primaryEmail, primaryPhone;

        if (isGuest) {
            primaryName = name;
            primaryEmail = normalizeEmail(email);
            primaryPhone = phone;
        } else {
            primaryName = req.user.name;
            primaryEmail = normalizeEmail(req.user.email);
            primaryPhone = req.user.phone || phone;
        }

        // Validation
        if (!primaryName || !primaryEmail || !primaryPhone) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, and phone are required'
            });
        }

        // ✅ FIXED: Check for duplicate registration (without categoryId)
        const existingRegistration = await EventRegistration.findOne({
            where: {
                eventId: event.id,
                ...(req.user ? { userId: req.user.id } : { email: primaryEmail })
            }
        });

        if (existingRegistration) {
            return res.status(400).json({
                success: false,
                message: 'You are already registered for this event. Each email can only register once per event.'
            });
        }

        // Calculate fee
        let totalAmount = 0;
        if (!category.pricing?.isFree) {
            if (registrationType === 'team') {
                const teamSize = 1 + (teamMembers?.length || 0);
                if (category.pricing?.type === 'per_person') {
                    totalAmount = (category.pricing?.amount || 0) * teamSize;
                } else {
                    totalAmount = category.pricing?.amount || 0;
                }
            } else {
                totalAmount = category.pricing?.amount || 0;
            }
        }

        // Generate registration ID and verification token
        const registrationId = generateRegistrationId();
        const verificationToken = isGuest ? generateVerificationToken(registrationId, primaryEmail, eventId) : null;

        // Create registration
        const registration = await EventRegistration.create({
            registrationId,
            eventId: event.id,
            userId: req.user ? req.user.id : null,
            categoryId: category.id,
            categoryName: category.name,
            source: 'public',
            registrationType,
            type: isGuest ? 'guest' : 'internal',
            name: primaryName,
            email: primaryEmail,
            phone: primaryPhone,
            studentId: studentId || (req.user?.studentId || null),
            department: department || (req.user?.department || null),
            batch: batch || (req.user?.batch || null),
            organization,
            teamName: registrationType === 'team' ? teamName : null,
            teamMembers: registrationType === 'team' ? teamMembers : null,
            customFieldsData: customFields || null,
            amount: totalAmount,
            status: totalAmount > 0 ? 'pending_payment' : 'confirmed',
            verificationToken
        });

        console.log('✅ Registration created:', registration.id);

        // Update category capacity
        category.capacity.current += 1;
        await event.update({ registrationCategories: event.registrationCategories });

        // Handle payment or confirmation
        if (totalAmount > 0) {
            // Create payment record
            const transactionId = `TXN-${Date.now()}`;

            const payment = await Payment.create({
                userId: req.user ? req.user.id : null,
                payerName: primaryName,
                payerEmail: primaryEmail,
                amount: totalAmount,
                type: 'event',
                status: 'pending',
                eventId: event.id,
                eventRegistrationId: registration.id,
                transactionId,
                notes: `${category.name} - ${event.title}`
            });

            await registration.update({ paymentId: payment.id });

            // Initialize SSLCommerz payment
            try {
                const paymentInit = await initPayment({
                    amount: totalAmount,
                    transactionId,
                    customerName: primaryName,
                    customerEmail: primaryEmail,
                    customerPhone: primaryPhone,
                    productName: `${event.title} - ${category.name}`,
                    registrationId: registration.registrationId,
                    eventId: event.id,
                    userId: req.user ? req.user.id : 'guest'
                });

                // Send pending payment email
                const emailTemplate = templates.registrationPendingPayment(
                    registration,
                    event,
                    paymentInit.gatewayUrl
                );

                await sendEmail({
                    to: primaryEmail,
                    subject: emailTemplate.subject,
                    html: emailTemplate.html
                });

                console.log('✅ Payment initiated, email sent');

                return res.status(201).json({
                    success: true,
                    message: 'Registration successful! Please complete payment.',
                    data: {
                        registration: {
                            id: registration.id,
                            registrationId: registration.registrationId,
                            status: registration.status,
                            amount: totalAmount,
                            verificationToken
                        },
                        payment: {
                            transactionId,
                            amount: totalAmount,
                            gatewayUrl: paymentInit.gatewayUrl
                        }
                    }
                });

            } catch (paymentError) {
                console.error('❌ Payment initialization failed:', paymentError);

                // Still return success but with manual payment instructions
                const emailTemplate = templates.registrationPendingPayment(
                    registration,
                    event,
                    `${process.env.CLIENT_URL}/payments/${payment.id}`
                );

                await sendEmail({
                    to: primaryEmail,
                    subject: emailTemplate.subject,
                    html: emailTemplate.html
                });

                return res.status(201).json({
                    success: true,
                    message: 'Registration successful! Payment gateway temporarily unavailable. Please try again.',
                    data: {
                        registration: {
                            id: registration.id,
                            registrationId: registration.registrationId,
                            status: registration.status,
                            amount: totalAmount,
                            verificationToken
                        },
                        payment: {
                            id: payment.id,
                            transactionId,
                            amount: totalAmount,
                            manualPayment: true
                        }
                    }
                });
            }

        } else {
            // Free event - generate PDF and send confirmation
            try {
                const pdfResult = await generateRegistrationReceipt({
                    registration,
                    event,
                    payment: null
                });

                await registration.update({
                    pdfReceiptUrl: pdfResult.url
                });

                const emailTemplate = templates.registrationConfirmationFree(registration, event);

                await sendEmail({
                    to: primaryEmail,
                    subject: emailTemplate.subject,
                    html: emailTemplate.html,
                    attachments: [{
                        filename: pdfResult.filename,
                        path: pdfResult.filepath
                    }]
                });

                console.log('✅ Free registration confirmed, PDF sent');

                return res.status(201).json({
                    success: true,
                    message: 'Registration confirmed! Check your email for receipt.',
                    data: {
                        registration: {
                            id: registration.id,
                            registrationId: registration.registrationId,
                            status: registration.status,
                            pdfReceiptUrl: pdfResult.url,
                            verificationToken
                        }
                    }
                });

            } catch (pdfError) {
                console.error('❌ PDF generation failed:', pdfError);

                // Still send email without PDF
                const emailTemplate = templates.registrationConfirmationFree(registration, event);
                await sendEmail({
                    to: primaryEmail,
                    subject: emailTemplate.subject,
                    html: emailTemplate.html
                });

                return res.status(201).json({
                    success: true,
                    message: 'Registration confirmed! Check your email.',
                    data: {
                        registration: {
                            id: registration.id,
                            registrationId: registration.registrationId,
                            status: registration.status,
                            verificationToken
                        }
                    }
                });
            }
        }

    } catch (error) {
        console.error('❌ Error creating registration:', error);

        // ✅ FIXED: Handle duplicate registration error properly
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({
                success: false,
                message: 'You are already registered for this event. Please check your email for confirmation details or use a different email address.'
            });
        }

        // ✅ Handle validation errors
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                success: false,
                message: error.errors[0]?.message || 'Validation error'
            });
        }

        // Handle other errors
        return res.status(500).json({
            success: false,
            message: 'Registration failed. Please try again.',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
        });
    }
};

/**
 * @desc    Track guest registration (via verification token)
 * @route   GET /api/registrations/track
 * @access  Public
 */
exports.trackRegistration = async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Verification token is required'
            });
        }

        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }

        // Find registration
        const registration = await EventRegistration.findOne({
            where: {
                registrationId: decoded.registrationId,
                eventId: decoded.eventId
            },
            include: [
                {
                    model: Event,
                    as: 'event',
                    attributes: ['id', 'title', 'date', 'time', 'location', 'image']
                },
                {
                    model: Payment,
                    as: 'payment',
                    attributes: ['id', 'amount', 'status', 'transactionId', 'paymentMethod', 'paidAt']
                }
            ]
        });

        if (!registration) {
            return res.status(404).json({
                success: false,
                message: 'Registration not found'
            });
        }

        return res.json({
            success: true,
            data: registration
        });

    } catch (error) {
        console.error('❌ Error tracking registration:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * @desc    Get my registrations (logged-in user)
 * @route   GET /api/registrations/my-registrations
 * @access  Private
 */
exports.getMyRegistrations = async (req, res) => {
    try {
        const registrations = await EventRegistration.findAll({
            where: { userId: req.user.id },
            include: [
                {
                    model: Event,
                    as: 'event',
                    attributes: ['id', 'title', 'date', 'time', 'location', 'image']
                },
                {
                    model: Payment,
                    as: 'payment',
                    attributes: ['id', 'amount', 'status', 'transactionId', 'paidAt']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        return res.json({
            success: true,
            count: registrations.length,
            data: registrations
        });

    } catch (error) {
        console.error('❌ Error fetching registrations:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * @desc    Cancel registration
 * @route   DELETE /api/registrations/:registrationId
 * @access  Private or Public (with token)
 */
exports.cancelRegistration = async (req, res) => {
    try {
        const { registrationId } = req.params;
        const { token } = req.query;

        let registration;

        // Check if user is logged in
        if (req.user) {
            registration = await EventRegistration.findOne({
                where: {
                    registrationId,
                    userId: req.user.id
                }
            });
        } else if (token) {
            // Guest with verification token
            let decoded;
            try {
                decoded = jwt.verify(token, process.env.JWT_SECRET);
            } catch (err) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid or expired token'
                });
            }

            registration = await EventRegistration.findOne({
                where: {
                    registrationId: decoded.registrationId
                }
            });
        } else {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        if (!registration) {
            return res.status(404).json({
                success: false,
                message: 'Registration not found'
            });
        }

        if (registration.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Registration is already cancelled'
            });
        }

        // Update registration status
        await registration.update({ 
            status: 'cancelled',
            cancelledAt: new Date()
        });

        // Update category capacity
        const event = await Event.findByPk(registration.eventId);
        if (event && event.registrationCategories) {
            const categories = event.registrationCategories.categories || [];
            const category = categories.find(c => c.id === registration.categoryId);
            if (category && category.capacity) {
                category.capacity.current = Math.max(0, category.capacity.current - 1);
                await event.update({ registrationCategories: event.registrationCategories });
            }
        }

        console.log('✅ Registration cancelled:', registrationId);

        return res.json({
            success: true,
            message: 'Registration cancelled successfully',
            data: registration
        });

    } catch (error) {
        console.error('❌ Error cancelling registration:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

module.exports = exports;
