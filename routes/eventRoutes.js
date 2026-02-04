const express = require('express');
const router = express.Router();
const {
    getAllEvents,
    getEvent,
    createEvent,
    updateEvent,
    deleteEvent,
} = require('../controllers/eventController');
const { protect, admin } = require('../middleware/auth');
const upload = require('../middleware/uploadMiddleware');

// Public routes
router.get('/', getAllEvents);
router.get('/:id', getEvent);

// Admin routes (protected)
router.post('/', protect, admin, upload.single('image'), createEvent);
router.put('/:id', protect, admin, upload.single('image'), updateEvent);
router.delete('/:id', protect, admin, deleteEvent);

module.exports = router;
