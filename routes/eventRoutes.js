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
    registerForEvent,
    getEventRegistrations,
    updateRegistrationPayment,
    issueRegistrationCertificate,
    revokeRegistrationCertificate,
    bulkIssueCertificates,
    bulkRevokeCertificates,
    issueTeamCertificate,
    revokeTeamCertificate,
    bulkIssueTeamCertificates,
} = require('../controllers/eventController');

const { protect, optionalAuth } = require('../middleware/auth');
const { authorize, isAdminOrModerator } = require('../middleware/roleMiddleware');

// ================= PUBLIC ROUTES =================

router.get('/', getAllEvents);
router.get('/upcoming', getUpcomingEvents);
router.get('/:id', getEvent);

// ✅ Certificate verification (public endpoint)
router.get('/verify-certificate/:credentialId', async (req, res) => {
    try {
        const { credentialId } = req.params;
        const EventRegistration = require('../models/EventRegistration');
        const User = require('../models/User');
        const Event = require('../models/Event');

        const registration = await EventRegistration.findOne({
            where: { credentialId },
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'email'],
                },
                {
                    model: Event,
                    as: 'event',
                    attributes: ['id', 'title', 'date', 'location'],
                },
            ],
        });

        if (!registration) {
            return res.status(404).json({
                success: false,
                message: 'Certificate not found or invalid',
            });
        }

        if (!registration.certificateIssued) {
            return res.status(400).json({
                success: false,
                message: 'Certificate has not been issued for this registration',
            });
        }

        const participantName = registration.user?.name || registration.name || registration.guestName || 'Unknown';

        return res.json({
            success: true,
            message: 'Certificate is valid and verified ✓',
            data: {
                credentialId: registration.credentialId,
                participantName,
                eventTitle: registration.event?.title || 'Unknown Event',
                eventDate: registration.event?.date,
                role: registration.role || 'participant',
                issuedAt: registration.certificateIssuedAt || registration.updatedAt,
            },
        });
    } catch (error) {
        console.error('Error verifying certificate:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during certificate verification',
        });
    }
});

// ✅ Public registration (guest OR logged in)
router.post('/:id/register', optionalAuth, registerForEvent);

// ✅ Submit payment TX (guest/user)
router.put('/:id/registrations/:regId/payment', optionalAuth, updateRegistrationPayment);

// ================= MANAGEMENT ROUTES =================

// ✅ Create event - Management only
router.post('/', protect, isAdminOrModerator, createEvent);

// ✅ FIXED: Update event - Authorization check is INSIDE controller
// Controller checks: creator OR admin/moderator
router.put('/:id', protect, updateEvent);

// ✅ FIXED: Delete event - Authorization check is INSIDE controller
// Controller checks: creator OR admin/moderator/president/general_secretary
router.delete('/:id', protect, deleteEvent); // ✅ REMOVED authorize('admin')

// ✅ Registrations list (management)
router.get('/:id/registrations', protect, isAdminOrModerator, getEventRegistrations);

// ================= CERTIFICATE MANAGEMENT - REGISTRANTS =================

router.post('/:id/registrations/:regId/certificate', protect, isAdminOrModerator, issueRegistrationCertificate);
router.delete('/:id/registrations/:regId/certificate', protect, isAdminOrModerator, revokeRegistrationCertificate);
router.post('/:id/registrations/bulk-certificate', protect, isAdminOrModerator, bulkIssueCertificates);
router.post('/:id/registrations/bulk-revoke', protect, isAdminOrModerator, bulkRevokeCertificates);

// ================= CERTIFICATE MANAGEMENT - TEAM MEMBERS =================

router.post('/:id/team/:participantIndex/certificate', protect, isAdminOrModerator, issueTeamCertificate);
router.delete('/:id/team/:participantIndex/certificate', protect, isAdminOrModerator, revokeTeamCertificate);
router.post('/:id/team/bulk-certificate', protect, isAdminOrModerator, bulkIssueTeamCertificates);

module.exports = router;
