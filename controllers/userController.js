// controllers/userController.js
const { Op } = require('sequelize');
const User = require('../models/User');
const EventRegistration = require('../models/EventRegistration'); // ✅ ADD
const Event = require('../models/Event'); // ✅ ADD

const MANAGEMENT_ROLES = ['admin', 'moderator', 'president', 'general_secretary'];

const canViewUser = (viewer, targetId) => {
    if (!viewer) return false;
    if (String(viewer.id) === String(targetId)) return true;
    if (MANAGEMENT_ROLES.includes(viewer.role)) return true;
    return false;
};

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin/Moderator/President/GS
exports.getAllUsers = async (req, res) => {
    try {
        const { role, membershipStatus, search } = req.query;

        const where = {};
        if (role) where.role = role;
        if (membershipStatus) where.membershipStatus = membershipStatus;

        if (search) {
            where[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } },
                { studentId: { [Op.like]: `%${search}%` } }
            ];
        }

        const users = await User.findAll({
            where,
            order: [['createdAt', 'DESC']]
        });

        return res.status(200).json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        return res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private (self or management)
exports.getUser = async (req, res) => {
    try {
        if (!canViewUser(req.user, req.params.id)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this user'
            });
        }

        const user = await User.findByPk(req.params.id);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        return res.status(200).json({ success: true, data: user });
    } catch (error) {
        console.error('Error fetching user:', error);
        return res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// ✅ FIXED: Get user's certificates
// @desc    Get my certificates
// @route   GET /api/users/my-certificates
// @access  Private
exports.getMyCertificates = async (req, res) => {
    try {
        const userId = req.user.id;

        // ✅ REMOVED: const { EventRegistration, Event } = require('../models');
        // Models are now imported at the top of the file

        // Find all registrations with certificates for this user
        const certificates = await EventRegistration.findAll({
            where: {
                userId,
                certificateIssued: true,
            },
            include: [
                {
                    model: Event,
                    as: 'event',
                    attributes: ['id', 'title', 'date', 'location', 'category'],
                },
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'email'],
                },
            ],
            order: [['certificateIssuedAt', 'DESC']],
        });

        return res.json({
            success: true,
            count: certificates.length,
            data: certificates,
        });
    } catch (error) {
        console.error('Error fetching my certificates:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while fetching certificates',
            error: error.message,
        });
    }
};

// @desc    Update user role
// @route   PUT /api/users/:id/role
// @access  Private/Admin/President/GS
exports.updateUserRole = async (req, res) => {
    try {
        const { role } = req.body;

        const validRoles = [
            'user',
            'member',
            'executive_member',
            'general_secretary',
            'president',
            'moderator',
            'admin'
        ];

        if (!validRoles.includes(role)) {
            return res.status(400).json({ success: false, message: 'Invalid role' });
        }

        const targetUser = await User.findByPk(req.params.id);

        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Prevent self role change
        if (String(req.user.id) === String(targetUser.id)) {
            return res.status(400).json({
                success: false,
                message: 'You cannot change your own role'
            });
        }

        // Only admin can assign admin role
        if (role === 'admin' && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admin can assign admin role'
            });
        }

        targetUser.role = role;
        await targetUser.save();

        return res.status(200).json({
            success: true,
            message: 'User role updated successfully',
            data: targetUser
        });
    } catch (error) {
        console.error('Error updating user role:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update user role',
            error: error.message
        });
    }
};

// @desc    Update membership status
// @route   PUT /api/users/:id/membership
// @access  Private/Admin/Moderator/President/GS
exports.updateMembershipStatus = async (req, res) => {
    try {
        const { membershipStatus } = req.body;

        const validStatuses = ['pending', 'approved', 'rejected', 'inactive'];
        if (!validStatuses.includes(membershipStatus)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid membership status'
            });
        }

        const targetUser = await User.findByPk(req.params.id);
        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        targetUser.membershipStatus = membershipStatus;

        if (membershipStatus === 'approved') {
            targetUser.membershipDate = new Date();
            if (targetUser.role === 'user') targetUser.role = 'member';
        }

        await targetUser.save();

        return res.status(200).json({
            success: true,
            message: 'Membership status updated successfully',
            data: targetUser
        });
    } catch (error) {
        console.error('Error updating membership status:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update membership status',
            error: error.message
        });
    }
};

// @desc    Update user profile
// @route   PUT /api/users/:id
// @access  Private (self) or Admin
exports.updateUser = async (req, res) => {
    try {
        const targetUser = await User.findByPk(req.params.id);

        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (String(req.user.id) !== String(targetUser.id) && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this user'
            });
        }

        const allowedUpdates = ['name', 'phone', 'department', 'batch', 'studentId', 'avatar'];
        allowedUpdates.forEach((field) => {
            if (req.body[field] !== undefined) targetUser[field] = req.body[field];
        });

        await targetUser.save();

        return res.status(200).json({
            success: true,
            message: 'User updated successfully',
            data: targetUser
        });
    } catch (error) {
        console.error('Error updating user:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update user',
            error: error.message
        });
    }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
    try {
        const targetUser = await User.findByPk(req.params.id);

        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (String(req.user.id) === String(targetUser.id)) {
            return res.status(400).json({
                success: false,
                message: 'You cannot delete your own account'
            });
        }

        await targetUser.destroy();

        return res.status(200).json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete user',
            error: error.message
        });
    }
};

// @desc    Get dashboard stats based on role
// @route   GET /api/users/dashboard/stats
// @access  Private
exports.getDashboardStats = async (req, res) => {
    try {
        const stats = {};

        stats.totalMembers = await User.count({
            where: {
                role: {
                    [Op.in]: ['member', 'executive_member', 'general_secretary', 'president', 'moderator', 'admin']
                }
            }
        });

        if (['admin', 'moderator', 'president', 'general_secretary'].includes(req.user.role)) {
            stats.totalUsers = await User.count();
            stats.pendingMemberships = await User.count({ where: { membershipStatus: 'pending' } });

            stats.activeMembers = await User.count({
                where: {
                    role: {
                        [Op.in]: [
                            'member',
                            'executive_member',
                            'general_secretary',
                            'president',
                            'moderator',
                            'admin'
                        ]
                    },
                    isActive: true
                }
            });

            stats.inactiveMembers = await User.count({ where: { isActive: false } });
        }

        return res.status(200).json({ success: true, data: stats });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        return res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};
