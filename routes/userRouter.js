

const express=require('express');
const router=express.Router();
const userController= require("../controllers/user/userController");
const userCartController = require('../controllers/user/userCartController');
const userProfileController = require('../controllers/user/userProfileController');
const checkoutController = require('../controllers/user/checkOutController')

const { userAuth, adminAuth } = require('../middleware/auth');
const passport = require('passport');


router.get("/pageNotFound",userController.pageNotFound)

router.get('/',userController.loadHomePage);
router.get('/signup',userController.loadSignup)
router.get('/login',userController.loadLogin);
router.get('/logout',userController.logout)

router.post('/login',userController.login);
router.post('/signup',userController.signUp)
router.post('/verify-otp',userController.verifyOtp);
router.post("/resend-otp",userController.resendOtp);


router.get("/auth/google",passport.authenticate('google',{scope:['profile','email']}));

router.get('/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{

    req.session.user = req.user;
    res.redirect('/')
    
});


router.get('/forgot-password',userController.getForgotPassword);
router.post('/forgot-email-valid', userController.forgotEmailValid);
router.post('/verify-passForgot-otp',userController.verifyForgotPassOtp);
router.get('/reset-password',userController.getResetPassPage);
router.post('/resend-forgot-otp',userController.otpResend)
router.post('/reset-password', userController.postNewPassword);


router.get('/search', userController.searchProducts);


router.get('/shop-page', userController.shopingPage);
router.get('/productDetails', userController.getProductDetails);
router.get('/product/:productId/variant/:variantId', userController.getVariantDetails);


router.get('/userCart',userAuth, userCartController.getCartPage);
router.post('/addToCart/:productId', userAuth, userCartController.addToCart);
// router.delete('/removeFromCart/:productId', userAuth, userCartController.removeFromCart);
// router.put('/updateCart/:productId', userAuth, userCartController.updateCart);




router.get('/userProfile/:section?', userAuth, userProfileController.getUserProfile);
router.get('/profile/addresses', userAuth, userProfileController.getAddressPage);
router.get('/profile/add-address', userAuth, userProfileController.getAddAddress);
router.post('/profile/add-address', userAuth, userProfileController.addAddress);
router.get('/profile/get-address/:id', userAuth, userProfileController.getAddressById);
router.put('/profile/edit-address/:id', userAuth, userProfileController.updateAddress);
// In your userRouter.js 
router.delete('/profile/delete-address/:id', userAuth, userProfileController.deleteAddress);
router.get('/dashboard', userAuth, userProfileController.getDashboard);
router.get('/edit-profile', userAuth, userProfileController.getEditProfile);
router.post('/update-profile', userAuth, userProfileController.updateProfile);
//
router.post('/change-password', userAuth, userProfileController.changePassword);
router.get('/profile/orders', userAuth,userProfileController.getUserOrders);
// Route to view specific order details

router.get('/order/:orderId', userAuth,userProfileController.getOrderDetails);


router.get('/checkout', userAuth, checkoutController.getCheckoutPage);
router.post('/checkout/place-order', userAuth, checkoutController.createOrder);
router.get('/orders/:orderId', userAuth, checkoutController.getOrderSummary);










module.exports= router 