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

const { protect } = require('../middleware/auth');
const { optionalAuth } = require('../middleware/optionalAuth'); // ✅ FIXED
const { authorize, isAdminOrModerator } = require('../middleware/roleMiddleware');

// ================= PUBLIC =================
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

// ✅ submit payment TX (guest/user)
router.put('/:id/registrations/:regId/payment', optionalAuth, updateRegistrationPayment);

// ================= MANAGEMENT =================
router.post('/', protect, isAdminOrModerator, createEvent);
router.put('/:id', protect, isAdminOrModerator, updateEvent);
router.delete('/:id', protect, authorize('admin'), deleteEvent);

// ✅ registrations list (management)
router.get('/:id/registrations', protect, isAdminOrModerator, getEventRegistrations);

// ✅ CERTIFICATE MANAGEMENT - REGISTRANTS
router.post('/:id/registrations/:regId/certificate', protect, isAdminOrModerator, issueRegistrationCertificate);
router.delete('/:id/registrations/:regId/certificate', protect, isAdminOrModerator, revokeRegistrationCertificate);
router.post('/:id/registrations/bulk-certificate', protect, isAdminOrModerator, bulkIssueCertificates);
router.post('/:id/registrations/bulk-revoke', protect, isAdminOrModerator, bulkRevokeCertificates);

// ✅ CERTIFICATE MANAGEMENT - TEAM MEMBERS
router.post('/:id/team/:participantIndex/certificate', protect, isAdminOrModerator, issueTeamCertificate);
router.delete('/:id/team/:participantIndex/certificate', protect, isAdminOrModerator, revokeTeamCertificate);
router.post('/:id/team/bulk-certificate', protect, isAdminOrModerator, bulkIssueTeamCertificates);

module.exports = router;
