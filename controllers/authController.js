const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE
    });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { name, email, phone, password, department, batch, studentId } = req.body;

        // normalize email like Mongo did
        const normalizedEmail = (email || '').toLowerCase().trim();

        // Check if user exists
        const userExists = await User.findOne({
            where: { email: normalizedEmail }
        });

        if (userExists) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        // Create user
        const user = await User.create({
            name,
            email: normalizedEmail,
            phone: phone || null,
            password,
            department: department || null,
            batch: batch || null,
            studentId: studentId || null
        });

        // Generate token
        const token = generateToken(user.id);

        return res.status(201).json({
            success: true,
            message: 'User registered successfully',
            token,
            user: {
                _id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role
            }
        });
    } catch (error) {
        console.error('REGISTER ERROR:', error); // ✅ important for you to see real reason

        // Sequelize unique constraint -> show 400 instead of 500
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        // Sequelize validation errors -> 400
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                success: false,
                message: error.errors?.[0]?.message || 'Validation error'
            });
        }

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { email, password } = req.body;
        const normalizedEmail = (email || '').toLowerCase().trim();

        // ✅ must include password using scope
        const user = await User.scope('withPassword').findOne({
            where: { email: normalizedEmail }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Your account has been deactivated'
            });
        }

        const token = generateToken(user.id);

        return res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                _id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                avatar: user.avatar
            }
        });
    } catch (error) {
        console.error('LOGIN ERROR:', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);

        return res.json({
            success: true,
            user
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Update user details
// @route   PUT /api/auth/updatedetails
// @access  Private
exports.updateDetails = async (req, res) => {
    try {
        const fieldsToUpdate = {
            name: req.body.name,
            email: req.body.email ? req.body.email.toLowerCase().trim() : undefined,
            phone: req.body.phone,
            studentId: req.body.studentId,
            department: req.body.department,
            batch: req.body.batch
        };

        // remove undefined keys
        Object.keys(fieldsToUpdate).forEach((k) => fieldsToUpdate[k] === undefined && delete fieldsToUpdate[k]);

        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        await user.update(fieldsToUpdate);

        return res.json({
            success: true,
            user
        });
    } catch (error) {
        console.error('UPDATE DETAILS ERROR:', error);

        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({
                success: false,
                message: 'Email is already in use'
            });
        }

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
exports.updatePassword = async (req, res) => {
    try {
        const user = await User.scope('withPassword').findByPk(req.user.id);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (!(await user.matchPassword(req.body.currentPassword))) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        user.password = req.body.newPassword;
        await user.save();

        const token = generateToken(user.id);

        return res.json({
            success: true,
            message: 'Password updated successfully',
            token
        });
    } catch (error) {
        console.error('UPDATE PASSWORD ERROR:', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
