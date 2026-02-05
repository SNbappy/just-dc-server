// routes/eventRoutes.js
const express = require('express');
const router = express.Router();

const {
    getAllEvents,
    getEvent,
    createEvent,
    updateEvent,
    deleteEvent,
    getUpcomingEvents,
} = require('../controllers/eventController');

const {
    registerForEvent,
    getEventRegistrations,
    submitRegistrationPayment,
    verifyRegistrationPayment,
    issueCertificate,
} = require('../controllers/eventRegistrationController');

const { protect, optionalAuth } = require('../middleware/auth');
const { authorize } = require('../middleware/roleMiddleware');

// ================= PUBLIC =================
router.get('/', getAllEvents);
router.get('/upcoming', getUpcomingEvents);
router.get('/:id', getEvent);

// ✅ Public registration (guest OR logged in)
router.post('/:id/register', optionalAuth, registerForEvent);

// ✅ submit payment TX (guest/user) -> store method + transactionId
router.put('/:eventId/registrations/:regId/payment', optionalAuth, submitRegistrationPayment);

// ================= MANAGEMENT =================
router.post('/', protect, authorize('admin', 'president', 'general_secretary'), createEvent);
router.put('/:id', protect, authorize('admin', 'president', 'general_secretary'), updateEvent);
router.delete('/:id', protect, authorize('admin', 'president', 'general_secretary'), deleteEvent);

// ✅ registrations list (management)
router.get(
    '/:id/registrations',
    protect,
    authorize('admin', 'president', 'general_secretary', 'moderator'),
    getEventRegistrations
);

// ✅ verify payment (management)
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
