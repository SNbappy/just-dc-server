// controllers/eventController.js
const Event = require('../models/Event');
const EventRegistration = require('../models/EventRegistration');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const { sendEmail, templates } = require('../services/emailService'); // ✅ ADD THIS

// helper: attach createdBy user
const attachCreatedBy = async (events) => {
    if (!events) return events;

    if (!Array.isArray(events)) {
        const creator = await User.findByPk(events.createdBy, {
            attributes: ['id', 'name', 'email'],
        });

        const data = events.toJSON ? events.toJSON() : events;
        return {
            ...data,
            createdBy: creator ? { _id: creator.id, name: creator.name, email: creator.email } : null,
        };
    }

    const creatorIds = [...new Set(events.map((e) => e.createdBy).filter(Boolean))];

    const creators = await User.findAll({
        where: { id: { [Op.in]: creatorIds } },
        attributes: ['id', 'name', 'email'],
    });

    const creatorMap = new Map(creators.map((u) => [u.id, u]));

    return events.map((ev) => {
        const data = ev.toJSON ? ev.toJSON() : ev;
        const c = creatorMap.get(ev.createdBy);
        return {
            ...data,
            createdBy: c ? { _id: c.id, name: c.name, email: c.email } : null,
        };
    });
};

// helper: populate participants internal
const attachParticipants = async (events) => {
    if (!events) return events;

    const normalize = (ev) => (ev?.toJSON ? ev.toJSON() : ev);

    const populateOne = async (ev) => {
        const data = normalize(ev);
        const participants = Array.isArray(data.participants) ? data.participants : [];

        const internalIds = participants
            .filter((p) => p && p.type === 'internal' && p.userId)
            .map((p) => Number(p.userId))
            .filter(Boolean);

        const uniqueIds = [...new Set(internalIds)];

        const users = uniqueIds.length
            ? await User.findAll({
                where: { id: { [Op.in]: uniqueIds } },
                attributes: ['id', 'name', 'email', 'studentId', 'phone', 'role'],
            })
            : [];

        const userMap = new Map(users.map((u) => [u.id, u]));

        const participantsPopulated = participants.map((p) => {
            if (p?.type === 'internal' && p.userId) {
                const u = userMap.get(Number(p.userId));
                return {
                    ...p,
                    user: u
                        ? {
                            _id: u.id,
                            name: u.name,
                            email: u.email,
                            studentId: u.studentId,
                            phone: u.phone,
                            role: u.role,
                        }
                        : null,
                };
            }
            return p;
        });

        return { ...data, participantsPopulated };
    };

    if (!Array.isArray(events)) return populateOne(events);

    const plain = events.map(normalize);
    const allInternalIds = plain
        .flatMap((ev) => (Array.isArray(ev.participants) ? ev.participants : []))
        .filter((p) => p && p.type === 'internal' && p.userId)
        .map((p) => Number(p.userId))
        .filter(Boolean);

    const uniqueIds = [...new Set(allInternalIds)];

    const users = uniqueIds.length
        ? await User.findAll({
            where: { id: { [Op.in]: uniqueIds } },
            attributes: ['id', 'name', 'email', 'studentId', 'phone', 'role'],
        })
        : [];

    const userMap = new Map(users.map((u) => [u.id, u]));

    return plain.map((ev) => {
        const participants = Array.isArray(ev.participants) ? ev.participants : [];
        const participantsPopulated = participants.map((p) => {
            if (p?.type === 'internal' && p.userId) {
                const u = userMap.get(Number(p.userId));
                return {
                    ...p,
                    user: u
                        ? {
                            _id: u.id,
                            name: u.name,
                            email: u.email,
                            studentId: u.studentId,
                            phone: u.phone,
                            role: u.role,
                        }
                        : null,
                };
            }
            return p;
        });

        return { ...ev, participantsPopulated };
    });
};

