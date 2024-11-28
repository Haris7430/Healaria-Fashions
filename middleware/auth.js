

const User= require('../models/userSchema');

const userAuth = (req, res, next) => {
    // If no user in session, redirect to login or send unauthorized response
    if (!req.session.user) {
        // If it's an AJAX request (like from addToCart), send a JSON response
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(401).json({ 
                status: 'unauthorized', 
                message: 'Please log in to continue' 
            });
        }
        
        // For regular page requests, redirect to login
        return res.redirect('/login');
    }

    // Check if user exists and is not blocked
    User.findById(req.session.user._id)
        .then(user => {
            if (user && !user.isBlocked) {
                req.user = user;
                next();
            } else {
                // Clear the session if user is blocked or not found
                req.session.destroy();
                
                // For AJAX requests
                if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                    return res.status(401).json({ 
                        status: 'unauthorized', 
                        message: 'Account is blocked or invalid' 
                    });
                }
                
                // For page requests
                res.redirect('/login');
            }
        })
        .catch(error => {
            console.error('Error in user auth middleware:', error);
            
            // For AJAX requests
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.status(500).json({ 
                    status: 'error', 
                    message: 'Internal server error' 
                });
            }
            
            // For page requests
            res.status(500).send('Internal server error');
        });
};




const adminAuth = (req, res, next) => {
    User.findOne({ isAdmin: true })
        .then(data => {
            if (data) {
                next();
            } else {
                console.log('Redirecting to login page');
                res.redirect('/admin/admin-login');
            }
        })
        .catch(error => {
            console.log('Error in adminAuth middleware:', error);
            res.status(500).send('Internal Server Error');
        });
};








module.exports={
    userAuth,
    adminAuth
}