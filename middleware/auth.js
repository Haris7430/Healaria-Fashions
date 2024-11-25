

const User= require('../models/userSchema');

const userAuth = (req, res, next) => {
    if (req.session.user) {
        User.findById(req.session.user._id)  // Access the user ID correctly
        .then(data => {
            if (data && !data.isBlocked) {
                req.user = data;
                next();
            } else {
                res.redirect('/login');
            }
        })
        .catch(error => {
            console.log('Error in user auth middleware:', error);
            res.status(500).send('Internal server error');
        });
    } else {
        res.redirect('/login');
    }
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