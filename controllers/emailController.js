// controllers/emailController.js
const { sendEmail, templates } = require('../services/emailService');
const EmailLog = require('../models/EmailLog');
const User = require('../models/User');
const Event = require('../models/Event');
const EventRegistration = require('../models/EventRegistration');
const { Op } = require('sequelize');

// @desc    Send email to individual or group
// @route   POST /api/emails/send
// @access  Private/Admin
exports.sendEmailToMembers = async (req, res) => {
    try {
        const { recipientType, recipients, subject, message, templateName, eventId, customEmails } = req.body;

        if (!subject || !message) {
            return res.status(400).json({
                success: false,
                message: 'Subject and message are required',
            });
        }

        let recipientEmails = [];
        let recipientList = [];

        // Determine recipients based on type
        switch (recipientType) {
            case 'individual':
                // Multiple users by ID
                if (!recipients || recipients.length === 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'No recipients provided',
                    });
                }

                const users = await User.findAll({
                    where: { id: { [Op.in]: recipients } },
                    attributes: ['id', 'name', 'email'],
                });

                recipientEmails = users.map((u) => u.email);
                recipientList = users.map((u) => ({ id: u.id, name: u.name, email: u.email }));
                break;

            case 'role':
                // All users with specific roles
                if (!recipients || recipients.length === 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'No roles provided',
                    });
                }

                const roleUsers = await User.findAll({
                    where: { role: { [Op.in]: recipients } },
                    attributes: ['id', 'name', 'email'],
                });

                recipientEmails = roleUsers.map((u) => u.email);
                recipientList = roleUsers.map((u) => ({ id: u.id, name: u.name, email: u.email }));
                break;

            case 'all':
                // All users
                const allUsers = await User.findAll({
                    attributes: ['id', 'name', 'email'],
                });

                recipientEmails = allUsers.map((u) => u.email);
                recipientList = allUsers.map((u) => ({ id: u.id, name: u.name, email: u.email }));
                break;

            case 'event':
                // All participants of specific event
                if (!eventId) {
                    return res.status(400).json({
                        success: false,
                        message: 'Event ID required for event recipients',
                    });
                }

                const registrations = await EventRegistration.findAll({
                    where: { eventId, status: 'confirmed' },
                    attributes: ['name', 'email'],
                });

                recipientEmails = registrations.map((r) => r.email);
                recipientList = registrations.map((r) => ({ name: r.name, email: r.email }));
                break;

            case 'custom':
                // ✅ Custom email addresses
                if (!customEmails || customEmails.length === 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'No custom email addresses provided',
                    });
                }

                // Validate and clean email addresses
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                const validEmails = customEmails
                    .map((email) => String(email).trim().toLowerCase())
                    .filter((email) => emailRegex.test(email));

                if (validEmails.length === 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'No valid email addresses provided',
                    });
                }

                recipientEmails = validEmails;
                recipientList = validEmails.map((email) => ({ email, name: 'Recipient' }));
                break;

            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid recipient type',
                });
        }

        if (recipientEmails.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No recipients found',
            });
        }

        // Generate HTML content
        let htmlContent;
        if (templateName && templates[templateName]) {
            // Use template
            if (templateName === 'eventAnnouncement' && eventId) {
                const event = await Event.findByPk(eventId);
                if (event) {
                    const template = templates.eventAnnouncement(event, 'Member');
                    htmlContent = template.html;
                }
            } else {
                const template = templates.customMessage(subject, message, req.user.name);
                htmlContent = template.html;
            }
        } else {
            // Use custom message template
            const template = templates.customMessage(subject, message, req.user.name);
            htmlContent = template.html;
        }

        // Send emails
        let successCount = 0;
        let failedEmails = [];

        for (const email of recipientEmails) {
            try {
                await sendEmail({
                    to: email,
                    subject,
                    text: message,
                    html: htmlContent,
                });
                successCount++;
                console.log(`✅ Email sent to: ${email}`);
            } catch (error) {
                console.error(`❌ Failed to send to ${email}:`, error.message);
                failedEmails.push(email);
            }
        }

        // ✅ FIXED: Changed senderId to sentBy
        await EmailLog.create({
            sentBy: req.user.id,  // ✅ Changed from senderId
            recipients: recipientList,
            recipientType,
            subject,
            message,
            htmlContent,
            status: successCount > 0 ? 'sent' : 'failed',
            emailsSent: successCount,
            errorMessage: failedEmails.length > 0 ? `Failed: ${failedEmails.join(', ')}` : null,
        });

        return res.json({
            success: true,
            message: `Email sent to ${successCount} of ${recipientEmails.length} recipient(s)`,
            data: {
                total: recipientEmails.length,
                sent: successCount,
                failed: failedEmails.length,
                failedEmails,
            },
        });
    } catch (error) {
        console.error('❌ Error sending email:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to send email',
            error: error.message,
        });
    }
};

