const User = require('../models/User');

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
exports.getAllUsers = async (req, res) => {
    try {
        const { role, membershipStatus, search } = req.query;

        const query = {};
        if (role) query.role = role;
        if (membershipStatus) query.membershipStatus = membershipStatus;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { studentId: { $regex: search, $options: 'i' } },
            ];
        }

        const users = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: users.length,
            data: users,
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private
exports.getUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        res.status(200).json({
            success: true,
            data: user,
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};

// @desc    Update user role
// @route   PUT /api/users/:id/role
// @access  Private/Admin
exports.updateUserRole = async (req, res) => {
    try {
        const { role } = req.body;

        // Validate role
        const validRoles = ['user', 'member', 'general_secretary', 'president', 'moderator', 'admin'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role',
            });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // Prevent users from changing their own role
        if (req.user.id === user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'You cannot change your own role',
            });
        }

        user.role = role;
        await user.save();

        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(200).json({
            success: true,
            message: 'User role updated successfully',
            data: userResponse,
        });
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user role',
            error: error.message,
        });
    }
};

// @desc    Update membership status
// @route   PUT /api/users/:id/membership
// @access  Private/Admin/Moderator
exports.updateMembershipStatus = async (req, res) => {
    try {
        const { membershipStatus } = req.body;

        // Validate membership status
        const validStatuses = ['pending', 'approved', 'rejected', 'inactive'];
        if (!validStatuses.includes(membershipStatus)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid membership status',
            });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        user.membershipStatus = membershipStatus;

        // If approved, set membership date and change role to member
        if (membershipStatus === 'approved') {
            user.membershipDate = new Date();
            if (user.role === 'user') {
                user.role = 'member';
            }
        }

        await user.save();

        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(200).json({
            success: true,
            message: 'Membership status updated successfully',
            data: userResponse,
        });
    } catch (error) {
        console.error('Error updating membership status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update membership status',
            error: error.message,
        });
    }
};

// @desc    Update user profile
// @route   PUT /api/users/:id
// @access  Private
exports.updateUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // Users can only update their own profile unless they're admin
        if (req.user.id !== user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this user',
            });
        }

        // Update allowed fields
        const allowedUpdates = ['name', 'phone', 'department', 'batch', 'studentId', 'avatar'];
        allowedUpdates.forEach((field) => {
            if (req.body[field] !== undefined) {
                user[field] = req.body[field];
            }
        });

        await user.save();

        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(200).json({
            success: true,
            message: 'User updated successfully',
            data: userResponse,
        });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user',
            error: error.message,
        });
    }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // Prevent users from deleting themselves
        if (req.user.id === user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'You cannot delete your own account',
            });
        }

        await User.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: 'User deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete user',
            error: error.message,
        });
    }
};

// @desc    Get dashboard stats based on role
// @route   GET /api/users/dashboard/stats
// @access  Private
exports.getDashboardStats = async (req, res) => {
    try {
        const stats = {};

        // Common stats for all
        stats.totalMembers = await User.countDocuments({
            role: { $in: ['member', 'general_secretary', 'president', 'moderator', 'admin'] }
        });

        // Admin/Moderator specific stats
        if (['admin', 'moderator'].includes(req.user.role)) {
            stats.totalUsers = await User.countDocuments();
            stats.pendingMemberships = await User.countDocuments({ membershipStatus: 'pending' });
            stats.activeMembers = await User.countDocuments({
                role: { $in: ['member', 'general_secretary', 'president', 'moderator', 'admin'] },
                isActive: true
            });
            stats.inactiveMembers = await User.countDocuments({ isActive: false });
        }

        res.status(200).json({
            success: true,
            data: stats,
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};
