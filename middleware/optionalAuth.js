// middleware/optionalAuth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't block if no token
 * Used for routes that work for both guests and logged-in users
 */
exports.optionalAuth = async (req, res, next) => {
    try {
        // Check for token in header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // No token provided - continue as guest
            req.user = null;
            return next();
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            req.user = null;
            return next();
        }

        try {
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Get user from token
            const user = await User.findByPk(decoded.id, {
                attributes: { exclude: ['password'] }
            });

            if (!user) {
                // Invalid user - continue as guest
                req.user = null;
                return next();
            }

            // Attach user to request
            req.user = user;
            next();
        } catch (error) {
            // Token invalid or expired - continue as guest
            req.user = null;
            next();
        }
    } catch (error) {
        // Any other error - continue as guest
        req.user = null;
        next();
    }
};
