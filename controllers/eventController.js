const Event = require('../models/Event');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');

// helper to attach createdBy user (like populate)
const attachCreatedBy = async (events) => {
    if (!events) return events;

    // single event
    if (!Array.isArray(events)) {
        const creator = await User.findByPk(events.createdBy, {
            attributes: ['id', 'name', 'email']
        });

        const data = events.toJSON ? events.toJSON() : events;
        return {
            ...data,
            createdBy: creator
                ? { _id: creator.id, name: creator.name, email: creator.email }
                : null
        };
    }

    // list
    const creatorIds = [...new Set(events.map((e) => e.createdBy).filter(Boolean))];

    const creators = await User.findAll({
        where: { id: { [Op.in]: creatorIds } },
        attributes: ['id', 'name', 'email']
    });

    const creatorMap = new Map(creators.map((u) => [u.id, u]));

    return events.map((ev) => {
        const data = ev.toJSON ? ev.toJSON() : ev;
        const c = creatorMap.get(ev.createdBy);
        return {
            ...data,
            createdBy: c ? { _id: c.id, name: c.name, email: c.email } : null
        };
    });
};

// @desc    Get all events
// @route   GET /api/events
// @access  Public
exports.getAllEvents = async (req, res) => {
    try {
        const { search, category, status } = req.query;

        const where = {};

        // Search by title or description (LIKE search)
        if (search) {
            where[Op.or] = [
                { title: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } }
            ];
        }

        // Filter by category
        if (category) where.category = category;

        // Filter by status
        if (status) where.status = status;

        const events = await Event.findAll({
            where,
            order: [['date', 'DESC']]
        });

        const data = await attachCreatedBy(events);

        res.json({
            success: true,
            count: data.length,
            data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Get single event
// @route   GET /api/events/:id
// @access  Public
exports.getEvent = async (req, res) => {
    try {
        const event = await Event.findByPk(req.params.id);

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        const data = await attachCreatedBy(event);

        res.json({
            success: true,
            data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Create new event
// @route   POST /api/events
// @access  Private (Admin only)
exports.createEvent = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        // Add user to req.body
        const payload = {
            ...req.body,
            createdBy: req.user.id
        };

        const event = await Event.create(payload);

        res.status(201).json({
            success: true,
            message: 'Event created successfully',
            data: event
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Update event
// @route   PUT /api/events/:id
// @access  Private (Admin only)
exports.updateEvent = async (req, res) => {
    try {
        const event = await Event.findByPk(req.params.id);

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        await event.update(req.body);

        res.json({
            success: true,
            message: 'Event updated successfully',
            data: event
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Delete event
// @route   DELETE /api/events/:id
// @access  Private (Admin only)
exports.deleteEvent = async (req, res) => {
    try {
        const event = await Event.findByPk(req.params.id);

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        await event.destroy();

        res.json({
            success: true,
            message: 'Event deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Get upcoming events
// @route   GET /api/events/upcoming
// @access  Public
exports.getUpcomingEvents = async (req, res) => {
    try {
        const today = new Date();

        const events = await Event.findAll({
            where: {
                date: { [Op.gte]: today },
                status: 'upcoming'
            },
            order: [['date', 'ASC']],
            limit: 10
        });

        res.json({
            success: true,
            count: events.length,
            data: events
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
