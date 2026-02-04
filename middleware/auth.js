const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - Check if user is authenticated
exports.protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Get user from token (Sequelize)
            const user = await User.findByPk(decoded.id);

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'User not found'
                });
            }

            req.user = user; // password excluded by defaultScope in User model
            return next();
        } catch (error) {
            console.error(error);
            return res.status(401).json({
                success: false,
                message: 'Not authorized, token failed'
            });
        }
    }

    return res.status(401).json({
        success: false,
        message: 'Not authorized, no token'
    });
};

// Admin middleware - Check if user is admin
exports.admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        return next();
    }

    return res.status(403).json({
        success: false,
        message: 'Not authorized as admin'
    });
};
