const Event = require('../models/Event');
const { validationResult } = require('express-validator');


// @desc    Get all events
// @route   GET /api/events
// @access  Public
exports.getAllEvents = async (req, res) => {
    try {
        const { search, category, status } = req.query;
        let query = {};


        // Search by title or description
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }


        // Filter by category
        if (category) {
            query.category = category;
        }


        // Filter by status
        if (status) {
            query.status = status;
        }


        const events = await Event.find(query)
            .populate('createdBy', 'name email')
            .sort({ date: -1 });


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


// @desc    Get single event
// @route   GET /api/events/:id
// @access  Public
exports.getEvent = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate('createdBy', 'name email');


        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }


        res.json({
            success: true,
            data: event
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
        req.body.createdBy = req.user.id;


        const event = await Event.create(req.body);


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
        let event = await Event.findById(req.params.id);


        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }


        event = await Event.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });


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
        const event = await Event.findById(req.params.id);


        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }


        await event.deleteOne();


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
        const events = await Event.find({
            date: { $gte: new Date() },
            status: 'upcoming'
        })
            .sort({ date: 1 })
            .limit(10);


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
