



const express = require('express');
const router = express.Router();
const path= require('path')
// Import multer
const adminController = require('../controllers/admin/adminController');
const { userAuth, adminAuth } = require('../middleware/auth');
const customerController = require('../controllers/admin/customerController');
const categoryController = require('../controllers/admin/categoryController');
const productController = require('../controllers/admin/productController');
const orderController = require('../controllers/admin/orderController')
const multer = require('multer'); 
const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({ storage }).array('images', 10);

 

// Define routes
router.get('/pageerror', adminController.pageerror);
router.get('/admin-login', adminController.loadLogin);
router.post('/admin-login', adminController.login);
router.get('/admin-dashboard', adminAuth, adminController.loadDashboard);
router.get('/admin-logout', adminController.logout);

router.get('/all-customers', adminAuth, customerController.customerInfo);
router.get('/blockCustomer', adminAuth, customerController.customerBlocked);
router.get('/unblockCustomer', adminAuth, customerController.customerunBlocked);
router.get('/deleteCustomer',adminAuth, customerController.deleteCustomer);


router.get('/category', adminAuth, categoryController.categoryInfo);
router.post('/addCategory', adminAuth, categoryController.addCategory);
router.get('/listCategory', adminAuth, categoryController.getListCategory);
router.get('/unlistCategory', adminAuth, categoryController.getUnlistCategory);
router.get('/editCategory', adminAuth, categoryController.getEditCategory);
router.post('/editCategory/:id', adminAuth, categoryController.editCategory);

// Use multer middleware here
router.get('/addProducts', adminAuth, productController.getProductAddPage);
router.post("/addProducts", adminAuth, upload, productController.addProducts);
router.get('/products',adminAuth,productController.getAllProducts);

router.post('/block-product/:id',adminAuth, productController.blockProduct);
router.post('/unblock-product/:id',adminAuth, productController.unblockProduct);
router.delete('/delete-product/:id',adminAuth,productController.deleteProduct);
router.get('/editProduct/:id',adminAuth,productController.getEditProduct)
router.post('/editProduct/:id', adminAuth, upload,productController.editProduct);
// router.post('/deleteImage',adminAuth,productController.deleteSingleImage) //// now currently not using



router.get('/productVariants/:id',adminAuth,productController.productVariants);
router.get('/colorVarient/:id', adminAuth, productController.colorVarients);
router.post('/colorVariant/:id', upload, productController.addColorVariant);
router.post('/variant/list/:productId/:variantId', productController.listVariant);
router.post('/variant/unlist/:productId/:variantId', productController.unlistVariant);
router.delete('/variant/delete/:productId/:variantId', productController.deleteVariant);
router.get('/editVariant/:id', adminAuth, productController.editVariantForm);

router.post('/colorVariant/edit/:id', adminAuth, upload, productController.updateVariant);  


router.get('/orders',adminAuth, orderController.listOrders);
router.get('/order-details/:id',adminAuth, orderController.orderDetails);
router.post('/update-order-status/:id',adminAuth, orderController.updateOrderStatus);
router.post('/cancel-order/:id', adminAuth, orderController.cancelEntireOrder);
router.post('/cancel-order-item/:orderId', adminAuth, orderController.cancelOrderItem);



 
module.exports = router; 


 