// routes/registrationRoutes.js
const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middleware/auth');
const EventRegistration = require('../models/EventRegistration');
const Event = require('../models/Event');
const User = require('../models/User');

// ✅ 1. MOST SPECIFIC ROUTES FIRST - Categories
router.get('/events/:eventId/categories', async (req, res) => {
    try {
        const { eventId } = req.params;

        console.log(`📋 Fetching categories for event ID: ${eventId}`);

        const event = await Event.findByPk(eventId);

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        let categories = event.categories;
        if (typeof categories === 'string') {
            try {
                categories = JSON.parse(categories);
            } catch (e) {
                console.error('Failed to parse categories:', e);
                categories = [];
            }
        }

        if (!Array.isArray(categories)) {
            categories = [];
        }

        const formattedCategories = categories.map((cat, index) => {
            const current = 0;

            return {
                id: index + 1,
                name: cat.name,
                description: cat.description || '',
                type: cat.type || 'individual',
                pricing: {
                    isFree: cat.price === 0,
                    amount: cat.price || 0
                },
                capacity: {
                    max: cat.capacity || 0,
                    current: current
                },
                teamSize: cat.type === 'team' ? {
                    min: cat.teamMin || 2,
                    max: cat.teamMax || 5
                } : null,
                accessType: cat.accessType || 'all',
                hasAccess: true,
                isOpen: event.registrationOpen || false,
                isFull: cat.capacity ? current >= cat.capacity : false,
                accessMessage: ''
            };
        });

        console.log(`✅ Returning ${formattedCategories.length} categories`);

        res.json({
            success: true,
            data: {
                event: {
                    id: event.id,
                    title: event.title,
                    description: event.description,
                    date: event.date,
                    time: event.time,
                    location: event.location,
                    registrationOpen: event.registrationOpen
                },
                categories: formattedCategories
            }
        });

    } catch (error) {
        console.error('❌ Error fetching categories:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch categories',
            error: error.message
        });
    }
});

