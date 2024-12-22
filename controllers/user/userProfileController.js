const User = require('../../models/userSchema'); // User schema
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');
const mongoose = require('mongoose');
const Product = require('../../models/productSchema');
const bcrypt = require('bcrypt'); 
const Wallet = require('../../models/walletSchema');


const getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.session.user._id);
        const section = req.params.section; 
        
        let data = [];
        if (section === 'orders') {
            data = await Order.find({ userId: user._id });
        } else if (section === 'addresses') {
            data = user.addresses;
        }
        
        // Render the profile page with activeSection and data
        res.render('userProfile', {
            user,
            activeSection: section || 'profile', 
            data
        });
    } catch (err) {
        console.error(err);
        res.redirect('/login');
    }
};


const updateProfile = async (req, res) => {
    try {
        const { name, phone } = req.body;
        
        // Server-side validation
        if (!name || name.length < 2 || name.length > 50 || !/^[A-Za-z\s]+$/.test(name)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid name. Must be 2-50 letters'
            });
        }

        // Optional phone validation
        if (phone && !/^[6-9]\d{9}$/.test(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid phone number'
            });
        }

        // Update user profile
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { name, phone },
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            user: updatedUser
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating profile',
            error: error.message
        });
    }
};



const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        // Validation regex
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;

        // Validate inputs
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Validate new password complexity
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters, include letters, numbers, and special characters'
            });
        }

        // Check password match
        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'New passwords do not match'
            });
        }

        // Prevent reusing current password
        const user = await User.findById(req.user._id);
        const isMatch = await bcrypt.compare(currentPassword, user.password);

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Check if new password is same as current
        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            return res.status(400).json({
                success: false,
                message: 'New password cannot be the same as current password'
            });
        }

        // Hash and update password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({
            success: false,
            message: 'Error changing password',
            error: error.message
        });
    }
};




const getAddressPage = async (req, res) => {
    try {
        // Fetch address document for the logged-in user
        const address = await Address.findOne({ userId: req.user._id });

        res.render('userProfile', {
            user: req.user,
            activeSection: 'addresses',
            address: address || { address: [] } // Provide empty array if no addresses found
        });
    } catch (error) {
        console.error("Error fetching addresses:", error);
        res.status(500).render('error', { message: 'Error fetching addresses' });
    }
};




const getAddAddress = (req, res) => {
    res.render('userProfile', { 
        user: req.user, 
        activeSection: 'add-address',
        data: []
    });
};




const addAddress = async (req, res) => {
    try {
        const { name, addressType, phone, altPhone, landmark, city, state, pincode } = req.body;

        // Comprehensive validation
        const validationErrors = [];

        // Name validation
        if (!name || !/^[A-Za-z\s]{2,50}$/.test(name.trim())) {
            validationErrors.push('Invalid name. Must be 2-50 letters');
        }

        // Address Type validation
        const validAddressTypes = ['Home', 'Work', 'Other'];
        if (!addressType || !validAddressTypes.includes(addressType)) {
            validationErrors.push('Invalid address type');
        }

        // Phone validation
        if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
            validationErrors.push('Invalid phone number');
        }

        // Optional Alt Phone validation
        if (altPhone && !/^[6-9]\d{9}$/.test(altPhone)) {
            validationErrors.push('Invalid alternative phone number');
        }

        // Landmark validation
        if (!landmark || landmark.trim().length < 3 || landmark.trim().length > 100) {
            validationErrors.push('Landmark must be 3-100 characters');
        }

        // City validation
        if (!city || !/^[A-Za-z\s]{2,50}$/.test(city.trim())) {
            validationErrors.push('Invalid city name');
        }

        // State validation
        if (!state || !/^[A-Za-z\s]{2,50}$/.test(state.trim())) {
            validationErrors.push('Invalid state name');
        }

        // Pincode validation
        if (!pincode || !/^\d{6}$/.test(pincode)) {
            validationErrors.push('Invalid pincode');
        }

        // If there are validation errors, return them
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validation Failed',
                errors: validationErrors
            });
        }

        let userAddress = await Address.findOne({ userId: req.user._id });

        if (!userAddress) {
            userAddress = new Address({
                userId: req.user._id,
                address: []
            });
        }

        const newAddress = {
            name: name.trim(),
            addressType,
            phone,
            altPhone: altPhone ? altPhone.trim() : '',
            landmark: landmark.trim(),
            city: city.trim(),
            state: state.trim(),
            pincode
        };

        // Add new address to array
        userAddress.address.push(newAddress);

        // Save the document
        await userAddress.save();

        return res.status(200).json({
            success: true,
            message: 'Address added successfully',
            redirectUrl: '/profile/addresses'
        });

    } catch (error) {
        console.error('Error adding address:', error);
        return res.status(500).json({
            success: false,
            message: 'Error adding address',
            error: error.message
        });
    }
};



