const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const mongoose = require('mongoose');
const Coupon = require('../../models/couponSchema');


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


const validateCoupon = async (req, res) => {
    try {
        const { couponCode, subtotal } = req.body;

        if (!couponCode || !subtotal) {
            return res.status(400).json({
                success: false,
                message: 'Coupon code and subtotal are required'
            });
        }

        const coupon = await Coupon.findOne({ 
            code: couponCode.toUpperCase() 
        });

        if (!coupon) {
            return res.status(400).json({
                success: false,
                message: 'Invalid coupon code'
            });
        }

        const now = new Date();
        if (
            coupon.status !== 'active' ||
            now < coupon.validFrom ||
            now > coupon.expiryDate
        ) {
            return res.status(400).json({
                success: false,
                message: 'Coupon is expired or inactive'
            });
        }

        const subtotalNumber = parseFloat(subtotal);
        if (subtotalNumber < coupon.minPurchaseLimit) {
            return res.status(400).json({
                success: false,
                message: `Minimum purchase of ₹${coupon.minPurchaseLimit} required to use this coupon`
            });
        }

        // Calculate percentage-based discount
        const percentageDiscount = Math.floor(subtotal * (coupon.discountPercentage / 100));
        
        // Determine final discount amount considering maximum limit
        const finalDiscountAmount = coupon.maxDiscountAmount 
            ? Math.min(percentageDiscount, coupon.maxDiscountAmount)
            : percentageDiscount;

        // Calculate discount ratio for proportional distribution
        const discountRatio = finalDiscountAmount / subtotalNumber;

        const cart = await Cart.findOne({ userId: req.user._id })
            .populate({
                path: 'items.productId',
                model: 'Product'
            });

        const productDiscounts = cart.items.map(item => {
            const itemTotal = item.price * item.quantity;
            const itemDiscount = Math.floor(itemTotal * discountRatio);

            return {
                productId: item.productId._id,
                productName: item.productId.productName,
                originalPrice: itemTotal,
                discountAmount: itemDiscount,
                finalPrice: itemTotal - itemDiscount
            };
        });

        const maxDiscountReached = finalDiscountAmount === coupon.maxDiscountAmount;

        return res.status(200).json({
            success: true,
            message: 'Coupon applied successfully',
            coupon: {
                code: coupon.code,
                discountPercentage: coupon.discountPercentage,
                discountAmount: finalDiscountAmount,
                maxDiscountAmount: coupon.maxDiscountAmount,
                maxDiscountReached,
                minPurchaseLimit: coupon.minPurchaseLimit,
                productDiscounts: productDiscounts
            }
        });
    } catch (error) {
        console.error('Coupon validation error:', error);
        res.status(500).json({
            success: false,
            message: 'Error validating coupon',
            error: error.message
        });
    }
};

const getAvailableCoupons = async (req, res) => {
    try {
        const subtotal = req.query.subtotal ? parseFloat(req.query.subtotal) : 0;
        const now = new Date();

        const coupons = await Coupon.find({
            status: 'active',
            validFrom: { $lte: now },
            expiryDate: { $gte: now },
            minPurchaseLimit: { $lte: subtotal }
        }).sort({ discountPercentage: -1 });

        const formattedCoupons = coupons.map(coupon => {
            // Calculate potential discount based on current subtotal
            const percentageDiscount = subtotal * (coupon.discountPercentage / 100);
            const maxPossibleDiscount = coupon.maxDiscountAmount 
                ? Math.min(percentageDiscount, coupon.maxDiscountAmount)
                : percentageDiscount;

            return {
                id: coupon._id,
                code: coupon.code,
                title: coupon.title,
                description: coupon.description,
                discountPercentage: coupon.discountPercentage,
                minPurchaseLimit: coupon.minPurchaseLimit,
                maxDiscountAmount: coupon.maxDiscountAmount,
                potentialDiscount: Math.floor(maxPossibleDiscount),
                validFrom: coupon.validFrom,
                expiryDate: coupon.expiryDate
            };
        });

        res.status(200).json({
            success: true,
            coupons: formattedCoupons
        });
    } catch (error) {
        console.error('Error fetching available coupons:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching coupons'
        });
    }
};

module.exports = {
    getCheckoutPage,
    createOrder,
    getOrderSummary,
    validateCoupon,
    getAvailableCoupons,
};