// controllers/eventController.js
const Event = require('../models/Event');
const EventRegistration = require('../models/EventRegistration');
const Payment = require('../models/Payment');
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

const normalizeEmail = (email) => String(email || '').toLowerCase().trim();

const isManagementRole = (role) => ['admin', 'moderator', 'president', 'general_secretary'].includes(role);

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

// ======================= ✅ NEW: REGISTRATION + PAYMENT + CERT =======================

// POST /api/events/:id/register  (guest OR logged-in)
// Rules:
// - event.accessType == inter_club => must be logged in
// - event.registrationFee == 0 => auto confirmed
// - if fee > 0 => create Payment(type='event') + reg pending_payment
exports.registerForEvent = async (req, res) => {
    try {
        const event = await Event.findByPk(req.params.id);
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

        if (!event.registrationOpen) {
            return res.status(400).json({ success: false, message: 'Registration is closed for this event' });
        }

        // inter club => login required
        if (event.accessType === 'inter_club' && !req.user) {
            return res.status(401).json({ success: false, message: 'Login required for this event' });
        }

        const fee = Number(event.registrationFee || 0);

        // duplicate check
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

        // guest fields
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
        });

        // If fee > 0 create payment record linked
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
                data: { registration: reg, paymentRequired: true, payment },
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Registered successfully.',
            data: { registration: reg, paymentRequired: false },
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

        // attach user snapshot for internal
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

// PUT /api/events/:eventId/registrations/:regId/payment (guest/user submit tx)
exports.submitRegistrationPayment = async (req, res) => {
    try {
        const { eventId, regId } = req.params;

        const reg = await EventRegistration.findByPk(regId);
        if (!reg || String(reg.eventId) !== String(eventId)) {
            return res.status(404).json({ success: false, message: 'Registration not found' });
        }

        // ownership:
        // - internal => only the owner OR management
        // - guest => allow (guest has no auth)
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

        await reg.update({
            status: 'pending_payment',
        });

        return res.json({
            success: true,
            message: 'Payment submitted. Waiting for verification.',
            data: { registration: reg, payment },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// PUT /api/events/:eventId/registrations/:regId/verify (management verify paid/failed)
exports.verifyRegistrationPayment = async (req, res) => {
    try {
        const { eventId, regId } = req.params;
        const { status, notes } = req.body; // 'paid' or 'failed'

        if (!['paid', 'failed'].includes(status)) {
            return res.status(400).json({ success: false, message: 'status must be paid or failed' });
        }

        const reg = await EventRegistration.findByPk(regId);
        if (!reg || String(reg.eventId) !== String(eventId)) {
            return res.status(404).json({ success: false, message: 'Registration not found' });
        }

        if (!reg.paymentId) {
            return res.status(400).json({ success: false, message: 'No payment linked' });
        }

        const payment = await Payment.findByPk(reg.paymentId);
        if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });

        if (['paid', 'failed', 'refunded'].includes(payment.status)) {
            return res.status(400).json({ success: false, message: `Payment already finalized as "${payment.status}"` });
        }

        await payment.update({
            status,
            verifiedBy: req.user.id,
            verifiedAt: new Date(),
            paidAt: status === 'paid' ? new Date() : null,
            notes: notes !== undefined ? notes : payment.notes,
        });

        await reg.update({
            status: status === 'paid' ? 'confirmed' : 'pending_payment',
        });

        return res.json({
            success: true,
            message: status === 'paid' ? 'Registration confirmed' : 'Payment marked as failed',
            data: { registration: reg, payment },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/events/:eventId/registrations/:regId/issue-certificate (management)
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

        // simple credential id (later we use QR with this)
        const credentialId = `JDC-${eventId}-${regId}-${Date.now()}`;

        await reg.update({
            certificateIssued: true,
            certificateUrl: reg.certificateUrl || null,
            attendanceStatus: reg.attendanceStatus === 'unknown' ? 'present' : reg.attendanceStatus,
            credentialId,
        });

        return res.json({
            success: true,
            message: 'Certificate issued (placeholder). Next step: PDF generator.',
            data: reg,
            credentialId,
            qrPayload: JSON.stringify({ credentialId, eventId: Number(eventId), regId: Number(regId) }),
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
