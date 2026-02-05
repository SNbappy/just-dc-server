exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized for this action',
            });
        }
        next();
    };
};

// Admin OR Moderator OR President OR GS can access management dashboards
exports.isAdminOrModerator = (req, res, next) => {
    const allowed = ['admin', 'moderator', 'president', 'general_secretary'];
    if (!req.user || !allowed.includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: 'Not authorized as management',
        });
    }
    next();
};

// Only Admin + President + General Secretary can change roles
exports.canChangeRoles = (req, res, next) => {
    const allowed = ['admin', 'president', 'general_secretary'];
    if (!req.user || !allowed.includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: 'Not authorized to change user roles',
        });
    }
    next();
};
