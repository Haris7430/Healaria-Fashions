const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const mongoose = require('mongoose');

const getCheckoutPage = async (req, res) => {
    try {
        // Fetch user's addresses
        const userAddress = await Address.findOne({ userId: req.user._id });
        const addresses = userAddress ? userAddress.address : [];

        // Get cart items from session or database
        const cart = await Cart.findOne({ userId: req.user._id }).populate('items.productId');
        const cartItems = cart ? cart.items : [];

        // Calculate totals
        const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const shippingCost = 0; // Free shipping
        const total = subtotal + shippingCost;

        res.render('userCheckout', {
            addresses,
            cartItems,
            subtotal,
            shippingCost,
            total,
            user: req.user
        });
    } catch (error) {
        console.error('Error loading checkout page:', error);
        res.status(500).render('page-404', { 
            message: 'Error loading checkout page',
            error: error.message 
        });
    }
};

const createOrder = async (req, res) => {
    try {
        const { addressId, paymentMethod } = req.body;

        // Validate address
        const userAddress = await Address.findOne({ userId: req.user._id });
        const selectedAddress = userAddress.address.find(addr => addr._id.toString() === addressId);

        if (!selectedAddress) {
            return res.status(400).json({
                success: false,
                message: 'Invalid address selected'
            });
        }

        // Get cart items
        const cart = await Cart.findOne({ userId: req.user._id }).populate('items.productId');
        if (!cart || !cart.items.length) {
            return res.status(400).json({
                success: false,
                message: 'Cart is empty'
            });
        }

        // Calculate totals
        const subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const shippingCost = 0;
        const total = subtotal + shippingCost;

        // Create new order
        const newOrder = new Order({
            userId: req.user._id,
            items: cart.items.map(item => ({
                productId: item.productId._id,
                quantity: item.quantity,
                price: item.price,
                totalPrice: item.price * item.quantity
            })),
            shippingAddress: selectedAddress,
            paymentMethod,
            subtotal,
            shippingCost,
            total,
            status: paymentMethod === 'COD' ? 'pending' : 'processing'
        });

        await newOrder.save();

        // Clear cart after order creation
        await Cart.deleteOne({ userId: req.user._id });

        res.status(200).json({
            success: true,
            message: 'Order placed successfully',
            orderId: newOrder._id
        });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating order',
            error: error.message
        });
    }
};




const getOrderSummary = async (req, res) => {
    try {
        const { orderId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).render('page-404', { message: 'Invalid order ID format' });
        }

        const order = await Order.findById(orderId)
            .populate({
                path: 'items.productId',
                select: 'productName salesPrice productImages variants'
            });

        if (!order) {
            return res.status(404).render('page-404', { message: 'Order not found' });
        }

        // Prepare items with accessible images
        const orderItems = order.items.map(item => {
            const product = item.productId;
            return {
                ...item._doc,
                product: {
                    ...product._doc,
                    productImages: product.productImages || [],
                    variantImages: product.variants?.[0]?.images || []
                }
            };
        });

        res.render('userOrderSummary', {
            order,
            orderItems,
            user: req.user
        });
    } catch (error) {
        console.error('Error loading order summary:', error);
        res.status(500).render('page-404', { message: 'Error loading order summary' });
    }
};





module.exports = {
    getCheckoutPage,
    createOrder,
    getOrderSummary,
};