const getAddressById = async (req, res) => {
    try {
        const addressId = req.params.id;
        const userId = req.user._id;

        console.log('Fetching address:', { addressId, userId }); // Debug log

        const userAddress = await Address.findOne({ userId });

        if (!userAddress || !userAddress.address) {
            console.log('No addresses found for user:', userId); // Debug log
            return res.status(404).json({
                success: false,
                message: 'No addresses found for this user'
            });
        }

        const address = userAddress.address.find(addr => 
            addr._id.toString() === addressId
        );

        console.log('Found address:', address); // Debug log

        if (!address) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }

        return res.status(200).json({
            success: true,
            address
        });
    } catch (error) {
        console.error('Error fetching address:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching address details',
            error: error.message
        });
    }
};




// Update Address Controller
const updateAddress = async (req, res) => {
    try {
        const addressId = req.params.id;
        const userId = req.user._id;
        const { 
            name, 
            addressType, 
            phone, 
            altPhone, 
            landmark, 
            city, 
            state, 
            pincode 
        } = req.body;

        // Comprehensive validation
        const validationErrors = [];

        // Validation rules object
        const validationRules = {
            name: {
                regex: /^[A-Za-z\s]{2,50}$/,
                message: 'Name must be 2-50 letters only'
            },
            addressType: {
                values: ['Home', 'Work', 'Other'],
                message: 'Invalid address type'
            },
            phone: {
                regex: /^[6-9]\d{9}$/,
                message: 'Phone number must be 10 digits starting with 6-9'
            },
            altPhone: {
                regex: /^[6-9]\d{9}$/,
                optional: true,
                message: 'Alternative phone number must be 10 digits starting with 6-9'
            },
            landmark: {
                minLength: 3,
                maxLength: 100,
                message: 'Landmark must be 3-100 characters'
            },
            city: {
                regex: /^[A-Za-z\s]{2,50}$/,
                message: 'City must be 2-50 letters only'
            },
            state: {
                regex: /^[A-Za-z\s]{2,50}$/,
                message: 'State must be 2-50 letters only'
            },
            pincode: {
                regex: /^\d{6}$/,
                message: 'Pincode must be 6 digits'
            }
        };

        // Perform validation
        Object.keys(validationRules).forEach(field => {
            const rule = validationRules[field];
            const value = req.body[field];

            // Skip optional fields if not provided
            if (rule.optional && !value) return;

            // Check required fields
            if (!value && !rule.optional) {
                validationErrors.push(`${field.charAt(0).toUpperCase() + field.slice(1)} is required`);
                return;
            }

            // Regex validation
            if (rule.regex && !rule.regex.test(value)) {
                validationErrors.push(rule.message);
            }

            // Address type validation
            if (field === 'addressType' && rule.values && !rule.values.includes(value)) {
                validationErrors.push(rule.message);
            }

            // Length validation
            if (rule.minLength && value.length < rule.minLength) {
                validationErrors.push(`${field} must be at least ${rule.minLength} characters`);
            }
            if (rule.maxLength && value.length > rule.maxLength) {
                validationErrors.push(`${field} must be at most ${rule.maxLength} characters`);
            }
        });

        // Return validation errors if any
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validation Failed',
                errors: validationErrors
            });
        }

        // Find the user's address document
        const userAddress = await Address.findOne({ userId });

        if (!userAddress) {
            return res.status(404).json({
                success: false,
                message: 'No addresses found for this user'
            });
        }

        // Find the specific address in the array
        const addressIndex = userAddress.address.findIndex(
            addr => addr._id.toString() === addressId
        );

        if (addressIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }

        // Sanitize and update the specific address
        userAddress.address[addressIndex] = {
            ...userAddress.address[addressIndex].toObject(),
            name: name.trim(),
            addressType,
            phone,
            altPhone: altPhone ? altPhone.trim() : '',
            landmark: landmark.trim(),
            city: city.trim(),
            state: state.trim(),
            pincode
        };

        // Save the updated document
        await userAddress.save();

        return res.status(200).json({
            success: true,
            message: 'Address updated successfully'
        });

    } catch (error) {
        console.error('Error updating address:', error);
        return res.status(500).json({
            success: false,
            message: 'Error updating address',
            error: error.message
        });
    }
};


