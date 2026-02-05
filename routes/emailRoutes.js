// routes/emailRoutes.js
const express = require('express');
const router = express.Router();

const {
    sendEmailToMembers,
    getEmailLogs,
    getEmailLog,
    getEmailTemplates,
    getRecipientGroups,
} = require('../controllers/emailController');

const { protect } = require('../middleware/auth');
const { isAdminOrModerator } = require('../middleware/roleMiddleware');

// All routes require admin/moderator access
router.use(protect);
router.use(isAdminOrModerator);

// Send email
router.post('/send', sendEmailToMembers);

// Email logs
router.get('/logs', getEmailLogs);
router.get('/logs/:id', getEmailLog);

// Templates and groups
router.get('/templates', getEmailTemplates);
router.get('/recipient-groups', getRecipientGroups);

module.exports = router;
