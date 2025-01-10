



const express = require('express');
const router = express.Router();
const path = require('path')
// Import multer
const adminController = require('../controllers/admin/adminController');
const { userAuth, adminAuth } = require('../middleware/auth');
const customerController = require('../controllers/admin/customerController');
const categoryController = require('../controllers/admin/categoryController');
const productController = require('../controllers/admin/productController');
const orderController = require('../controllers/admin/orderController')
const offerController = require('../controllers/admin/offerController');
const couponController = require('../controllers/admin/couponController')
const multer = require('multer'); 
const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({ storage }).array('images', 10);
const adminDataMiddleware = require('../middleware/adminData');

// Define routes
router.get('/pageerror', adminController.pageerror);
router.get('/admin-login', adminController.loadLogin);
router.post('/admin-login', adminController.login);
router.get('/admin-dashboard', adminAuth, adminDataMiddleware, adminController.loadDashboard);

// API routes don't need adminDataMiddleware as they don't render views
router.get('/api/dashboard-data', adminAuth, adminController.getDashboardData);
router.get('/api/sales-report', adminAuth, adminController.getSalesReport);
router.get('/api/download-report/:format', adminAuth, adminController.downloadReport);

router.get('/admin-logout', adminController.logout);

// Add adminDataMiddleware to routes that render views
router.get('/all-customers', adminAuth, adminDataMiddleware, customerController.customerInfo);
router.get('/blockCustomer', adminAuth, customerController.customerBlocked);
router.get('/unblockCustomer', adminAuth, customerController.customerunBlocked);
router.get('/deleteCustomer', adminAuth, customerController.deleteCustomer);

router.get('/category', adminAuth, adminDataMiddleware, categoryController.categoryInfo);
router.post('/addCategory', adminAuth, categoryController.addCategory);
router.get('/listCategory', adminAuth, categoryController.getListCategory);
router.get('/unlistCategory', adminAuth, categoryController.getUnlistCategory);
router.get('/editCategory', adminAuth, adminDataMiddleware, categoryController.getEditCategory);
router.post('/editCategory/:id', adminAuth, categoryController.editCategory);
router.delete('/deleteCategory/:id', adminAuth, categoryController.deleteCategory);

// Product routes with adminDataMiddleware for views
router.get('/addProducts', adminAuth, adminDataMiddleware, productController.getProductAddPage);
router.post("/addProducts", adminAuth, upload, productController.addProducts);
router.get('/products', adminAuth, adminDataMiddleware, productController.getAllProducts);

router.post('/block-product/:id', adminAuth, productController.blockProduct);
router.post('/unblock-product/:id', adminAuth, productController.unblockProduct);
router.delete('/delete-product/:id', adminAuth, productController.deleteProduct);
router.get('/editProduct/:id', adminAuth, adminDataMiddleware, productController.getEditProduct);
router.post('/editProduct/:id', adminAuth, upload, productController.editProduct);

router.get('/productVariants/:id', adminAuth, adminDataMiddleware, productController.productVariants);
router.get('/colorVarient/:id', adminAuth, adminDataMiddleware, productController.colorVarients);
router.post('/colorVariant/:id', upload, productController.addColorVariant);
router.post('/variant/list/:productId/:variantId', productController.listVariant);
router.post('/variant/unlist/:productId/:variantId', productController.unlistVariant);
router.delete('/variant/delete/:productId/:variantId', productController.deleteVariant);
router.get('/editVariant/:id', adminAuth, adminDataMiddleware, productController.editVariantForm);
router.post('/colorVariant/edit/:id', adminAuth, upload, productController.updateVariant);

// Order routes with adminDataMiddleware for views
router.get('/orders', adminAuth, adminDataMiddleware, orderController.listOrders);
router.get('/order-details/:id', adminAuth, adminDataMiddleware, orderController.orderDetails);
router.post('/update-order-status/:id', adminAuth, orderController.updateOrderStatus);
router.post('/cancel-order/:id', adminAuth, orderController.cancelEntireOrder);
router.post('/cancel-order-item/:orderId', adminAuth, orderController.cancelOrderItem);
router.get('/return-request-details/:orderId', adminAuth, adminDataMiddleware, orderController.getReturnRequestDetails);
router.post('/handle-return-request', adminAuth, orderController.handleReturnRequest);
router.get('/download-invoice/:orderId', adminAuth, orderController.downloadInvoice);

// Offer routes with adminDataMiddleware for views
router.get('/offers', adminAuth, adminDataMiddleware, offerController.renderOffersPage);
router.get('/offers/check-existing', adminAuth, offerController.checkExistingOffers);
router.get('/offers/create', adminAuth, adminDataMiddleware, offerController.renderCreateOfferPage);
router.post('/offers/create', adminAuth, offerController.createOffer);
router.get('/offers/edit/:id', adminAuth, adminDataMiddleware, offerController.renderEditOfferPage);
router.put('/offers/edit/:id', adminAuth, offerController.updateOffer);
router.delete('/offers/delete/:id', adminAuth, offerController.deleteOffer);
router.patch('/offers/toggle-status/:id', adminAuth, offerController.toggleOfferStatus);
router.get('/offers/get-products', adminAuth, offerController.getProductsForOffer);
router.get('/offers/get-categories', adminAuth, offerController.getCategoriesForOffer);

// Coupon routes with adminDataMiddleware for views
router.get('/coupons', adminAuth, adminDataMiddleware, couponController.getCoupons);
router.post('/coupons/create', adminAuth, couponController.createCoupon);
router.get('/check-coupon-code', couponController.checkCouponCode);
router.get('/coupons/edit/:id', adminAuth, adminDataMiddleware, couponController.getEditCouponPage);
router.put('/coupons/edit/:id', adminAuth, couponController.updateCoupon);
router.delete('/coupons/delete/:id', adminAuth, couponController.deleteCoupon);
router.patch('/coupons/toggle-status/:id', adminAuth, couponController.toggleCouponStatus);

