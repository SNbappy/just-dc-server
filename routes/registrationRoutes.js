// routes/registrationRoutes.js
const express = require('express');
const router = express.Router();
const {
    getRegistrationCategories,
    registerForEvent,
    trackRegistration,
    getMyRegistrations,
    cancelRegistration,
} = require('../controllers/registrationController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');

// =====================================================
// PUBLIC ROUTES (with optional auth)
// =====================================================

// Get registration categories for an event
router.get('/events/:eventId/categories', optionalAuth, getRegistrationCategories);

// Register for event (category-based)
router.post('/events/:eventId/categories/:categoryId', optionalAuth, registerForEvent);

// Track registration with verification token (for guests)
router.get('/track', trackRegistration);

// =====================================================
// PROTECTED ROUTES (logged-in users)
// =====================================================

// Get my registrations
router.get('/my-registrations', protect, getMyRegistrations);

// Cancel registration
router.delete('/:registrationId', optionalAuth, cancelRegistration);

module.exports = router;
