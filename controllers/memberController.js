const Member = require('../models/Member');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');

// @desc    Get all members
// @route   GET /api/members
// @access  Public
exports.getAllMembers = async (req, res) => {
    try {
        const { role, isActive } = req.query;

        const where = {};
        if (role) where.role = role;
        if (isActive !== undefined) where.isActive = isActive === 'true';

        const members = await Member.findAll({
            where,
            order: [
                ['priority', 'DESC'],
                ['createdAt', 'DESC']
            ]
        });

        res.status(200).json({
            success: true,
            count: members.length,
            data: members
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// @desc    Get single member
// @route   GET /api/members/:id
// @access  Public
exports.getMember = async (req, res) => {
    try {
        const member = await Member.findByPk(req.params.id);

        if (!member) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        res.status(200).json({
            success: true,
            data: member
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// @desc    Create new member
// @route   POST /api/members
// @access  Private/Admin
exports.createMember = async (req, res) => {
    try {
        let imageUrl = '';

        // Upload image if provided
        if (req.file) {
            imageUrl = await uploadToCloudinary(req.file.buffer, 'members');
        }

        const memberData = {
            ...req.body,
            image: imageUrl
        };

        // Parse socialLinks if it's a string
        if (typeof req.body.socialLinks === 'string') {
            memberData.socialLinks = JSON.parse(req.body.socialLinks);
        }

        const member = await Member.create(memberData);

        res.status(201).json({
            success: true,
            message: 'Member created successfully',
            data: member
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to create member',
            error: error.message
        });
    }
};

// @desc    Update member
// @route   PUT /api/members/:id
// @access  Private/Admin
exports.updateMember = async (req, res) => {
    try {
        let member = await Member.findByPk(req.params.id);

        if (!member) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        let imageUrl = member.image;

        // Upload new image if provided
        if (req.file) {
            // Delete old image from Cloudinary if exists
            if (member.image) {
                await deleteFromCloudinary(member.image);
            }
            imageUrl = await uploadToCloudinary(req.file.buffer, 'members');
        }

        const updateData = {
            ...req.body,
            image: imageUrl
        };

        // Parse socialLinks if it's a string
        if (typeof req.body.socialLinks === 'string') {
            updateData.socialLinks = JSON.parse(req.body.socialLinks);
        }

        await member.update(updateData);

        res.status(200).json({
            success: true,
            message: 'Member updated successfully',
            data: member
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update member',
            error: error.message
        });
    }
};

// @desc    Delete member
// @route   DELETE /api/members/:id
// @access  Private/Admin
exports.deleteMember = async (req, res) => {
    try {
        const member = await Member.findByPk(req.params.id);

        if (!member) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        // Delete image from Cloudinary if exists
        if (member.image) {
            await deleteFromCloudinary(member.image);
        }

        await member.destroy();

        res.status(200).json({
            success: true,
            message: 'Member deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to delete member',
            error: error.message
        });
    }
};
