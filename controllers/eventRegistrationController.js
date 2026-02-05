// controllers/eventRegistrationController.js
const { Op } = require('sequelize');

const Event = require('../models/Event');
const EventRegistration = require('../models/EventRegistration');
const Payment = require('../models/Payment');
const User = require('../models/User');

const MANAGEMENT_ROLES = ['admin', 'moderator', 'president', 'general_secretary'];

const isManagement = (user) => user && MANAGEMENT_ROLES.includes(user.role);

const normalizeEmail = (v) => String(v || '').toLowerCase().trim();

const safeStr = (v) => {
    const s = String(v ?? '').trim();
    return s.length ? s : null;
};

// ✅ POST /api/events/:id/register (guest OR logged-in)
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

        // Build snapshot
        let payload = {
            eventId: event.id,
            amount: fee,
            status: fee > 0 ? 'pending_payment' : 'confirmed',
            paymentId: null,
        };

        if (req.user) {
            const u = req.user;
            payload.type = 'internal';
            payload.userId = u.id;
            payload.name = u.name || 'Member';
            payload.email = normalizeEmail(u.email);
            payload.phone = safeStr(u.phone);
            payload.studentId = safeStr(u.studentId);
            payload.department = safeStr(u.department);
            payload.batch = safeStr(u.batch);
            payload.organization = null;
        } else {
            const name = String(req.body.name || '').trim();
            const email = normalizeEmail(req.body.email);
            const phone = safeStr(req.body.phone);
            const organization = safeStr(req.body.organization);

            if (!name || !email) {
                return res.status(400).json({
                    success: false,
                    message: 'name and email are required for guest registration',
                });
            }

            payload.type = 'guest';
            payload.userId = null;
            payload.name = name;
            payload.email = email;
            payload.phone = phone;
            payload.organization = organization;
            payload.studentId = safeStr(req.body.studentId);
            payload.department = safeStr(req.body.department);
            payload.batch = safeStr(req.body.batch);
        }

        const reg = await EventRegistration.create(payload);

        // If fee > 0, create Payment row (type=event)
        if (fee > 0) {
            const payment = await Payment.create({
                userId: reg.userId || null,
                eventId: event.id,
                eventRegistrationId: reg.id,
                amount: fee,
                type: 'event',
                status: 'pending',
                paymentMethod: null,
                transactionId: null,
                notes: `Event registration for "${event.title}"`,
            });

            await reg.update({ paymentId: payment.id });

            return res.status(201).json({
                success: true,
                message: 'Registered. Payment required to confirm.',
                paymentRequired: true,
                amount: fee,
                data: { ...(reg.toJSON ? reg.toJSON() : reg), paymentId: payment.id },
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Registered successfully.',
            paymentRequired: false,
            amount: 0,
            data: reg,
        });
    } catch (error) {
        if (error?.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({
                success: false,
                message: 'Already registered for this event (duplicate email/user).',
            });
        }
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ✅ PUT /api/events/:eventId/registrations/:regId/payment
exports.submitRegistrationPayment = async (req, res) => {
    try {
        const { eventId, regId } = req.params;

        const reg = await EventRegistration.findByPk(regId);
        if (!reg || String(reg.eventId) !== String(eventId)) {
            return res.status(404).json({ success: false, message: 'Registration not found' });
        }

        const mgmt = isManagement(req.user);

        if (reg.userId && !mgmt) {
            if (!req.user || String(req.user.id) !== String(reg.userId)) {
                return res.status(403).json({ success: false, message: 'Not authorized' });
            }
        }

        if (!reg.paymentId) {
            return res.status(400).json({ success: false, message: 'No payment required for this registration' });
        }

        const paymentMethod = req.body.paymentMethod;
        const transactionId = String(req.body.transactionId || '').trim();

        if (!paymentMethod || !transactionId) {
            return res.status(400).json({
                success: false,
                message: 'paymentMethod and transactionId are required',
            });
        }

        const payment = await Payment.findByPk(reg.paymentId);
        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment record not found' });
        }

        await payment.update({
            paymentMethod,
            transactionId,
            status: 'pending',
        });

        await reg.update({ status: 'pending_payment' });

        return res.json({
            success: true,
            message: 'Payment submitted. Waiting for verification.',
            data: reg,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ✅ GET /api/events/:id/registrations (management)
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

// ✅ PUT /api/events/:eventId/registrations/:regId/verify (management)
exports.verifyRegistrationPayment = async (req, res) => {
    try {
        const { eventId, regId } = req.params;
        const { status } = req.body; // paid / failed

        if (!['paid', 'failed'].includes(status)) {
            return res.status(400).json({ success: false, message: 'status must be "paid" or "failed"' });
        }

        const reg = await EventRegistration.findByPk(regId);
        if (!reg || String(reg.eventId) !== String(eventId)) {
            return res.status(404).json({ success: false, message: 'Registration not found' });
        }

        if (!reg.paymentId) {
            return res.status(400).json({ success: false, message: 'No payment linked for this registration' });
        }

        const payment = await Payment.findByPk(reg.paymentId);
        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment record not found' });
        }

        await payment.update({
            status,
            verifiedBy: req.user.id,
            verifiedAt: new Date(),
            paidAt: status === 'paid' ? new Date() : null,
        });

        await reg.update({
            status: status === 'paid' ? 'confirmed' : 'pending_payment',
        });

        return res.json({
            success: true,
            message: status === 'paid' ? 'Registration confirmed' : 'Payment marked as failed',
            data: reg,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ✅ POST /api/events/:eventId/registrations/:regId/issue-certificate (management)
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

        const credentialId = `JDC-${eventId}-${regId}-${Date.now()}`;

        await reg.update({
            credentialId,
            certificateIssued: true,
        });

        return res.json({
            success: true,
            message: 'Certificate issued',
            credentialId,
            data: reg,
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
