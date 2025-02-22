

const express=require('express');
const router=express.Router();
const userController= require("../controllers/user/userController");
const userCartController = require('../controllers/user/userCartController');
const userProfileController = require('../controllers/user/userProfileController');
const checkoutController = require('../controllers/user/checkOutController')
const wishlistController = require('../controllers/user/wishlistController')
const { userAuth, adminAuth } = require('../middleware/auth');
const passport = require('passport');



router.get('/',userController.loadHomePage);
router.get('/category/:categoryId', userController.getProductsByCategory);
router.get('/signup',userController.loadSignup)
router.get('/login',userController.loadLogin);
router.get('/logout',userController.logout)

router.post('/login',userController.login);
router.post('/signup',userController.signUp)
router.post('/verify-otp',userController.verifyOtp);
router.post("/resend-otp",userController.resendOtp);


router.get("/auth/google", passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account'  // Always show account selector
}));

router.get('/google/callback', passport.authenticate('google', {failureRedirect: '/signup'}), (req, res) => {
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
router.get('/product/:productId/variant/first', userAuth, userController.getVariantDetails);
router.get('/check-auth', userAuth, (req, res) => res.status(200).json({ authenticated: true }));
router.get('/product/:productId', userController.getProductForCart);
router.get('/product/:productId/offers', userController.getProductOffers);


router.get('/userCart',userAuth, userCartController.getCartPage); 
router.post('/addToCart/:id', userAuth, userCartController.addToCart);
router.delete('/removeFromCart/:productId', userAuth, userCartController.removeFromCart);
router.put('/updateCart/:productId', userAuth, userCartController.updateCart);
router.get('/check-stock/:productId', userAuth, userCartController.checkStockAvailability);
router.post('/check-cart-item', userAuth, userCartController.checkCartItem);


router.get('/checkout', userAuth, checkoutController.getCheckoutPage);
router.post('/checkout/validate-quantities', userAuth, checkoutController.validateQuantities);
router.post('/checkout/place-order', userAuth, checkoutController.createOrder);
router.get('/orders/:orderId', userAuth, checkoutController.getOrderSummary);
router.post('/checkout/initiate-payment', userAuth, checkoutController.initiatePayment);
router.get('/checkout/available-coupons', userAuth, checkoutController.getAvailableCoupons);
router.post('/checkout/validate-coupon', userAuth, checkoutController.validateCoupon);
router.post('/verify-payment',userAuth,checkoutController.verifyPayment);
router.get('/checkout/wallet-balance', userAuth, checkoutController.checkWalletBalance);

 
router.get('/userProfile/:section?', userAuth, userProfileController.getUserProfile);
router.get('/profile/referrals', userAuth, userProfileController.getReferrals);
router.post('/profile/generate-referral-code', userAuth, userProfileController.generateReferralCode);
router.post('/process-referral-reward', userAuth, userProfileController.processReferralReward);
router.get('/profile/addresses', userAuth, userProfileController.getAddressPage);
router.get('/profile/add-address', userAuth, userProfileController.getAddAddress);
router.post('/profile/add-address', userAuth, userProfileController.addAddress);
router.get('/profile/get-address/:id', userAuth, userProfileController.getAddressById);
router.put('/profile/edit-address/:id', userAuth, userProfileController.updateAddress);
router.delete('/profile/delete-address/:id', userAuth, userProfileController.deleteAddress);
router.get('/dashboard', userAuth, userProfileController.getDashboard);
router.get('/edit-profile', userAuth, userProfileController.getEditProfile);
router.post('/update-profile', userAuth, userProfileController.updateProfile);
router.get('/change-password', userAuth, userProfileController.getChangePasswordPage);
router.post('/change-password', userAuth, userProfileController.changePassword);
router.get('/profile/orders', userAuth,userProfileController.getUserOrders);
router.get('/order/:orderId', userAuth,userProfileController.getOrderDetails);
router.post('/order/:orderId/cancel-item/:itemId', userAuth, userProfileController.cancelOrderItem);
router.post('/order/:orderId/cancel-order', userAuth, userProfileController.cancelEntireOrder);
router.get('/order/:orderId/download-pdf', userAuth, userProfileController.generateOrderPDF);
router.post('/order/:orderId/retry-payment', userAuth, userProfileController.retryPayment);
router.post('/order/:orderId/return-item/:itemId', userAuth, userProfileController.returnOrderItem);
router.get('/profile/wallet', userAuth, userProfileController.getWallet);




router.post('/add-to-wishlist', userAuth, wishlistController.addToWishlist);
router.get('/wishlist', userAuth, wishlistController.getWishlist);
router.delete('/remove-from-wishlist/:productId', userAuth, wishlistController.removeFromWishlist);
router.delete('/clear-wishlist', userAuth, wishlistController.clearWishlist);
router.post('/wishlist/add-all-to-cart', userAuth, wishlistController.addAllToCart);
router.patch('/update-wishlist-variant/:productId', userAuth, wishlistController.updateWishlistVariant);
router.get('/get-wishlist-items', userAuth, wishlistController.getWishlistItems);
router.get('/check-wishlist-item/:productId', userAuth, wishlistController.checkWishlistItem);



module.exports= router 