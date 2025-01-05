// middleware/errorMiddleware.js

const createError = require('http-errors');

// Custom error types
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
        this.status = 400;
    }
}

class AuthenticationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AuthenticationError';
        this.status = 401;
    }
}

// Main error handler
const errorHandler = (err, req, res, next) => {
    // Log error for debugging
    console.error('Error:', {
        name: err.name,
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });

    // Set default status
    const status = err.status || 500;

    // Handle API requests
    if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(status).json({
            status: 'error',
            message: err.message || 'Something went wrong',
            code: status,
            details: process.env.NODE_ENV === 'development' ? err : undefined
        });
    }

    // Check if request is from admin route
    const isAdminRoute = req.originalUrl.startsWith('/admin');
    const errorTemplate = isAdminRoute ? 'admin-error' : 'user-error';

    // Handle different error types
    switch (err.name) {
        case 'ValidationError':
            return res.status(400).render(errorTemplate, {
                title: 'Validation Error',
                message: 'The submitted data is invalid.',
                error: err,
                status: 400
            });

        case 'AuthenticationError':
            return res.status(401).render(errorTemplate, {
                title: 'Authentication Error',
                message: 'Please log in to continue.',
                error: err,
                status: 401
            });

        case 'CastError':
            return res.status(400).render(errorTemplate, {
                title: 'Invalid Data',
                message: 'The requested resource is invalid.',
                error: err,
                status: 400
            });

        case 'NotFoundError':
        case 'ENOENT':
            return res.status(404).render(errorTemplate, {
                title: 'Not Found',
                message: 'The requested resource was not found.',
                error: err,
                status: 404
            });

        default:
            // Generic error handler
            res.status(status).render(errorTemplate, {
                title: 'Error',
                message: process.env.NODE_ENV === 'production' 
                    ? 'Something went wrong!' 
                    : err.message,
                error: process.env.NODE_ENV === 'development' ? err : {},
                status: status
            });
    }
};

// 404 handler
const notFoundHandler = (req, res, next) => {
    // Skip for static files
    if (req.path.startsWith('/public/') || 
        req.path.startsWith('/assets/') || 
        req.path.startsWith('/uploads/')) {
        return next();
    }

    // Check if request is from admin route
    const isAdminRoute = req.originalUrl.startsWith('/admin');
    
    // Handle API requests
    if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(404).json({
            status: 'error',
            message: 'Resource not found',
            code: 404
        });
    }

    // Render appropriate 404 page
    res.status(404).render(isAdminRoute ? 'admin-error' : 'user-error', {
        title: 'Page Not Found',
        message: 'The page you are looking for does not exist.'
    });
};

// Async error wrapper
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncHandler,
    ValidationError,
    AuthenticationError,
    createError
};