// @desc    Get email history/logs
// @route   GET /api/emails/logs
// @access  Private/Admin
exports.getEmailLogs = async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        const { count, rows } = await EmailLog.findAndCountAll({
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset),
        });

        // ✅ FIXED: Changed senderId to sentBy
        const senderIds = [...new Set(rows.map((log) => log.sentBy).filter(Boolean))];
        const senders = await User.findAll({
            where: { id: { [Op.in]: senderIds } },
            attributes: ['id', 'name', 'email'],
        });

        const senderMap = new Map(senders.map((u) => [u.id, u]));

        const logs = rows.map((log) => {
            const plain = log.toJSON ? log.toJSON() : log;
            const sender = senderMap.get(log.sentBy);  // ✅ Changed from senderId
            return {
                ...plain,
                sender: sender
                    ? {
                        id: sender.id,
                        name: sender.name,
                        email: sender.email,
                    }
                    : null,
            };
        });

        return res.json({
            success: true,
            count: logs.length,
            total: count,
            page: parseInt(page),
            totalPages: Math.ceil(count / limit),
            data: logs,
        });
    } catch (error) {
        console.error('❌ Error fetching email logs:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch email logs',
            error: error.message,
        });
    }
};

// @desc    Get email log by ID
// @route   GET /api/emails/logs/:id
// @access  Private/Admin
exports.getEmailLog = async (req, res) => {
    try {
        const log = await EmailLog.findByPk(req.params.id);

        if (!log) {
            return res.status(404).json({
                success: false,
                message: 'Email log not found',
            });
        }

        // ✅ FIXED: Changed senderId to sentBy
        const sender = await User.findByPk(log.sentBy, {
            attributes: ['id', 'name', 'email'],
        });

        const data = log.toJSON ? log.toJSON() : log;

        return res.json({
            success: true,
            data: {
                ...data,
                sender: sender
                    ? {
                        id: sender.id,
                        name: sender.name,
                        email: sender.email,
                    }
                    : null,
            },
        });
    } catch (error) {
        console.error('❌ Error fetching email log:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch email log',
            error: error.message,
        });
    }
};

// @desc    Get available email templates
// @route   GET /api/emails/templates
// @access  Private/Admin
exports.getEmailTemplates = async (req, res) => {
    try {
        const availableTemplates = [
            {
                name: 'eventAnnouncement',
                label: 'Event Announcement',
                description: 'Announce a new event to members',
                requiresEvent: true,
            },
            {
                name: 'customMessage',
                label: 'Custom Message',
                description: 'Send a custom formatted message',
                requiresEvent: false,
            },
        ];

        return res.json({
            success: true,
            data: availableTemplates,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch templates',
        });
    }
};

// @desc    Get recipient groups (for dropdown)
// @route   GET /api/emails/recipient-groups
// @access  Private/Admin
exports.getRecipientGroups = async (req, res) => {
    try {
        // Count users by role
        const userCount = await User.count({ where: { role: 'user' } });
        const memberCount = await User.count({ where: { role: 'member' } });
        const executiveCount = await User.count({ where: { role: 'executive_member' } });
        const gsCount = await User.count({ where: { role: 'general_secretary' } });
        const presidentCount = await User.count({ where: { role: 'president' } });
        const moderatorCount = await User.count({ where: { role: 'moderator' } });
        const adminCount = await User.count({ where: { role: 'admin' } });
        const totalCount = await User.count();

        const groups = [
            { value: 'all', label: 'All Members', count: totalCount },
            { value: 'user', label: 'Users', count: userCount },
            { value: 'member', label: 'Members', count: memberCount },
            { value: 'executive_member', label: 'Executive Members', count: executiveCount },
            { value: 'general_secretary', label: 'General Secretary', count: gsCount },
            { value: 'president', label: 'President', count: presidentCount },
            { value: 'moderator', label: 'Moderators', count: moderatorCount },
            { value: 'admin', label: 'Admins', count: adminCount },
        ];

        return res.json({
            success: true,
            data: groups,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch recipient groups',
        });
    }
};
