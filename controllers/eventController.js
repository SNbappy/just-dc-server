const Event = require('../models/Event');
const EventRegistration = require('../models/EventRegistration');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');

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

// ======================= EVENTS (existing) =======================

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

// POST /api/events (Admin/President/GS)
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

        res.status(201).json({ success: true, message: 'Event created successfully', data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// PUT /api/events/:id (Admin/President/GS)
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

// DELETE /api/events/:id (Admin/President/GS)
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

// ======================= ✅ NEW: REGISTRATION =======================

// POST /api/events/:id/register  (guest OR logged-in)
// Rules:
// - if event.accessType == inter_club => must be logged in
// - if registrationFee == 0 => auto confirmed
// - if fee > 0 => status pending + paymentStatus pending (user enters tx later)
exports.registerForEvent = async (req, res) => {
    try {
        const event = await Event.findByPk(req.params.id);
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

        if (!event.registrationOpen) {
            return res.status(400).json({ success: false, message: 'Registration is closed for this event' });
        }

        // inter-club requires login
        if (event.accessType === 'inter_club' && !req.user) {
            return res.status(401).json({ success: false, message: 'Login required for this event' });
        }

        const fee = Number(event.registrationFee || 0);

        // If logged in: prevent duplicate user registration
        if (req.user) {
            const existing = await EventRegistration.findOne({
                where: { eventId: event.id, userId: req.user.id },
            });
            if (existing) {
                return res.status(400).json({ success: false, message: 'You are already registered for this event' });
            }
        }

        // If guest: require guestName + guestEmail (basic)
        if (!req.user) {
            const guestName = String(req.body.guestName || '').trim();
            const guestEmail = String(req.body.guestEmail || '').trim();

            if (!guestName || !guestEmail) {
                return res.status(400).json({
                    success: false,
                    message: 'Guest name and email are required',
                });
            }
        }

        const reg = await EventRegistration.create({
            eventId: event.id,
            userId: req.user ? req.user.id : null,
            guestName: req.user ? null : String(req.body.guestName || '').trim(),
            guestEmail: req.user ? null : String(req.body.guestEmail || '').trim(),
            guestPhone: req.user ? null : String(req.body.guestPhone || '').trim(),
            amount: fee,
            status: fee > 0 ? 'pending' : 'confirmed',
            paymentStatus: fee > 0 ? 'pending' : 'none',
        });

        return res.status(201).json({
            success: true,
            message: fee > 0 ? 'Registered. Payment required to confirm.' : 'Registered successfully.',
            data: reg,
            paymentRequired: fee > 0,
            amount: fee,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/events/:id/registrations (management)
exports.getEventRegistrations = async (req, res) => {
    try {
        const event = await Event.findByPk(req.params.id);
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

        const regs = await EventRegistration.findAll({
            where: { eventId: event.id },
            order: [['createdAt', 'DESC']],
        });

        // attach internal user info
        const plain = regs.map((r) => (r.toJSON ? r.toJSON() : r));
        const userIds = [...new Set(plain.map((r) => r.userId).filter(Boolean))];

        const users = userIds.length
            ? await User.findAll({
                where: { id: { [Op.in]: userIds } },
                attributes: ['id', 'name', 'email', 'studentId', 'phone', 'role'],
            })
            : [];

        const userMap = new Map(users.map((u) => [u.id, u]));

        const data = plain.map((r) => ({
            ...r,
            user: r.userId
                ? (() => {
                    const u = userMap.get(r.userId);
                    return u
                        ? { _id: u.id, name: u.name, email: u.email, studentId: u.studentId, phone: u.phone, role: u.role }
                        : null;
                })()
                : null,
        }));

        return res.json({ success: true, count: data.length, data });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// PUT /api/events/:eventId/registrations/:regId/payment (guest/user submit tx)
exports.submitRegistrationPayment = async (req, res) => {
    try {
        const { eventId, regId } = req.params;

        const reg = await EventRegistration.findByPk(regId);
        if (!reg || String(reg.eventId) !== String(eventId)) {
            return res.status(404).json({ success: false, message: 'Registration not found' });
        }

        // Ownership check:
        // - if reg.userId exists => only that user OR management can submit
        // - if reg is guest => allow public submission (but they must know regId)
        const isManagement = req.user && ['admin', 'moderator', 'president', 'general_secretary'].includes(req.user.role);
        if (reg.userId && !isManagement) {
            if (!req.user || String(req.user.id) !== String(reg.userId)) {
                return res.status(403).json({ success: false, message: 'Not authorized' });
            }
        }

        const paymentMethod = req.body.paymentMethod;
        const transactionId = String(req.body.transactionId || '').trim();

        if (!paymentMethod || !transactionId) {
            return res.status(400).json({ success: false, message: 'paymentMethod and transactionId are required' });
        }

        await reg.update({
            paymentMethod,
            transactionId,
            paymentStatus: 'pending',
            status: 'pending',
        });

        return res.json({
            success: true,
            message: 'Payment submitted. Waiting for verification.',
            data: reg,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// PUT /api/events/:eventId/registrations/:regId/verify (management verify paid/failed)
exports.verifyRegistrationPayment = async (req, res) => {
    try {
        const { eventId, regId } = req.params;
        const { paymentStatus } = req.body; // 'paid' or 'failed'

        if (!['paid', 'failed'].includes(paymentStatus)) {
            return res.status(400).json({ success: false, message: 'paymentStatus must be paid or failed' });
        }

        const reg = await EventRegistration.findByPk(regId);
        if (!reg || String(reg.eventId) !== String(eventId)) {
            return res.status(404).json({ success: false, message: 'Registration not found' });
        }

        await reg.update({
            paymentStatus,
            status: paymentStatus === 'paid' ? 'confirmed' : 'pending',
        });

        return res.json({
            success: true,
            message: paymentStatus === 'paid' ? 'Registration confirmed' : 'Payment marked as failed',
            data: reg,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/events/:eventId/registrations/:regId/issue-certificate (management)
// Generates credentialId (later QR uses this)
exports.issueCertificate = async (req, res) => {
    try {
        const { eventId, regId } = req.params;

        const reg = await EventRegistration.findByPk(regId);
        if (!reg || String(reg.eventId) !== String(eventId)) {
            return res.status(404).json({ success: false, message: 'Registration not found' });
        }

        if (reg.status !== 'confirmed') {
            return res.status(400).json({ success: false, message: 'Registration must be confirmed to issue certificate' });
        }

        if (reg.certificateIssued) {
            return res.status(400).json({ success: false, message: 'Certificate already issued' });
        }

        // simple credential ID (unique)
        const credentialId = `JDC-${eventId}-${regId}-${Date.now()}`;

        await reg.update({
            credentialId,
            certificateIssued: true,
            certificateIssuedAt: new Date(),
        });

        return res.json({
            success: true,
            message: 'Certificate issued',
            data: reg,
            credentialId,
            // QR payload frontend can encode as QR
            qrPayload: JSON.stringify({
                credentialId,
                eventId: Number(eventId),
                regId: Number(regId),
            }),
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
