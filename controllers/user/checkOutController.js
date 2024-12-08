const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const mongoose = require('mongoose');

const getCheckoutPage = async (req, res) => {
    try {
        // Fetch user's addresses
        const userAddress = await Address.findOne({ userId: req.user._id });
        const addresses = userAddress ? userAddress.address : [];

        // Get cart items from database with full product details
        const cart = await Cart.findOne({ userId: req.user._id })
            .populate({
                path: 'items.productId',
                model: 'Product',
                populate: {
                    path: 'variants',
                    model: 'Product'
                }
            });

        const cartItems = cart ? cart.items.map(item => {
            // Find the specific variant for the cart item
            const product = item.productId;
            const variant = product.variants.find(v => 
                v._id.toString() === item.variantId.toString()
            );

            return {
                ...item.toObject(),
                productName: product.productName,
                variantColor: item.color,
                variantSize: item.size,
                variantImage: variant ? 
                    (variant.images.find(img => img.mainImage) || variant.images[0])?.filename 
                    : null,
                variantDetails: variant ? {
                    color: variant.color,
                    images: variant.images,
                    mainImage: variant.images.find(img => img.mainImage) || variant.images[0]
                } : null
            };
        }) : [];

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





const updateProductVariantQuantities = async (order, isCancel = false) => {
    try {
        for (const item of order.items) {
            const product = await Product.findById(item.productId);
            if (!product) continue;

            const variant = product.variants.id(item.variantId);
            if (!variant) continue;

            // Find the specific size in the variant
            const sizeVariant = variant.sizes.find(s => s.size === item.size);
            if (!sizeVariant) continue;

            // Adjust quantity based on order or cancellation
            const quantityChange = isCancel ? item.quantity : -item.quantity;
            sizeVariant.quantity += quantityChange;

            await product.save();
        }
    } catch (error) {
        console.error('Error updating product variant quantities:', error);
        res.redirect('/admin/pageNotFound')
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

        // Get cart items with full product details
        const cart = await Cart.findOne({ userId: req.user._id })
            .populate({
                path: 'items.productId',
                model: 'Product',
                populate: {
                    path: 'variants',
                    model: 'Product'
                }
            });

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

        // Create new order with detailed item information
        const newOrder = new Order({
            userId: req.user._id,
            items: cart.items.map(item => ({
                productId: item.productId._id,
                quantity: item.quantity,
                price: item.price,
                totalPrice: item.price * item.quantity,
                color: item.color,
                size: item.size,
                variantId: item.variantId
            })),
            shippingAddress: {
                name: selectedAddress.name,
                addressType: selectedAddress.addressType,
                city: selectedAddress.city,
                landmark: selectedAddress.landmark,
                state: selectedAddress.state,
                pincode: selectedAddress.pincode,
                phone: selectedAddress.phone,
                altPhone: selectedAddress.altPhone || ''
            },
            paymentMethod,
            subtotal,
            shippingCost,
            total,
            status: paymentMethod === 'COD' ? 'pending' : 'processing',
            paymentStatus: 'pending'
        });

        await newOrder.save();
        await updateProductVariantQuantities(newOrder);

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
                populate: {
                    path: 'variants',
                    model: 'Product'
                }
            });

        if (!order) {
            return res.status(404).render('page-404', { message: 'Order not found' });
        }

        // Prepare items with variant images
        const orderItems = order.items.map(item => {
            const product = item.productId;
            const variant = product.variants.find(v => 
                v._id.toString() === item.variantId.toString()
            );

            return {
                ...item.toObject(),
                product: {
                    ...product.toObject(),
                    productImages: variant ? 
                        variant.images.map(img => img.filename) 
                        : [],
                    variantImages: variant ? 
                        variant.images.map(img => img.filename) 
                        : [],
                    variantImage: variant ? 
                        (variant.images.find(img => img.mainImage) || variant.images[0])?.filename 
                        : null,
                    color: item.color,
                    size: item.size
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