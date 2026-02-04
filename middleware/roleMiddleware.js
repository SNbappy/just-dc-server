// Check if user has required role(s)
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated',
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `User role '${req.user.role}' is not authorized to access this route`,
            });
        }

        next();
    };
};

// Check if user is at least a member
exports.isMember = (req, res, next) => {
    const memberRoles = ['member', 'executive_member', 'general_secretary', 'president', 'moderator', 'admin'];

    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Not authenticated',
        });
    }

    if (!memberRoles.includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: 'Only club members can access this resource',
        });
    }

    next();
};

// Check if user is admin, president, or general secretary (top management)
exports.isTopManagement = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Not authenticated',
        });
    }

    const topRoles = ['admin', 'president', 'general_secretary'];
    if (!topRoles.includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: 'Only Admin, President, or General Secretary can access this resource',
        });
    }

    next();
};

// Check if user is admin or moderator (can manage but moderator can't change roles)
exports.isAdminOrModerator = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Not authenticated',
        });
    }

    if (!['admin', 'moderator', 'president', 'general_secretary'].includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: 'Only admins, moderators, or executives can access this resource',
        });
    }

    next();
};

// Check if user can change roles (only Admin, President, GS)
exports.canChangeRoles = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Not authenticated',
        });
    }

    const allowedRoles = ['admin', 'president', 'general_secretary'];
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: 'Only Admin, President, or General Secretary can change user roles',
        });
    }

    next();
};

// Check if user is executive (President, General Secretary, or Executive Member)
exports.isExecutive = (req, res, next) => {
    const execRoles = ['president', 'general_secretary', 'executive_member', 'moderator', 'admin'];

    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Not authenticated',
        });
    }

    if (!execRoles.includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: 'Only executive members can access this resource',
        });
    }

    next();
};