// Add this to your profile routes in `adminRouter.js`
const deleteAddress = async (req, res) => {
    const addressId = req.params.id;

    try {
        // Find the address document for the user
        const userAddress = await Address.findOne({ userId: req.user._id });
        
        if (!userAddress) {
            return res.status(404).json({ 
                success: false, 
                message: 'No addresses found for this user' 
            });
        }

        // Find and remove the specific address from the array
        const addressIndex = userAddress.address.findIndex(
            addr => addr._id.toString() === addressId
        );

        if (addressIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                message: 'Address not found' 
            });
        }

        // Remove the address from the array
        userAddress.address.splice(addressIndex, 1);

        // Save the updated document
        await userAddress.save();

        res.json({ 
            success: true, 
            message: 'Address deleted successfully' 
        });
    } catch (err) {
        console.error('Delete address error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error deleting address' 
        });
    }
};




const getDashboard = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const address = await Address.findOne({ userId: req.user._id });
        
        res.render('userProfile', {
            user,
            activeSection: 'profile',
            address: address || { address: [] }
        });
    } catch (err) {
        console.error(err);
        res.redirect('/login');
    }
};




const getEditProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.render('userProfile', {
            user,
            activeSection: 'edit-profile'
        });
    } catch (err) {
        console.error(err);
        res.redirect('/dashboard');
    }
};





const getChangePasswordPage = async (req, res) => {
    try {
        // Render the profile page with the change password section active
        res.render('userProfile', { 
            user: req.user, 
            activeSection: 'forgot-password' // This matches the condition in your EJS template
        });
    } catch (error) {
        console.error('Error loading change password page:', error);
        res.status(500).render('error', {
            message: 'Error loading change password page'
        });
    }
};













const getUserOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5; // Change to 5 orders per page
        const skip = (page - 1) * limit;

        const totalOrders = await Order.countDocuments({ userId: req.user._id });
        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await Order.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate({
                path: 'items.productId',
                select: 'productName category'
            })
            .populate('items.productId.category');

        res.render('userProfile', {
            activeSection: 'orders',
            orders,
            user: req.user,
            currentPage: page,
            totalPages: totalPages
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).render('page-404', { 
            message: 'Error fetching orders',
            error: error.message 
        });
    }
};



