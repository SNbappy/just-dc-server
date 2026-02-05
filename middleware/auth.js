const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - Check if user is authenticated
exports.protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            const user = await User.findByPk(decoded.id);
            if (!user) {
                return res.status(401).json({ success: false, message: 'User not found' });
            }

            req.user = user;
            return next();
        } catch (error) {
            return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
        }
    }

    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
};

// ✅ NEW: Optional auth (does NOT block guest)
exports.optionalAuth = async (req, res, next) => {
    try {
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            const token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findByPk(decoded.id);
            if (user) req.user = user;
        }
    } catch (e) {
        // ignore token errors (guest flow)
    }
    return next();
};
