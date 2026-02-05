// routes/userRoutes.js
const express = require('express');
const router = express.Router();

const {
    getAllUsers,
    getUser,
    updateUserRole,
    updateMembershipStatus,
    updateUser,
    deleteUser,
    getDashboardStats,
    getMyCertificates, // ✅ KEEP THIS
} = require('../controllers/userController');

const { protect } = require('../middleware/auth');
const { authorize, isAdminOrModerator, canChangeRoles } = require('../middleware/roleMiddleware');

// ❌ REMOVE THIS LINE IF YOU ADDED IT:
// const { EventRegistration, Event, User } = require('../models');

// Dashboard stats
router.get('/dashboard/stats', protect, getDashboardStats);

// My certificates
router.get('/my-certificates', protect, getMyCertificates);

// User management
router.get('/', protect, isAdminOrModerator, getAllUsers);
router.get('/:id', protect, getUser);
router.put('/:id', protect, updateUser);
router.delete('/:id', protect, authorize('admin'), deleteUser);

// Role and membership management
router.put('/:id/role', protect, canChangeRoles, updateUserRole);
router.put('/:id/membership', protect, isAdminOrModerator, updateMembershipStatus);

module.exports = router;
