// middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
    // Default values
    let statusCode = err.statusCode || err.status || 500;
    let message = err.message || 'Server Error';
    let errors = undefined;

    // Log for dev
    console.error('❌ ERROR:', err);

    // ✅ Sequelize Validation Error
    if (err.name === 'SequelizeValidationError') {
        statusCode = 400;
        errors = err.errors?.map((e) => ({
            field: e.path,
            message: e.message
        }));
        message = errors?.[0]?.message || 'Validation error';
    }

    // ✅ Sequelize Unique Constraint Error
    if (err.name === 'SequelizeUniqueConstraintError') {
        statusCode = 400;
        errors = err.errors?.map((e) => ({
            field: e.path,
            message: e.message
        }));
        message = 'Duplicate field value entered';
    }

    // ✅ Sequelize Foreign Key Constraint Error
    if (err.name === 'SequelizeForeignKeyConstraintError') {
        statusCode = 400;
        message = 'Invalid reference (foreign key constraint failed)';
    }

    // ✅ JWT errors
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Not authorized, token invalid';
    }
    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Not authorized, token expired';
    }

    // ✅ Multer errors (file upload)
    // Multer throws errors with name "MulterError"
    if (err.name === 'MulterError') {
        statusCode = 400;
        message = err.message || 'File upload error';
    }

    // ✅ Body parser JSON error (bad JSON)
    if (err.type === 'entity.parse.failed') {
        statusCode = 400;
        message = 'Invalid JSON payload';
    }

    const response = {
        success: false,
        message
    };

    // optionally include detailed validation errors
    if (errors) response.errors = errors;

    // include stack only in development
    if ((process.env.NODE_ENV || 'development') === 'development') {
        response.stack = err.stack;
    }

    return res.status(statusCode).json(response);
};

module.exports = errorHandler;
