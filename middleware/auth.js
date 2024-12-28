const User = require('../models/userSchema');

const userAuth = (req, res, next) => {
    if (!req.session.user) {
        // For AJAX/fetch requests
        if (req.xhr || req.headers.accept?.includes('json') || req.headers['content-type']?.includes('application/json')) {
            return res.status(401).json({ 
                status: 'unauthorized',
                type: 'info',
                title: 'Please Login',
                message: 'You need to login to continue',
                showLoginButton: true
            });
        }
        // For regular requests
        return res.redirect('/login');
    }

    User.findById(req.session.user._id)
        .then(user => {
            if (user && !user.isBlocked) {
                req.user = user;
                next();
            } else {
                req.session.destroy();
                if (req.xhr || req.headers.accept?.includes('json') || req.headers['content-type']?.includes('application/json')) {
                    return res.status(401).json({ 
                        status: 'unauthorized',
                        type: 'warning',
                        title: 'Access Denied',
                        message: 'Account is blocked or invalid',
                        showLoginButton: true
                    });
                }
                res.redirect('/login');
            }
        })
        .catch(error => {
            console.error('Auth middleware error:', error);
            if (req.xhr || req.headers.accept?.includes('json') || req.headers['content-type']?.includes('application/json')) {
                return res.status(500).json({ 
                    status: 'error',
                    type: 'error',
                    title: 'Error',
                    message: 'Internal server error'
                });
            }
            res.status(500).send('Internal server error');
        });
};

const adminAuth = (req, res, next) => {
    if (!req.session.admin) {
        return res.redirect('/admin/admin-login');
    }
    
    User.findOne({ _id: req.session.admin._id, isAdmin: true })
        .then(admin => {
            if (admin) {
                next();
            } else {
                req.session.destroy();
                res.redirect('/admin/admin-login');
            }
        })
        .catch(error => {
            console.error('Admin auth error:', error);
            res.status(500).send('Internal Server Error');
        });
};

module.exports = {
    userAuth,
    adminAuth
};



















// const User= require('../models/userSchema');


// const userAuth = (req, res, next) => {
//     if (!req.session.user) {
//         // For AJAX/fetch requests
//         if (req.xhr || req.headers.accept?.includes('json') || req.headers['content-type']?.includes('application/json')) {
//             return res.status(401).json({ 
//                 status: 'unauthorized',
//                 redirect: '/login',
//                 message: 'Please login to continue'
//             });
//         }
//         // For regular requests
//         return res.redirect('/login');
//     }

//     User.findById(req.session.user._id)
//         .then(user => {
//             if (user && !user.isBlocked) {
//                 req.user = user;
//                 next();
//             } else {
//                 req.session.destroy();
//                 if (req.xhr || req.headers.accept?.includes('json') || req.headers['content-type']?.includes('application/json')) {
//                     return res.status(401).json({ 
//                         status: 'unauthorized',
//                         redirect: '/login',
//                         message: 'Account is blocked or invalid'
//                     });
//                 }
//                 res.redirect('/login');
//             }
//         })
//         .catch(error => {
//             console.error('Auth middleware error:', error);
//             if (req.xhr || req.headers.accept?.includes('json') || req.headers['content-type']?.includes('application/json')) {
//                 return res.status(500).json({ 
//                     status: 'error',
//                     message: 'Internal server error'
//                 });
//             }
//             res.status(500).send('Internal server error');
//         });
// };


// // const userAuth = (req, res, next) => {
// //     // If no user in session, redirect to login or send unauthorized response
// //     if (!req.session.user) {
// //         // If it's an AJAX request (like from addToCart), send a JSON response
// //         if (req.xhr || req.headers.accept.indexOf('json') > -1) {
// //             return res.status(401).json({ 
// //                 status: 'unauthorized', 
// //                 message: 'Please log in to continue' 
// //             });
// //         }
        
// //         // For regular page requests, redirect to login
// //         return res.redirect('/login');
// //     }

// //     // Check if user exists and is not blocked
// //     User.findById(req.session.user._id)
// //         .then(user => {
// //             if (user && !user.isBlocked) {
// //                 req.user = user;
// //                 next();
// //             } else {
// //                 // Clear the session if user is blocked or not found
// //                 req.session.destroy();
                
// //                 // For AJAX requests
// //                 if (req.xhr || req.headers.accept.indexOf('json') > -1) {
// //                     return res.status(401).json({ 
// //                         status: 'unauthorized', 
// //                         message: 'Account is blocked or invalid' 
// //                     });
// //                 }
                
// //                 // For page requests
// //                 res.redirect('/login');
// //             }
// //         })
// //         .catch(error => {
// //             console.error('Error in user auth middleware:', error);
            
// //             // For AJAX requests
// //             if (req.xhr || req.headers.accept.indexOf('json') > -1) {
// //                 return res.status(500).json({ 
// //                     status: 'error', 
// //                     message: 'Internal server error' 
// //                 });
// //             }
            
// //             // For page requests
// //             res.status(500).send('Internal server error');
// //         });
// // };




// const adminAuth = (req, res, next) => {
//     User.findOne({ isAdmin: true })
//         .then(data => {
//             if (data) {
//                 next();
//             } else {
//                 console.log('Redirecting to login page');
//                 res.redirect('/admin/admin-login');
//             }
//         })
//         .catch(error => {
//             console.log('Error in adminAuth middleware:', error);
//             res.status(500).send('Internal Server Error');
//         });
// };








// module.exports={
//     userAuth,
//     adminAuth
// }