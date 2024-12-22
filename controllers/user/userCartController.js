const User = require('../../models/userSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const Cart = require('../../models/cartSchema');
const Offer = require('../../models/offerSchema');


const getCartPage = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/login');
        }

        const cart = await Cart.findOne({ userId: req.session.user._id })
            .populate({
                path: 'items.productId',
                model: 'Product',
                populate: {
                    path: 'variants',
                    model: 'Product'
                }
            });

        if (!cart) {
            return res.render('userCart', { 
                cart: { items: [] },
                subtotal: 0
            });
        }

        // Recalculate subtotal with original prices
        const subtotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);

        res.render('userCart', { 
            cart, 
            subtotal 
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
};

const addToCart = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ 
                status: 'unauthorized', 
                message: 'Please log in to add items to cart' 
            });
        }

        const productId = req.params.id;
        const userId = req.session.user._id;
        const { quantity = 1, size, variantId } = req.body;

        const product = await Product.findById(productId)
            .populate('category');
        if (!product) {
            return res.status(404).json({ 
                status: 'error',
                message: "Product not found" 
            });
        }

        // Find applicable offers
        const offers = await Offer.find({
            $or: [
                { offerType: 'product', productIds: productId },
                { offerType: 'category', categoryIds: product.category._id }
            ],
            status: 'active',
            expireDate: { $gte: new Date() }
        });

        // Calculate the maximum discount
        let maxDiscount = 0;
        let applicableOfferName = '';
        
        offers.forEach(offer => {
            if (offer.offerType === 'product' && offer.productIds.includes(productId)) {
                maxDiscount = Math.max(maxDiscount, offer.discount);
                applicableOfferName = offer.offerName;
            } else if (offer.offerType === 'category' && offer.categoryIds.includes(product.category._id)) {
                maxDiscount = Math.max(maxDiscount, offer.discount);
                applicableOfferName = offer.offerName;
            }
        });

        // Calculate discounted price
        const originalPrice = product.regularPrice;
        const discountedPrice = originalPrice * (1 - maxDiscount / 100);

        // Validate quantity
        if (quantity > 5) {
            return res.status(400).json({ 
                status: 'error',
                message: "Cannot add more than 5 of this product" 
            });
        }

        // Find the specific variant
        const selectedVariant = product.variants.find(v => 
            v._id && variantId && v._id.toString() === variantId.toString()
        );

        if (!selectedVariant) {
            return res.status(404).json({ 
                status: 'error',
                message: "Selected variant not found" 
            });
        }

        // Check available quantity for specific size
        const sizeObj = selectedVariant.sizes.find(s => s.size === parseInt(size));
        if (!sizeObj || sizeObj.quantity < quantity) {
            return res.status(400).json({ 
                status: 'error',
                message: `Only ${sizeObj ? sizeObj.quantity : 0} items available in stock` 
            });
        }

        // Find or create cart
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }

        // Check if item already exists in cart with same product, variant, and size
        const existingItemIndex = cart.items.findIndex(item => 
            item.productId && productId && 
            item.productId.toString() === productId.toString() &&
            item.variantId && variantId && 
            item.variantId.toString() === variantId.toString() &&
            item.size === parseInt(size)
        );

        if (existingItemIndex !== -1) {
            return res.status(400).json({ 
                status: 'error',
                message: "Product with this variant and size already in the cart" 
            });
        }

        // Add new item to cart with offer details
        const cartItem = {
            productId,
            variantId: selectedVariant._id,
            size: parseInt(size),
            color: selectedVariant.color,
            quantity,
            originalPrice,
            price: discountedPrice,
            totalPrice: discountedPrice * quantity,
            availableQuantity: sizeObj.quantity
        };

        // Add offer details if applicable
        if (maxDiscount > 0) {
            cartItem.offer = {
                discount: maxDiscount,
                offerName: applicableOfferName
            };
        }

        cart.items.push(cartItem);

        await cart.save();
        return res.status(200).json({ 
            status: 'success', 
            message: "Product added to cart successfully" 
        });
    } catch (error) {
        console.error('Add to cart error:', error);
        res.status(500).json({ 
            status: 'error', 
            message: "Server error" 
        });
    }
};

