const express = require('express');
const router = express.Router();

const {
    getAllEvents,
    getEvent,
    createEvent,
    updateEvent,
    deleteEvent,
    getUpcomingEvents,

    // ✅ NEW
    registerForEvent,
    getEventRegistrations,
    submitRegistrationPayment,
    verifyRegistrationPayment,
    issueCertificate,
} = require('../controllers/eventController');

const { protect, optionalAuth } = require('../middleware/auth');
const { authorize } = require('../middleware/roleMiddleware');

// Public
router.get('/', getAllEvents);
router.get('/upcoming', getUpcomingEvents);
router.get('/:id', getEvent);

// ✅ Public registration (guest OR logged in)
router.post('/:id/register', optionalAuth, registerForEvent);

// ✅ submit payment tx (guest/user)
router.put('/:eventId/registrations/:regId/payment', optionalAuth, submitRegistrationPayment);

// ✅ Management: Admin / President / General Secretary
router.post('/', protect, authorize('admin', 'president', 'general_secretary'), createEvent);
router.put('/:id', protect, authorize('admin', 'president', 'general_secretary'), updateEvent);
router.delete('/:id', protect, authorize('admin', 'president', 'general_secretary'), deleteEvent);

// ✅ Management registration panel
router.get(
    '/:id/registrations',
    protect,
    authorize('admin', 'president', 'general_secretary', 'moderator'),
    getEventRegistrations
);

// ✅ verify payments (management)
router.put(
    '/:eventId/registrations/:regId/verify',
    protect,
    authorize('admin', 'president', 'general_secretary', 'moderator'),
    verifyRegistrationPayment
);

// ✅ issue certificate (management)
router.post(
    '/:eventId/registrations/:regId/issue-certificate',
    protect,
    authorize('admin', 'president', 'general_secretary', 'moderator'),
    issueCertificate
);

module.exports = router;