// sanitize participants
const sanitizeParticipants = (participants) => {
    if (!Array.isArray(participants)) return [];

    const allowedRoles = new Set(['organizer', 'volunteer', 'core_adjudicator', 'tab_team', 'speaker', 'guest']);

    return participants
        .map((p) => {
            if (!p || typeof p !== 'object') return null;

            const role = allowedRoles.has(p.role) ? p.role : 'volunteer';

            if (p.type === 'internal') {
                const userId = Number(p.userId);
                if (!userId) return null;
                return { role, type: 'internal', userId };
            }

            const name = String(p.name || '').trim();
            const designation = String(p.designation || '').trim();
            const org = String(p.org || '').trim();

            if (!name) return null;
            return { role, type: 'external', name, designation, org };
        })
        .filter(Boolean);
};

const normalizeEmail = (email) => String(email || '').toLowerCase().trim();

const isManagementRole = (role) => ['admin', 'moderator', 'president', 'general_secretary'].includes(role);

// ======================= EVENTS =======================

// GET /api/events
exports.getAllEvents = async (req, res) => {
    try {
        const { search, category, status } = req.query;

        const where = {};
        if (search) {
            where[Op.or] = [
                { title: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } },
            ];
        }
        if (category) where.category = category;
        if (status) where.status = status;

        const events = await Event.findAll({ where, order: [['date', 'DESC']] });

        let data = await attachCreatedBy(events);
        data = await attachParticipants(data);

        res.json({ success: true, count: data.length, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/events/:id
exports.getEvent = async (req, res) => {
    try {
        const event = await Event.findByPk(req.params.id);
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

        let data = await attachCreatedBy(event);
        data = await attachParticipants(data);

        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/events
exports.createEvent = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

        const participants = sanitizeParticipants(req.body.participants);

        const payload = {
            ...req.body,
            participants,
            createdBy: req.user.id,
        };

        const event = await Event.create(payload);

        let data = await attachCreatedBy(event);
        data = await attachParticipants(data);

        // ✅ NEW: Optional event announcement email
        if (req.body.sendAnnouncement === true) {
            try {
                const allUsers = await User.findAll({
                    attributes: ['email', 'name'],
                    where: { role: { [Op.in]: ['admin', 'moderator', 'member'] } }
                });

                console.log(`📧 Sending event announcement to ${allUsers.length} members...`);

                for (const user of allUsers) {
                    try {
                        const template = templates.eventAnnouncement(event, user.name);
                        await sendEmail({
                            to: user.email,
                            subject: template.subject,
                            html: template.html,
                        });
                    } catch (emailError) {
                        console.error(`❌ Failed to send announcement to ${user.email}:`, emailError.message);
                    }
                }

                console.log(`✅ Event announcement sent to ${allUsers.length} members`);
            } catch (error) {
                console.error('❌ Failed to send event announcements:', error);
            }
        }

        res.status(201).json({ success: true, message: 'Event created successfully', data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// PUT /api/events/:id
exports.updateEvent = async (req, res) => {
    try {
        const event = await Event.findByPk(req.params.id);
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

        const updatePayload = { ...req.body };
        if ('participants' in req.body) updatePayload.participants = sanitizeParticipants(req.body.participants);

        await event.update(updatePayload);

        let data = await attachCreatedBy(event);
        data = await attachParticipants(data);

        res.json({ success: true, message: 'Event updated successfully', data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// DELETE /api/events/:id
exports.deleteEvent = async (req, res) => {
    try {
        const event = await Event.findByPk(req.params.id);
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

        await event.destroy();
        res.json({ success: true, message: 'Event deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/events/upcoming
exports.getUpcomingEvents = async (req, res) => {
    try {
        const today = new Date();

        const events = await Event.findAll({
            where: { date: { [Op.gte]: today }, status: 'upcoming' },
            order: [['date', 'ASC']],
            limit: 10,
        });

        let data = await attachCreatedBy(events);
        data = await attachParticipants(data);

        res.json({ success: true, count: data.length, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ======================= REGISTRATION =======================

// POST /api/events/:id/register
exports.registerForEvent = async (req, res) => {
    try {
        const event = await Event.findByPk(req.params.id);
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

        if (!event.registrationOpen) {
            return res.status(400).json({ success: false, message: 'Registration is closed for this event' });
        }

        if (event.accessType === 'inter_club' && !req.user) {
            return res.status(401).json({ success: false, message: 'Login required for this event' });
        }

        const fee = Number(event.registrationFee || 0);

        if (req.user) {
            const existing = await EventRegistration.findOne({
                where: { eventId: event.id, userId: req.user.id },
            });
            if (existing) {
                return res.status(400).json({ success: false, message: 'You are already registered for this event' });
            }
        } else {
            const guestEmail = normalizeEmail(req.body.email || req.body.guestEmail);
            if (!guestEmail) {
                return res.status(400).json({ success: false, message: 'Guest email is required' });
            }
            const existing = await EventRegistration.findOne({
                where: { eventId: event.id, email: guestEmail },
            });
            if (existing) {
                return res.status(400).json({ success: false, message: 'This email is already registered for this event' });
            }
        }

        const isGuest = !req.user;

        const name = isGuest ? String(req.body.name || req.body.guestName || '').trim() : req.user.name;
        const email = isGuest ? normalizeEmail(req.body.email || req.body.guestEmail) : normalizeEmail(req.user.email);

        if (!name || !email) {
            return res.status(400).json({ success: false, message: 'Name and email are required' });
        }

        const reg = await EventRegistration.create({
            eventId: event.id,
            userId: req.user ? req.user.id : null,
            name,
            email,
            phone: isGuest ? (req.body.phone || req.body.guestPhone || null) : (req.user.phone || null),
            studentId: isGuest ? (req.body.studentId || null) : (req.user.studentId || null),
            department: isGuest ? (req.body.department || null) : (req.user.department || null),
            batch: isGuest ? (req.body.batch || null) : (req.user.batch || null),
            organization: req.body.organization || null,
            type: req.user ? 'internal' : 'guest',
            status: fee > 0 ? 'pending_payment' : 'confirmed',
            amount: fee,
        });

        if (fee > 0) {
            const payment = await Payment.create({
                userId: req.user ? req.user.id : null,
                amount: fee,
                type: 'event',
                status: 'pending',
                paymentMethod: null,
                transactionId: null,
                eventId: event.id,
                eventRegistrationId: reg.id,
                notes: `Event fee: ${event.title}`,
            });

            await reg.update({ paymentId: payment.id });

            return res.status(201).json({
                success: true,
                message: 'Registered. Payment required to confirm.',
                data: reg,
                paymentRequired: true,
                payment,
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Registered successfully.',
            data: reg,
            paymentRequired: false,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/events/:id/registrations
exports.getEventRegistrations = async (req, res) => {
    try {
        const event = await Event.findByPk(req.params.id);
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

        const regs = await EventRegistration.findAll({
            where: { eventId: event.id },
            order: [['createdAt', 'DESC']],
        });

        const plain = regs.map((r) => (r.toJSON ? r.toJSON() : r));
        const userIds = [...new Set(plain.map((r) => r.userId).filter(Boolean))];

        const users = userIds.length
            ? await User.findAll({
                where: { id: { [Op.in]: userIds } },
                attributes: ['id', 'name', 'email', 'studentId', 'phone', 'role'],
            })
            : [];

        const userMap = new Map(users.map((u) => [u.id, u]));

        const data = plain.map((r) => {
            const u = r.userId ? userMap.get(r.userId) : null;
            return {
                ...r,
                user: u
                    ? {
                        _id: u.id,
                        name: u.name,
                        email: u.email,
                        studentId: u.studentId,
                        phone: u.phone,
                        role: u.role,
                    }
                    : null,
            };
        });

        return res.json({ success: true, count: data.length, data });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// PUT /api/events/:eventId/registrations/:regId/payment
exports.updateRegistrationPayment = async (req, res) => {
    try {
        const { eventId, regId } = req.params;

        const reg = await EventRegistration.findByPk(regId);
        if (!reg || String(reg.eventId) !== String(eventId)) {
            return res.status(404).json({ success: false, message: 'Registration not found' });
        }

        const isManagement = req.user && isManagementRole(req.user.role);
        if (reg.userId && !isManagement) {
            if (!req.user || String(req.user.id) !== String(reg.userId)) {
                return res.status(403).json({ success: false, message: 'Not authorized' });
            }
        }

        if (!reg.paymentId) {
            return res.status(400).json({ success: false, message: 'No payment required for this registration' });
        }

        const payment = await Payment.findByPk(reg.paymentId);
        if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });

        const paymentMethod = req.body.paymentMethod;
        const transactionId = String(req.body.transactionId || '').trim();
        const notes = req.body.notes;

        if (!paymentMethod || !transactionId) {
            return res.status(400).json({ success: false, message: 'paymentMethod and transactionId are required' });
        }

        await payment.update({
            paymentMethod,
            transactionId,
            status: 'pending',
            notes: notes !== undefined ? notes : payment.notes,
        });

        if (isManagement && req.body.status && ['paid', 'failed'].includes(req.body.status)) {
            await payment.update({
                status: req.body.status,
                verifiedBy: req.user.id,
                verifiedAt: new Date(),
                paidAt: req.body.status === 'paid' ? new Date() : null,
            });

            await reg.update({
                status: req.body.status === 'paid' ? 'confirmed' : 'cancelled',
            });
        } else {
            await reg.update({
                status: 'pending_payment',
            });
        }

        return res.json({
            success: true,
            message: isManagement && req.body.status === 'paid' ? 'Payment verified and confirmed' : 'Payment submitted',
            data: reg,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ======================= CERTIFICATE MANAGEMENT (REGISTRANTS) =======================

// POST /api/events/:id/registrations/:regId/certificate
exports.issueRegistrationCertificate = async (req, res) => {
    try {
        const { id, regId } = req.params;

        const reg = await EventRegistration.findByPk(regId);
        if (!reg || String(reg.eventId) !== String(id)) {
            return res.status(404).json({ success: false, message: 'Registration not found' });
        }

        if (reg.status !== 'confirmed') {
            return res.status(400).json({ success: false, message: 'Registration must be confirmed' });
        }

        if (reg.certificateIssued) {
            return res.status(400).json({ success: false, message: 'Certificate already issued' });
        }

        const credentialId = `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        await reg.update({
            certificateIssued: true,
            credentialId,
            certificateIssuedAt: new Date(),
        });

        // ✅ NEW: Send email notification
        try {
            const event = await Event.findByPk(id);

            await sendEmail({
                to: reg.email,
                subject: `🎉 Your Certificate is Ready - ${event.title}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                            <h1 style="color: white; margin: 0;">🎉 Certificate Issued!</h1>
                        </div>
                        
                        <div style="padding: 30px; background: #f9f9f9;">
                            <p style="color: #333; font-size: 16px;">Hi ${reg.name},</p>
                            
                            <p style="color: #666;">Congratulations! Your certificate for attending <strong>${event.title}</strong> has been issued.</p>
                            
                            <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px solid #667eea;">
                                <p style="margin: 5px 0; color: #333;"><strong>📜 Credential ID:</strong> <code style="background: #f0f0f0; padding: 2px 8px; border-radius: 4px;">${credentialId}</code></p>
                                <p style="margin: 5px 0; color: #333;"><strong>🎓 Event:</strong> ${event.title}</p>
                                <p style="margin: 5px 0; color: #333;"><strong>📅 Date:</strong> ${new Date(event.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                <p style="margin: 5px 0; color: #333;"><strong>📍 Location:</strong> ${event.location}</p>
                            </div>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${process.env.CLIENT_URL}/dashboard/certificates" 
                                   style="display: inline-block; background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.4);">
                                    📥 View & Download Certificate
                                </a>
                            </div>
                            
                            <div style="background: #e8f4f8; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea; margin-top: 20px;">
                                <p style="margin: 0; color: #555; font-size: 14px;">
                                    <strong>🔐 Verify Your Certificate:</strong><br>
                                    Anyone can verify this certificate at:<br>
                                    <a href="${process.env.CLIENT_URL}/verify/${credentialId}" style="color: #667eea; word-break: break-all;">
                                        ${process.env.CLIENT_URL}/verify/${credentialId}
                                    </a>
                                </p>
                            </div>
                            
                            <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
                                You received this email because you participated in a JUST Debate Club event.<br>
                                JUST Debate Club © ${new Date().getFullYear()}
                            </p>
                        </div>
                    </div>
                `,
            });

            console.log('✅ Certificate notification sent to:', reg.email);
        } catch (emailError) {
            console.error('❌ Failed to send certificate email:', emailError);
        }

        return res.json({
            success: true,
            message: 'Certificate issued successfully',
            data: reg,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// DELETE /api/events/:id/registrations/:regId/certificate
exports.revokeRegistrationCertificate = async (req, res) => {
    try {
        const { id, regId } = req.params;

        const reg = await EventRegistration.findByPk(regId);
        if (!reg || String(reg.eventId) !== String(id)) {
            return res.status(404).json({ success: false, message: 'Registration not found' });
        }

        if (!reg.certificateIssued) {
            return res.status(400).json({ success: false, message: 'Certificate not issued yet' });
        }

        await reg.update({
            certificateIssued: false,
            credentialId: null,
            certificateIssuedAt: null,
            certificateUrl: null,
        });

        return res.json({
            success: true,
            message: 'Certificate revoked successfully',
            data: reg,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/events/:id/registrations/bulk-certificate
exports.bulkIssueCertificates = async (req, res) => {
    try {
        const { id } = req.params;
        const event = await Event.findByPk(id);

        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        const regs = await EventRegistration.findAll({
            where: {
                eventId: id,
                status: 'confirmed',
                certificateIssued: false,
            },
        });

        let issuedCount = 0;
        let emailSentCount = 0;

        for (const reg of regs) {
            const credentialId = `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

            await reg.update({
                certificateIssued: true,
                credentialId,
                certificateIssuedAt: new Date(),
            });

            issuedCount++;

            // ✅ Send email notification
            try {
                await sendEmail({
                    to: reg.email,
                    subject: `🎉 Your Certificate is Ready - ${event.title}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                                <h1 style="color: white; margin: 0;">🎉 Certificate Issued!</h1>
                            </div>
                            
                            <div style="padding: 30px; background: #f9f9f9;">
                                <p style="color: #333; font-size: 16px;">Hi ${reg.name},</p>
                                
                                <p style="color: #666;">Congratulations! Your certificate for attending <strong>${event.title}</strong> has been issued.</p>
                                
                                <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px solid #667eea;">
                                    <p style="margin: 5px 0; color: #333;"><strong>📜 Credential ID:</strong> <code style="background: #f0f0f0; padding: 2px 8px; border-radius: 4px;">${credentialId}</code></p>
                                    <p style="margin: 5px 0; color: #333;"><strong>🎓 Event:</strong> ${event.title}</p>
                                    <p style="margin: 5px 0; color: #333;"><strong>📅 Date:</strong> ${new Date(event.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                </div>
                                
                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="${process.env.CLIENT_URL}/dashboard/certificates" 
                                       style="display: inline-block; background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                                        📥 View & Download Certificate
                                    </a>
                                </div>
                                
                                <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
                                    Verify at: ${process.env.CLIENT_URL}/verify/${credentialId}
                                </p>
                            </div>
                        </div>
                    `,
                });

                emailSentCount++;
                console.log(`✅ Certificate notification sent to: ${reg.email}`);
            } catch (emailError) {
                console.error(`❌ Failed to send certificate email to ${reg.email}:`, emailError.message);
            }
        }

        return res.json({
            success: true,
            message: `Issued ${issuedCount} certificate(s). Email notifications sent to ${emailSentCount} recipient(s).`,
            data: { issuedCount, emailSentCount },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/events/:id/registrations/bulk-revoke
exports.bulkRevokeCertificates = async (req, res) => {
    try {
        const { id } = req.params;

        const regs = await EventRegistration.findAll({
            where: {
                eventId: id,
                certificateIssued: true,
            },
        });

        let revokedCount = 0;

        for (const reg of regs) {
            await reg.update({
                certificateIssued: false,
                credentialId: null,
                certificateIssuedAt: null,
                certificateUrl: null,
            });

            revokedCount++;
        }

        return res.json({
            success: true,
            message: `Revoked ${revokedCount} certificate(s)`,
            data: { revokedCount },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ======================= CERTIFICATE MANAGEMENT (TEAM MEMBERS) =======================

// POST /api/events/:id/team/:participantIndex/certificate
exports.issueTeamCertificate = async (req, res) => {
    try {
        const { id, participantIndex } = req.params;
        const event = await Event.findByPk(id);

        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        const participants = event.participants || [];
        const idx = parseInt(participantIndex);

        if (idx < 0 || idx >= participants.length) {
            return res.status(400).json({ success: false, message: 'Invalid participant index' });
        }

        const participant = participants[idx];

        if (!participant.credentialId) {
            participant.credentialId = `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        }

        participant.certificateIssued = true;
        participant.certificateIssuedAt = new Date();

        event.participants = participants;
        await event.save();

        // ✅ NEW: Send email to team member if they have email
        try {
            let recipientEmail = null;
            let recipientName = participant.name;

            if (participant.type === 'internal' && participant.userId) {
                const user = await User.findByPk(participant.userId, { attributes: ['email', 'name'] });
                if (user) {
                    recipientEmail = user.email;
                    recipientName = user.name;
                }
            } else if (participant.type === 'external' && participant.name) {
                // For external, we don't have email stored, skip email
                recipientEmail = null;
            }

            if (recipientEmail) {
                await sendEmail({
                    to: recipientEmail,
                    subject: `🎉 Your ${participant.role || 'Team'} Certificate - ${event.title}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                                <h1 style="color: white; margin: 0;">🎉 Certificate Issued!</h1>
                            </div>
                            
                            <div style="padding: 30px; background: #f9f9f9;">
                                <p style="color: #333; font-size: 16px;">Hi ${recipientName},</p>
                                
                                <p style="color: #666;">Congratulations! Your certificate as <strong>${participant.role || 'team member'}</strong> for <strong>${event.title}</strong> has been issued.</p>
                                
                                <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px solid #667eea;">
                                    <p style="margin: 5px 0; color: #333;"><strong>📜 Credential ID:</strong> <code style="background: #f0f0f0; padding: 2px 8px; border-radius: 4px;">${participant.credentialId}</code></p>
                                    <p style="margin: 5px 0; color: #333;"><strong>🎭 Role:</strong> ${participant.role || 'Team Member'}</p>
                                    <p style="margin: 5px 0; color: #333;"><strong>🎓 Event:</strong> ${event.title}</p>
                                    <p style="margin: 5px 0; color: #333;"><strong>📅 Date:</strong> ${new Date(event.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                </div>
                                
                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="${process.env.CLIENT_URL}/dashboard/certificates" 
                                       style="display: inline-block; background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                                        📥 View & Download Certificate
                                    </a>
                                </div>
                                
                                <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
                                    JUST Debate Club © ${new Date().getFullYear()}
                                </p>
                            </div>
                        </div>
                    `,
                });

                console.log(`✅ Team certificate notification sent to: ${recipientEmail}`);
            }
        } catch (emailError) {
            console.error('❌ Failed to send team certificate email:', emailError);
        }

        return res.json({
            success: true,
            message: 'Certificate issued to team member',
            data: participant,
        });
    } catch (error) {
        console.error('Error issuing team certificate:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to issue certificate',
            error: error.message,
        });
    }
};

// DELETE /api/events/:id/team/:participantIndex/certificate
exports.revokeTeamCertificate = async (req, res) => {
    try {
        const { id, participantIndex } = req.params;
        const event = await Event.findByPk(id);

        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        const participants = event.participants || [];
        const idx = parseInt(participantIndex);

        if (idx < 0 || idx >= participants.length) {
            return res.status(400).json({ success: false, message: 'Invalid participant index' });
        }

        const participant = participants[idx];

        participant.certificateIssued = false;
        participant.certificateIssuedAt = null;
        participant.credentialId = null;

        event.participants = participants;
        await event.save();

        return res.json({
            success: true,
            message: 'Certificate revoked from team member',
            data: participant,
        });
    } catch (error) {
        console.error('Error revoking team certificate:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to revoke certificate',
            error: error.message,
        });
    }
};

// POST /api/events/:id/team/bulk-certificate
exports.bulkIssueTeamCertificates = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        const event = await Event.findByPk(id);

        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        let participants = event.participants || [];
        let issuedCount = 0;
        let emailSentCount = 0;

        for (let i = 0; i < participants.length; i++) {
            const p = participants[i];

            if (role && p.role !== role) continue;
            if (p.certificateIssued) continue;

            if (!p.credentialId) {
                p.credentialId = `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
            }
            p.certificateIssued = true;
            p.certificateIssuedAt = new Date();
            issuedCount++;

            // Send email to internal members only
            if (p.type === 'internal' && p.userId) {
                try {
                    const user = await User.findByPk(p.userId, { attributes: ['email', 'name'] });
                    if (user && user.email) {
                        await sendEmail({
                            to: user.email,
                            subject: `🎉 Your ${p.role || 'Team'} Certificate - ${event.title}`,
                            html: `
                                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                                        <h1 style="color: white; margin: 0;">🎉 Certificate Issued!</h1>
                                    </div>
                                    
                                    <div style="padding: 30px; background: #f9f9f9;">
                                        <p style="color: #333; font-size: 16px;">Hi ${user.name},</p>
                                        
                                        <p style="color: #666;">Your certificate as <strong>${p.role || 'team member'}</strong> for <strong>${event.title}</strong> has been issued.</p>
                                        
                                        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
                                            <p style="margin: 5px 0; color: #333;"><strong>📜 Credential ID:</strong> ${p.credentialId}</p>
                                            <p style="margin: 5px 0; color: #333;"><strong>🎭 Role:</strong> ${p.role || 'Team Member'}</p>
                                        </div>
                                        
                                        <div style="text-align: center; margin: 30px 0;">
                                            <a href="${process.env.CLIENT_URL}/dashboard/certificates" 
                                               style="display: inline-block; background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                                                📥 View Certificate
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            `,
                        });
                        emailSentCount++;
                    }
                } catch (emailError) {
                    console.error(`❌ Failed to send team certificate to user ${p.userId}`);
                }
            }
        }

        event.participants = participants;
        await event.save();

        return res.json({
            success: true,
            message: `Issued ${issuedCount} certificate(s) to team members. Email sent to ${emailSentCount} member(s).`,
            data: { issuedCount, emailSentCount },
        });
    } catch (error) {
        console.error('Error bulk issuing team certificates:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to issue certificates',
            error: error.message,
        });
    }
};