module.exports = router;




















// const express = require('express');
// const router = express.Router();
// const path= require('path')
// // Import multer
// const adminController = require('../controllers/admin/adminController');
// const { userAuth, adminAuth } = require('../middleware/auth');
// const customerController = require('../controllers/admin/customerController');
// const categoryController = require('../controllers/admin/categoryController');
// const productController = require('../controllers/admin/productController');
// const orderController = require('../controllers/admin/orderController')
// const offerController = require('../controllers/admin/offerController');
// const couponController = require('../controllers/admin/couponController')
// const multer = require('multer'); 
// const storage = multer.memoryStorage(); // Store files in memory
// const upload = multer({ storage }).array('images', 10);

 

// // Define routes
// router.get('/pageerror', adminController.pageerror);
// router.get('/admin-login', adminController.loadLogin);
// router.post('/admin-login', adminController.login);
// router.get('/admin-dashboard', adminAuth, adminController.loadDashboard);

// router.get('/api/dashboard-data', adminAuth, adminController.getDashboardData);
// router.get('/api/sales-report', adminAuth, adminController.getSalesReport);
// router.get('/api/download-report/:format', adminAuth, adminController.downloadReport);

// router.get('/admin-logout', adminController.logout);

// router.get('/all-customers', adminAuth, customerController.customerInfo);
// router.get('/blockCustomer', adminAuth, customerController.customerBlocked);
// router.get('/unblockCustomer', adminAuth, customerController.customerunBlocked);
// router.get('/deleteCustomer',adminAuth, customerController.deleteCustomer);


// router.get('/category', adminAuth, categoryController.categoryInfo);
// router.post('/addCategory', adminAuth, categoryController.addCategory);
// router.get('/listCategory', adminAuth, categoryController.getListCategory);
// router.get('/unlistCategory', adminAuth, categoryController.getUnlistCategory);
// router.get('/editCategory', adminAuth, categoryController.getEditCategory);
// router.post('/editCategory/:id', adminAuth, categoryController.editCategory);
// router.delete('/deleteCategory/:id', adminAuth, categoryController.deleteCategory);


// // Use multer middleware here
// router.get('/addProducts', adminAuth, productController.getProductAddPage);
// router.post("/addProducts", adminAuth, upload, productController.addProducts);
// router.get('/products',adminAuth,productController.getAllProducts);

// router.post('/block-product/:id',adminAuth, productController.blockProduct);
// router.post('/unblock-product/:id',adminAuth, productController.unblockProduct);
// router.delete('/delete-product/:id',adminAuth,productController.deleteProduct);
// router.get('/editProduct/:id',adminAuth,productController.getEditProduct)
// router.post('/editProduct/:id', adminAuth, upload,productController.editProduct);
// // router.post('/deleteImage',adminAuth,productController.deleteSingleImage) //// now currently not using



// router.get('/productVariants/:id',adminAuth,productController.productVariants);
// router.get('/colorVarient/:id', adminAuth, productController.colorVarients);
// router.post('/colorVariant/:id', upload, productController.addColorVariant);
// router.post('/variant/list/:productId/:variantId', productController.listVariant);
// router.post('/variant/unlist/:productId/:variantId', productController.unlistVariant);
// router.delete('/variant/delete/:productId/:variantId', productController.deleteVariant);
// router.get('/editVariant/:id', adminAuth, productController.editVariantForm);
// router.post('/colorVariant/edit/:id', adminAuth, upload, productController.updateVariant);  


// router.get('/orders',adminAuth, orderController.listOrders);
// router.get('/order-details/:id',adminAuth, orderController.orderDetails);
// router.post('/update-order-status/:id',adminAuth, orderController.updateOrderStatus);
// router.post('/cancel-order/:id', adminAuth, orderController.cancelEntireOrder);
// router.post('/cancel-order-item/:orderId', adminAuth, orderController.cancelOrderItem);
// router.get('/return-request-details/:orderId', adminAuth, orderController.getReturnRequestDetails);
// router.post('/handle-return-request', adminAuth, orderController.handleReturnRequest);
// router.get('/download-invoice/:orderId', adminAuth, orderController.downloadInvoice);

// router.get('/offers',adminAuth, offerController.renderOffersPage);
// router.get('/offers/check-existing', adminAuth, offerController.checkExistingOffers);
// router.get('/offers/create',adminAuth, offerController.renderCreateOfferPage);
// router.post('/offers/create',adminAuth, offerController.createOffer);
// router.get('/offers/edit/:id',adminAuth, offerController.renderEditOfferPage);
// router.put('/offers/edit/:id',adminAuth, offerController.updateOffer);
// router.delete('/offers/delete/:id',adminAuth, offerController.deleteOffer);
// router.patch('/offers/toggle-status/:id', adminAuth, offerController.toggleOfferStatus);
// router.get('/offers/get-products',adminAuth, offerController.getProductsForOffer);
// router.get('/offers/get-categories',adminAuth, offerController.getCategoriesForOffer);

 

// router.get('/coupons',adminAuth, couponController.getCoupons);
// router.post('/coupons/create',adminAuth, couponController.createCoupon);
// router.get('/check-coupon-code', couponController.checkCouponCode);
// router.get('/coupons/edit/:id',adminAuth, couponController.getEditCouponPage);
// router.put('/coupons/edit/:id',adminAuth, couponController.updateCoupon);
// router.delete('/coupons/delete/:id',adminAuth, couponController.deleteCoupon);
// router.patch('/coupons/toggle-status/:id',adminAuth, couponController.toggleCouponStatus);





// module.exports = router; 


 