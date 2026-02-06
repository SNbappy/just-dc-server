// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - Check if user is authenticated
exports.protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];

            // ✅ ADD DEBUG LOGS
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

// ✅ Optional auth (does NOT block guest)
exports.optionalAuth = async (req, res, next) => {
    try {
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            const token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findByPk(decoded.id);
            if (user) {
                req.user = user;
                console.log('✅ OPTIONAL AUTH - User authenticated:', user.name);
            }
        } else {
            console.log('ℹ️ OPTIONAL AUTH - No token (guest mode)');
        }
    } catch (e) {
        console.log('ℹ️ OPTIONAL AUTH - Token error (proceeding as guest):', e.message);
    }
    return next();
};
