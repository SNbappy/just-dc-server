// routes/certificateRoutes.js
const express = require('express');
const router = express.Router();
const {
    issueParticipantCertificate,
    issueTeamMemberCertificate,
    bulkIssueCertificates,
    getEventCertificates,
    getMyCertificates,
    verifyCertificate,
} = require('../controllers/certificateController');
const { protect, authorize } = require('../middleware/auth');

// =====================================================
// PUBLIC ROUTES
// =====================================================

// Verify certificate (QR code scanning support)
router.get('/verify/:credentialId', verifyCertificate);

// =====================================================
// PROTECTED ROUTES
// =====================================================

// Get my certificates
router.get('/my-certificates', protect, getMyCertificates);

// Get all certificates for an event
router.get('/event/:eventId', protect, getEventCertificates);

// =====================================================
// ADMIN/PRESIDENT/GS ONLY ROUTES
// =====================================================

// Issue certificate to participant (registrant)
router.post(
    '/participant/:registrationId',
    protect,
    authorize('admin', 'president', 'general_secretary'),
    issueParticipantCertificate
);

// Issue certificate to team member (organizer/volunteer/adjudicator)
router.post(
    '/team-member',
    protect,
    authorize('admin', 'president', 'general_secretary'),
    issueTeamMemberCertificate
);

// Bulk issue certificates
router.post(
    '/bulk-issue/:eventId',
    protect,
    authorize('admin', 'president', 'general_secretary'),
    bulkIssueCertificates
);

module.exports = router;
