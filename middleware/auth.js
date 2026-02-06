// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect routes - Check if user is authenticated
 * REQUIRED: User must be logged in
 */
exports.protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];

            console.log('🔐 AUTH - Token exists for:', req.method, req.originalUrl);

            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            console.log('🔐 AUTH - Token decoded, User ID:', decoded.id);

            const user = await User.findByPk(decoded.id);
            if (!user) {
                console.log('❌ AUTH FAILED - User not found in database');
                return res.status(401).json({ success: false, message: 'User not found' });
            }

            req.user = user;

            console.log('✅ AUTH SUCCESS - User:', user.name, 'Role:', user.role, 'ID:', user.id);

            return next();
        } catch (error) {
            console.log('❌ AUTH FAILED - Token error:', error.message);
            return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
        }
    }

    console.log('❌ AUTH FAILED - No token provided for:', req.method, req.originalUrl);
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
};

/**
 * Optional auth - User can be logged in OR guest
 * DOES NOT BLOCK: Continues with or without authentication
 */
exports.optionalAuth = async (req, res, next) => {
    try {
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            const token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findByPk(decoded.id);
            if (user) {
                req.user = user;
                console.log('✅ OPTIONAL AUTH - User authenticated:', user.name);
            } else {
                req.user = null;
                console.log('ℹ️ OPTIONAL AUTH - Token valid but user not found');
            }
        } else {
            req.user = null;
            console.log('ℹ️ OPTIONAL AUTH - No token (guest mode)');
        }
    } catch (e) {
        req.user = null;
        console.log('ℹ️ OPTIONAL AUTH - Token error (proceeding as guest):', e.message);
    }
    return next();
};

/**
 * Authorize roles - Check if user has required role
 * USAGE: authorize('admin', 'president', 'general_secretary')
 */
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        if (!roles.includes(req.user.role)) {
            console.log(`❌ AUTHORIZATION FAILED - User ${req.user.name} (${req.user.role}) attempted to access ${req.originalUrl}`);
            return res.status(403).json({
                success: false,
                message: `User role '${req.user.role}' is not authorized to access this route`
            });
        }

        console.log(`✅ AUTHORIZATION SUCCESS - User ${req.user.name} (${req.user.role}) authorized`);
        next();
    };
};

module.exports = exports;