// ✅ 2. REGISTER FOR EVENT WITH SSLCOMMERZ
router.post('/events/:eventId/categories/:categoryId', async (req, res) => {
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

        console.log(`📝 New registration for event ${eventId}, category ${categoryId}`);

        const event = await Event.findByPk(eventId);

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        if (!event.registrationOpen) {
            return res.status(400).json({
                success: false,
                message: 'Registration is closed for this event'
            });
        }

        let categories = event.categories;
        if (typeof categories === 'string') {
            try {
                categories = JSON.parse(categories);
            } catch (e) {
                categories = [];
            }
        }

        const categoryIndex = parseInt(categoryId) - 1;
        const selectedCategory = categories[categoryIndex];

        if (!selectedCategory) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        if (selectedCategory.capacity) {
            const count = await EventRegistration.count({
                where: {
                    eventId,
                    categoryName: selectedCategory.name,
                    status: 'confirmed'
                }
            });

            if (count >= selectedCategory.capacity) {
                return res.status(400).json({
                    success: false,
                    message: 'This category is full'
                });
            }
        }

        const registrationId = `REG-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        const registrationData = {
            registrationId,
            eventId: parseInt(eventId),
            userId: req.user ? req.user.id : null,
            categoryId: categoryId,
            categoryName: selectedCategory.name,
            registrationType: selectedCategory.type || 'individual',
            source: 'public',
            type: req.user ? 'internal' : 'guest',
            name: name,
            email: email,
            phone: phone || null,
            studentId: studentId || null,
            department: department || null,
            batch: batch || null,
            organization: organization || null,
            teamName: teamName || null,
            teamMembers: teamMembers && teamMembers.length > 0 ? teamMembers : null,
            amount: selectedCategory.price || 0,
            status: selectedCategory.price === 0 ? 'confirmed' : 'pending_payment',
            customFieldsData: customFields || null,
            confirmedAt: selectedCategory.price === 0 ? new Date() : null
        };

        const registration = await EventRegistration.create(registrationData);
        console.log(`✅ Registration created: ${registration.id} (${registration.registrationId})`);

        if (selectedCategory.price === 0) {
            return res.status(201).json({
                success: true,
                message: 'Registration successful!',
                data: {
                    registration: {
                        id: registration.id,
                        registrationId: registration.registrationId,
                        status: registration.status,
                        categoryName: registration.categoryName,
                        teamName: registration.teamName,
                        amount: registration.amount
                    },
                    payment: null
                }
            });
        }

        const Payment = require('../models/Payment');
        const sslcommerz = require('../config/sslcommerz');

        const tran_id = `EVT-${registration.id}-${Date.now()}`;

        const payment = await Payment.create({
            userId: req.user ? req.user.id : null,
            payerName: name,
            payerEmail: email,
            amount: selectedCategory.price,
            type: 'event',
            eventId: parseInt(eventId),
            eventRegistrationId: registration.id,
            status: 'pending',
            transactionId: tran_id,
            paymentMethod: 'sslcommerz'
        });

        registration.paymentId = payment.id;
        await registration.save();

        console.log(`💳 Payment record created: ${payment.id}, Transaction: ${tran_id}`);

        const sslData = {
            total_amount: selectedCategory.price,
            currency: 'BDT',
            tran_id: tran_id,
            success_url: `${process.env.SERVER_URL}/api/sslcommerz/success`,
            fail_url: `${process.env.SERVER_URL}/api/sslcommerz/fail`,
            cancel_url: `${process.env.SERVER_URL}/api/sslcommerz/cancel`,
            ipn_url: `${process.env.SERVER_URL}/api/sslcommerz/ipn`,
            cus_name: name,
            cus_email: email,
            cus_phone: phone || '01700000000',
            cus_add1: organization || 'Dhaka',
            cus_city: 'Dhaka',
            cus_country: 'Bangladesh',
            product_name: `${event.title} - ${selectedCategory.name}`,
            product_category: 'Event Registration',
            product_profile: 'general',
            shipping_method: 'NO',
            num_of_item: 1,
            value_a: registration.id,
            value_b: eventId,
            value_c: payment.id,
        };

        console.log('🔐 Initiating SSLCommerz payment...');

        const apiResponse = await sslcommerz.init(sslData);

        if (apiResponse?.GatewayPageURL) {
            console.log('✅ SSLCommerz payment URL generated');

            return res.status(201).json({
                success: true,
                message: 'Registration created. Redirecting to payment...',
                data: {
                    registration: {
                        id: registration.id,
                        registrationId: registration.registrationId,
                        status: registration.status,
                        categoryName: registration.categoryName,
                        teamName: registration.teamName,
                        amount: registration.amount
                    },
                    payment: {
                        gatewayUrl: apiResponse.GatewayPageURL,
                        amount: selectedCategory.price,
                        transactionId: tran_id
                    }
                }
            });
        } else {
            console.error('❌ SSLCommerz failed:', apiResponse);
            throw new Error('Payment gateway initialization failed');
        }

    } catch (error) {
        console.error('❌ Error creating registration:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create registration',
            error: error.message
        });
    }
});

// ✅ 3. GET REGISTRATIONS FOR EVENT (General route - comes AFTER specific routes)
router.get('/events/:eventId', protect, async (req, res) => {
    try {
        const { eventId } = req.params;

        console.log(`📋 Fetching registrations for event ID: ${eventId}`);

        const event = await Event.findByPk(eventId);
        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        const registrations = await EventRegistration.findAll({
            where: { eventId },
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'email', 'studentId', 'phone'],
                    required: false
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        console.log(`✅ Found ${registrations.length} registrations`);

        const formattedRegistrations = registrations.map(reg => {
            const data = {
                id: reg.id,
                eventId: reg.eventId,
                userId: reg.userId,
                registrationType: reg.registrationType || 'guest',
                categoryName: reg.categoryName || 'General',
                categoryType: reg.categoryType || 'individual',
                user: null,
                guestName: reg.guestName || null,
                guestEmail: reg.guestEmail || null,
                guestPhone: reg.guestPhone || null,
                guestInstitution: reg.guestInstitution || null,
                teamName: reg.teamName || null,
                teamMembers: [],
                paymentStatus: reg.paymentStatus || 'pending',
                paymentAmount: reg.paymentAmount || 0,
                transactionId: reg.transactionId || null,
                trackingToken: reg.trackingToken || null,
                status: reg.status || 'pending',
                createdAt: reg.createdAt,
                updatedAt: reg.updatedAt
            };

            if (reg.user) {
                data.user = {
                    id: reg.user.id,
                    name: reg.user.name,
                    email: reg.user.email,
                    studentId: reg.user.studentId,
                    phone: reg.user.phone
                };
            }

            if (reg.teamMembers) {
                try {
                    data.teamMembers = typeof reg.teamMembers === 'string'
                        ? JSON.parse(reg.teamMembers)
                        : reg.teamMembers;
                } catch (e) {
                    data.teamMembers = [];
                }
            }

            return data;
        });

        res.json({
            success: true,
            data: formattedRegistrations,
            count: formattedRegistrations.length
        });

    } catch (error) {
        console.error('❌ Error fetching registrations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch registrations',
            error: error.message
        });
    }
});

// ✅ 4. GET SINGLE REGISTRATION BY ID
router.get('/:registrationId', protect, async (req, res) => {
    try {
        const { registrationId } = req.params;

        const registration = await EventRegistration.findByPk(registrationId, {
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'email', 'studentId', 'phone'],
                    required: false
                },
                {
                    model: Event,
                    as: 'event',
                    attributes: ['id', 'title', 'date', 'location']
                }
            ]
        });

        if (!registration) {
            return res.status(404).json({
                success: false,
                message: 'Registration not found'
            });
        }

        res.json({
            success: true,
            data: registration
        });

    } catch (error) {
        console.error('❌ Error fetching registration:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch registration',
            error: error.message
        });
    }
});

// ✅ 5. TRACK REGISTRATION BY TOKEN (Public - No Auth)
router.get('/track/:token', async (req, res) => {
    try {
        const { token } = req.params;

        const registration = await EventRegistration.findOne({
            where: { trackingToken: token },
            include: [
                {
                    model: Event,
                    as: 'event',
                    attributes: ['id', 'title', 'date', 'location']
                }
            ]
        });

        if (!registration) {
            return res.status(404).json({
                success: false,
                message: 'Registration not found with this tracking token'
            });
        }

        res.json({
            success: true,
            data: registration
        });

    } catch (error) {
        console.error('❌ Error tracking registration:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to track registration',
            error: error.message
        });
    }
});

module.exports = router;