const updateCart = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { productId } = req.params;
        const { quantity, color, size, variantId } = req.body;
        const userId = req.session.user._id;

        const product = await Product.findById(productId)
            .populate('category');
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        // Find applicable offers (same logic as addToCart)
        const offers = await Offer.find({
            $or: [
                { offerType: 'product', productIds: productId },
                { offerType: 'category', categoryIds: product.category._id }
            ],
            status: 'active',
            expireDate: { $gte: new Date() }
        });

        // Calculate the maximum discount
        let maxDiscount = 0;
        let applicableOfferName = '';
        
        offers.forEach(offer => {
            if (offer.offerType === 'product' && offer.productIds.includes(productId)) {
                maxDiscount = Math.max(maxDiscount, offer.discount);
                applicableOfferName = offer.offerName;
            } else if (offer.offerType === 'category' && offer.categoryIds.includes(product.category._id)) {
                maxDiscount = Math.max(maxDiscount, offer.discount);
                applicableOfferName = offer.offerName;
            }
        });

        // Calculate discounted price
        const originalPrice = product.regularPrice;
        const discountedPrice = originalPrice * (1 - maxDiscount / 100);

        // Find the cart for the user
        const userCart = await Cart.findOne({ userId });
        
        if (!userCart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        // Find the specific item in the cart
        const itemIndex = userCart.items.findIndex(
            item => item.productId.toString() === productId &&
                    item.color === color &&
                    item.size === parseInt(size) &&
                    item.variantId.toString() === variantId
        );

        if (itemIndex === -1) {
            return res.status(404).json({ message: 'Item not found in cart' });
        }

        // Find the variant and size
        const selectedVariant = product.variants.find(v => v._id.toString() === variantId);
        const sizeObj = selectedVariant.sizes.find(s => s.size === parseInt(size));

        // Validate new quantity
        if (quantity > 5) {
            return res.status(400).json({ 
                message: "Cannot add more than 5 of this product" 
            });
        }

        if (quantity > sizeObj.quantity) {
            return res.status(400).json({ 
                message: `Only ${sizeObj.quantity} items available in stock` 
            });
        }

        // Update quantity and prices
        userCart.items[itemIndex].originalPrice = originalPrice;
        userCart.items[itemIndex].price = discountedPrice;
        userCart.items[itemIndex].quantity = quantity;
        userCart.items[itemIndex].totalPrice = discountedPrice * quantity;
        userCart.items[itemIndex].availableQuantity = sizeObj.quantity;

        // Add or remove offer details
        if (maxDiscount > 0) {
            userCart.items[itemIndex].offer = {
                discount: maxDiscount,
                offerName: applicableOfferName
            };
        } else {
            delete userCart.items[itemIndex].offer;
        }

        await userCart.save();
        
        // Recalculate subtotal
        const subtotal = userCart.items.reduce((sum, item) => sum + item.totalPrice, 0);
        
        return res.status(200).json({
            cart: userCart,
            subtotal: subtotal
        });
    } catch (error) {
        console.error('Error updating cart:', error);
        res.status(500).json({ message: "Server error" });
    }
};



const removeFromCart = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { productId } = req.params; 
        const { color, size, variantId } = req.query; 
        const userId = req.session.user._id; 

        const cart = await Cart.findOne({ userId });
        
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        const initialItemsCount = cart.items.length;

        // Remove item from cart items
        cart.items = cart.items.filter(
            item => !(
                item.productId.toString() === productId &&
                item.color === color &&
                item.size === parseInt(size) &&
                item.variantId.toString() === variantId
            )
        );

        // Check if any item was removed
        if (cart.items.length === initialItemsCount) {
            return res.status(404).json({ message: 'Item not found in cart' });
        }

        // Save updated cart
        await cart.save();

        res.status(200).json({ message: 'Item removed from cart' });
    } catch (error) {
        console.error('Error removing item from cart:', error);
        res.status(500).json({ message: 'Error removing item from cart' });
    }
};



const checkStockAvailability = async (req, res) => {
    try {
        const { productId } = req.params;
        const { color, size, variantId } = req.query;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const variant = product.variants.find(v => 
            v._id.toString() === variantId && v.color === color
        );

        if (!variant) {
            return res.status(404).json({ message: 'Variant not found' });
        }

        const sizeObj = variant.sizes.find(s => s.size === parseInt(size));

        return res.json({ 
            availableQuantity: sizeObj ? sizeObj.quantity : 0,
            variantId: variant._id
        });
    } catch (error) {
        console.error('Error checking stock:', error);
        res.status(500).json({ message: 'Server error' });
    }
};



const checkCartItem = async (req, res) => {
    try {
        const { productId, color, size, variantId } = req.body;
        
        // Validate required fields
        if (!productId || !color || !size || !variantId) {
            return res.status(400).json({ 
                message: 'Missing required fields',
                exists: false 
            });
        }

        const userId = req.user._id;

        // Find cart and populate product details
        const cart = await Cart.findOne({ userId })
            .populate('items.productId');
        
        if (!cart) {
            return res.json({ exists: false });
        }

        // Check if item exists in cart
        const itemExists = cart.items.some(item => {
            // Check if item and productId exist
            if (!item || !item.productId) {
                return false;
            }

            // Convert productId to string for comparison
            const itemProductId = typeof item.productId === 'object' 
                ? item.productId._id.toString() 
                : item.productId.toString();

            return itemProductId === productId &&
                   item.color === color &&
                   item.size === parseInt(size) &&
                   item.variantId.toString() === variantId;
        });

        res.json({ 
            exists: itemExists,
            message: itemExists ? 'Item already exists in cart' : 'Item not in cart'
        });

    } catch (error) {
        console.error('Error checking cart item:', error);
        res.status(500).json({ 
            message: 'Server error while checking cart item',
            error: error.message,
            exists: false
        });
    }
};


module.exports = {
    getCartPage,
    addToCart,
    removeFromCart,
    updateCart,
    checkStockAvailability,
    checkCartItem,
};