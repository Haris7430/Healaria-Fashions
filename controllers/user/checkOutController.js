const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const mongoose = require('mongoose');
const Coupon = require('../../models/couponSchema');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Wallet = require('../../models/walletSchema');



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



const checkWalletBalance = async (req, res) => {
    try {
        const wallet = await Wallet.findOne({ userId: req.user._id });
        const balance = wallet ? wallet.balance : 0;
        
        res.json({
            success: true,
            balance: balance
        });
    } catch (error) {
        console.error('Error checking wallet balance:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking wallet balance'
        });
    }
};




const createOrder = async (req, res) => {
    try {
        const { addressId, paymentMethod, couponCode } = req.body;

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
        const cart = await Cart.findOne({ userId: req.user._id })
            .populate({
                path: 'items.productId',
                model: 'Product'
            });

        if (!cart || !cart.items.length) {
            return res.status(400).json({
                success: false,
                message: 'Cart is empty'
            });
        }

        // Calculate initial totals
        const subtotal = Math.round(cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0));
        let discountAmount = 0;
        let couponDetails = null;
        const shippingCost = 0;

        // Apply coupon if provided
        if (couponCode) {
            const coupon = await Coupon.findOne({ 
                code: couponCode.toUpperCase(),
                status: 'active'
            });

            if (coupon) {
                const percentageDiscount = subtotal * (coupon.discountPercentage / 100);
                discountAmount = Math.round(Math.min(percentageDiscount, coupon.maxDiscountAmount));
                
                couponDetails = {
                    code: coupon.code,
                    discountPercentage: coupon.discountPercentage,
                    discountAmount: discountAmount
                };
            }
        }

        // Calculate final total
        const total = Math.round(subtotal + shippingCost - discountAmount);

        // Create new order
        const newOrder = new Order({
            userId: req.user._id,
            items: cart.items.map(item => ({
                productId: item.productId._id,
                quantity: item.quantity,
                price: item.price,
                totalPrice: Math.round(item.price * item.quantity),
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
            discountAmount,
            total,
            couponApplied: couponDetails,
            status: 'pending',
            paymentStatus: 'pending'
        });

        await newOrder.save();

        // Handle wallet payment
        if (paymentMethod === 'Wallet') {
            const wallet = await Wallet.findOne({ userId: req.user._id });
            if (!wallet || wallet.balance < total) {
                return res.status(400).json({
                    success: false,
                    message: 'Insufficient wallet balance'
                });
            }

            // Deduct amount from wallet
            wallet.balance -= total;
            wallet.transactions.push({
                amount: total,
                type: 'debit',
                description: `Payment for order ${newOrder.orderId}`,
                orderId: newOrder._id,
                balance: wallet.balance
            });
            await wallet.save();

            // Update order status
            newOrder.paymentStatus = 'paid';
            newOrder.status = 'processing';
            newOrder.walletAmountUsed = total;
            await newOrder.save();

            // Update product quantities and clear cart
            await updateProductVariantQuantities(newOrder);
            await Cart.deleteOne({ userId: req.user._id });

            return res.status(200).json({
                success: true,
                message: 'Order placed successfully',
                orderId: newOrder._id,
                paymentMethod: 'Wallet'
            });
        }

        // Handle other payment methods
        if (paymentMethod === 'COD') {
            await updateProductVariantQuantities(newOrder);
            await Cart.deleteOne({ userId: req.user._id });
            newOrder.status = 'processing';
            await newOrder.save();
        } else if (paymentMethod === 'RazorPay') {
            const razorpayOrder = await createRazorpayOrder(newOrder);
            return res.status(200).json({
                success: true,
                message: 'Order placed successfully',
                orderId: newOrder._id,
                total: newOrder.total,
                razorpayOrderId: razorpayOrder.id
            });
        }

        res.status(200).json({
            success: true,
            message: 'Order placed successfully',
            orderId: newOrder._id,
            total: newOrder.total
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






// Function to create Razorpay order
const createRazorpayOrder = async (order) => {
    try {
        const instance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });

        const options = {
            amount: Math.round(order.total * 100), // Convert to paise and ensure it's an integer
            currency: 'INR',
            receipt: order._id.toString(),
            notes: {
                orderId: order._id.toString()
            }
        };

        const razorpayOrder = await instance.orders.create(options);
        return razorpayOrder;
    } catch (error) {
        console.error('Razorpay order creation failed:', error);
        throw error;
    }
};



const verifyPayment = async (req, res) => {
    try {
        const {
            orderId,
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
            paymentCancelled
        } = req.body;

        if (paymentCancelled) {
            await Order.findByIdAndUpdate(orderId, {
                status: 'pending', // Changed from 'cancelled' to 'pending'
                paymentStatus: 'failed'
            });

            return res.status(200).json({
                success: true,
                message: 'Payment failed',
                orderId
            });
        }

        // Verify signature
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest("hex");

        const isAuthentic = expectedSignature === razorpay_signature;

        if (!isAuthentic) {
            await Order.findByIdAndUpdate(orderId, {
                status: 'cancelled',
                paymentStatus: 'failed'
            });

            return res.status(400).json({
                success: false,
                message: 'Payment verification failed'
            });
        }

        // Update order status and clear cart
        const order = await Order.findByIdAndUpdate(orderId, {
            status: 'processing',
            paymentStatus: 'paid',
            paymentDetails: {
                razorpay_payment_id,
                razorpay_order_id,
                razorpay_signature
            }
        }, { new: true });

        await updateProductVariantQuantities(order);
        await Cart.deleteOne({ userId: req.user._id });

        res.json({
            success: true,
            message: 'Payment verified successfully'
        });
    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying payment'
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
        const subtotalNumber = parseFloat(subtotal);

        const coupon = await Coupon.findOne({ 
            code: couponCode.toUpperCase(),
            status: 'active'
        });

        if (!coupon) {
            return res.status(400).json({
                success: false,
                message: 'Invalid coupon code'
            });
        }

        // Calculate discount amount
        const percentageDiscount = (subtotalNumber * (coupon.discountPercentage / 100));
        const finalDiscountAmount = Math.min(
            percentageDiscount, 
            coupon.maxDiscountAmount || Infinity
        );

        // Round to 2 decimal places
        const roundedDiscountAmount = Math.round(finalDiscountAmount * 100) / 100;

        // Calculate individual product discounts proportionally
        const cart = await Cart.findOne({ userId: req.user._id });
        const totalValue = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        const productDiscounts = cart.items.map(item => {
            const itemTotal = item.price * item.quantity;
            const itemDiscountRatio = itemTotal / totalValue;
            const itemDiscount = Math.round(roundedDiscountAmount * itemDiscountRatio * 100) / 100;

            return {
                productId: item.productId,
                originalPrice: itemTotal,
                discountAmount: itemDiscount,
                finalPrice: itemTotal - itemDiscount
            };
        });

        res.status(200).json({
            success: true,
            coupon: {
                code: coupon.code,
                discountPercentage: coupon.discountPercentage,
                discountAmount: roundedDiscountAmount,
                maxDiscountAmount: coupon.maxDiscountAmount,
                productDiscounts
            }
        });

    } catch (error) {
        console.error('Coupon validation error:', error);
        res.status(500).json({
            success: false,
            message: 'Error validating coupon'
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
    verifyPayment,
    getOrderSummary,
    validateCoupon,
    getAvailableCoupons,
    checkWalletBalance,
};