const getOrderDetails = async (req, res) => {
    try {
        const { orderId } = req.params;
  
        // Update to handle both ObjectId and orderId string
        const order = await Order.findOne({ 
            $or: [
                { _id: orderId },
                { orderId: orderId }
            ], 
            userId: req.user._id 
        }).populate({
            path: 'items.productId',
            populate: [
                { path: 'category', select: 'name' },
                { path: 'variants' }
            ]
        });
  
        if (!order) {
            return res.status(404).render('page-404', { message: 'Order not found' });
        }
  
        const orderItems = order.items.map((item) => ({
            ...item.toObject(),
            product: {
                ...item.productId.toObject(),
                productImages: item.productId.productImages || [],
                variantImages: item.productId.variants?.[0]?.images || [],
                category: item.productId.category
            },
        }));
  
        res.render('orderSummary', { order, orderItems, user: req.user });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).render('page-404', { message: 'Error fetching order details', error: error.message });
    }
};



 

const handleRefundToWallet = async (userId, amount, description, orderId) => {
    try {
        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = new Wallet({ userId });
        }

        // Add refund transaction
        wallet.balance += amount;
        wallet.transactions.push({
            amount,
            type: 'credit',
            description,
            orderId,
            balance: wallet.balance
        });

        await wallet.save();
        return true;
    } catch (error) {
        console.error('Refund to wallet error:', error);
        return false;
    }
};

const cancelOrderItem = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        
        const order = await Order.findOne({ 
            _id: orderId, 
            userId: req.user._id 
        }).populate('items.productId');

        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found' 
            });
        }

        const orderItem = order.items.id(itemId);
        
        if (!orderItem) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order item not found' 
            });
        }

        // Check if item can be cancelled
        if (order.status === 'delivered' || order.status === 'cancelled' || orderItem.status === 'cancelled') {
            return res.status(400).json({ 
                success: false, 
                message: 'Cannot cancel this order' 
            });
        }

        // Calculate refund amount for this item
        let refundAmount = orderItem.totalPrice;
        
        // If coupon was applied, calculate proportional discount
        if (order.couponApplied && order.couponApplied.discountAmount) {
            const orderSubtotal = order.items.reduce((sum, item) => sum + item.totalPrice, 0);
            const itemDiscountProportion = orderItem.totalPrice / orderSubtotal;
            const itemCouponDiscount = order.couponApplied.discountAmount * itemDiscountProportion;
            refundAmount -= itemCouponDiscount;
        }

        // Process refund to wallet
        const refundSuccess = await handleRefundToWallet(
            order.userId,
            refundAmount,
            `Refund for cancelled item from order #${order.orderId}`,
            order._id
        );

        if (!refundSuccess) {
            return res.status(500).json({
                success: false,
                message: 'Failed to process refund'
            });
        }

        // Update order item status
        orderItem.status = 'cancelled';
        
        // If all items are cancelled, update order status
        const allItemsCancelled = order.items.every(item => item.status === 'cancelled');
        if (allItemsCancelled) {
            order.status = 'cancelled';
        }

        // Restore product inventory
        const product = await Product.findById(orderItem.productId);
        if (product) {
            const variant = product.variants.find(v => v.color === orderItem.color);
            if (variant) {
                const sizeVariant = variant.sizes.find(s => s.size === orderItem.size);
                if (sizeVariant) {
                    sizeVariant.quantity += orderItem.quantity;
                    await product.save();
                }
            }
        }

        await order.save();

        res.json({ 
            success: true, 
            message: 'Item cancelled successfully and refund processed',
            orderStatus: order.status,
            itemStatus: orderItem.status,
            refundAmount
        });
    } catch (error) {
        console.error('Cancel Order Item Error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Failed to cancel order item' 
        });
    }
};

const cancelEntireOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        
        const order = await Order.findOne({ 
            _id: orderId, 
            userId: req.user._id 
        });

        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found' 
            });
        }

        // Check if order can be cancelled
        if (order.status === 'delivered' || order.status === 'cancelled') {
            return res.status(400).json({ 
                success: false, 
                message: 'Cannot cancel this order' 
            });
        }

        // Calculate total refund amount
        let refundAmount = order.total;
        
        // Process refund to wallet
        const refundSuccess = await handleRefundToWallet(
            order.userId,
            refundAmount,
            `Refund for cancelled order #${order.orderId}`,
            order._id
        );

        if (!refundSuccess) {
            return res.status(500).json({
                success: false,
                message: 'Failed to process refund'
            });
        }

        // Restore inventory for all items
        for (const item of order.items) {
            if (item.status !== 'cancelled') {
                const product = await Product.findById(item.productId);
                if (product) {
                    const variant = product.variants.find(v => v.color === item.color);
                    if (variant) {
                        const sizeVariant = variant.sizes.find(s => s.size === item.size);
                        if (sizeVariant) {
                            sizeVariant.quantity += item.quantity;
                            await product.save();
                        }
                    }
                }
                item.status = 'cancelled';
            }
        }

        order.status = 'cancelled';
        await order.save();

        res.json({ 
            success: true, 
            message: 'Order cancelled successfully and refund processed',
            orderStatus: order.status,
            refundAmount
        });
    } catch (error) {
        console.error('Cancel Entire Order Error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to cancel order' 
        });
    }
};


const getWallet = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        let wallet = await Wallet.findOne({ userId: req.user._id });
        if (!wallet) {
            wallet = new Wallet({ userId: req.user._id });
            await wallet.save();
        }

        // Get total count for pagination
        const totalTransactions = wallet.transactions.length;
        const totalPages = Math.ceil(totalTransactions / limit);

        // Get paginated transactions
        const transactions = wallet.transactions
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(skip, skip + limit);

        res.render('userProfile', {
            user: req.user,
            activeSection: 'wallet',
            wallet,
            transactions,
            currentPage: page,
            totalPages,
            totalTransactions
        });
    } catch (error) {
        console.error('Error fetching wallet:', error);
        res.status(500).render('error', { message: 'Error fetching wallet details' });
    }
};
  


const returnOrderItem = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const { reason, customReason } = req.body;

        // Validate input
        if (!reason) {
            return res.status(400).json({
                success: false,
                message: 'Return reason is required'
            });
        }

        const order = await Order.findOne({
            _id: orderId,
            userId: req.user._id
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        const orderItem = order.items.id(itemId);

        if (!orderItem) {
            return res.status(404).json({
                success: false,
                message: 'Order item not found'
            });
        }

        // Check if item is eligible for return
        if (orderItem.status !== 'placed' || order.status !== 'delivered') {
            return res.status(400).json({
                success: false,
                message: 'This item is not eligible for return'
            });
        }

        // Calculate refund amount including proportional coupon discount
        let refundAmount = orderItem.totalPrice;

        if (order.couponApplied && order.couponApplied.discountAmount) {
            const orderSubtotal = order.items.reduce((sum, item) => sum + item.totalPrice, 0);
            const itemDiscountProportion = orderItem.totalPrice / orderSubtotal;
            const itemCouponDiscount = order.couponApplied.discountAmount * itemDiscountProportion;
            refundAmount -= itemCouponDiscount;
        }

        // Create return request
        orderItem.status = 'return_requested';
        orderItem.returnRequest = {
            itemId: orderItem._id,
            reason: reason,
            customReason: reason === 'other' ? customReason : null,
            status: 'pending',
            refundAmount: refundAmount
        };

        await order.save();

        res.status(200).json({
            success: true,
            message: 'Return request submitted successfully',
            itemStatus: orderItem.status,
            refundAmount: refundAmount
        });

    } catch (error) {
        console.error('Return Order Item Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to submit return request'
        });
    }
};



module.exports = {
    getUserProfile,
    updateProfile,
    changePassword,
    getAddressPage,
    getAddAddress,
    addAddress,
    
    getAddressById,
    updateAddress,
    deleteAddress,
    getDashboard,
    getEditProfile,
    getChangePasswordPage,
    getUserOrders,
    getOrderDetails,
    cancelOrderItem,
    cancelEntireOrder,
    getWallet,
    returnOrderItem,



};
