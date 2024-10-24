const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin/adminController');
const { userAuth, adminAuth } = require('../middleware/auth');
const customerController = require('../controllers/admin/customerController');
const categoryController = require('../controllers/admin/categoryController');

router.get('/pageerror', adminController.pageerror);
router.get('/admin-login', adminController.loadLogin);
router.post('/admin-login', adminController.login);
router.get('/admin-dashboard', adminAuth, adminController.loadDashboard);
router.get('/admin-logout', adminController.logout);

router.get('/all-customers', adminAuth, customerController.customerInfo);
router.get('/blockCustomer', adminAuth, customerController.customerBlocked);
router.get('/unblockCustomer', adminAuth, customerController.customerunBlocked);

router.get('/category', adminAuth, categoryController.categoryInfo);
router.post('/addCategory', adminAuth, categoryController.addCategory);
router.get('/listCategory',adminAuth,categoryController.getListCategory);
router.get('/unlistCategory',adminAuth,categoryController.getUnlistCategory);

module.exports = router;
