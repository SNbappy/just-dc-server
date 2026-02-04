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
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { authorize, isAdminOrModerator, canChangeRoles } = require('../middleware/roleMiddleware');

// Dashboard stats
router.get('/dashboard/stats', protect, getDashboardStats);

// User management routes
router.get('/', protect, isAdminOrModerator, getAllUsers);
router.get('/:id', protect, getUser);
router.put('/:id', protect, updateUser);
router.delete('/:id', protect, authorize('admin'), deleteUser);

// Role and membership management (only Admin, President, GS can change roles)
router.put('/:id/role', protect, canChangeRoles, updateUserRole);
router.put('/:id/membership', protect, isAdminOrModerator, updateMembershipStatus);

module.exports = router;
