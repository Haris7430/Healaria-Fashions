


// In middleware/adminData.js
const User = require('../models/userSchema');

const adminDataMiddleware = async (req, res, next) => {
    if (req.session.isAdmin) {
        try {
            const adminUser = await User.findOne({ isAdmin: true });
            res.locals.admin = adminUser; // This makes admin data available in all views
        } catch (error) {
            console.error('Error fetching admin data:', error);
        }
    }
    next();
};

module.exports = adminDataMiddleware;