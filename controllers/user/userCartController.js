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

        // Find applicable offers for each product in the cart
        const cartItemsWithOffers = await Promise.all(cart.items.map(async (item) => {
            // Find applicable offers for the product
            const offers = await Offer.find({
                $or: [
                    { offerType: 'product', productIds: item.productId._id },
                    { offerType: 'category', categoryIds: item.productId.category }
                ],
                status: 'active',
                expireDate: { $gte: new Date() }
            });

            // Find the maximum discount offer
            let maxOffer = null;
            let originalPrice = item.price;
            let discountedPrice = item.price;

            if (offers.length > 0) {
                maxOffer = offers.reduce((max, offer) => 
                    offer.discount > (max ? max.discount : 0) ? offer : max
                , null);

                if (maxOffer) {
                    discountedPrice = originalPrice * (1 - maxOffer.discount / 100);
                }
            }

            return {
                ...item.toObject(),
                originalPrice: originalPrice,
                price: discountedPrice,
                totalPrice: discountedPrice * item.quantity,
                offer: maxOffer ? {
                    offerName: maxOffer.offerName,
                    discount: maxOffer.discount
                } : null
            };
        }));

        // Create a new cart object with updated items
        const updatedCart = {
            ...cart.toObject(),
            items: cartItemsWithOffers
        };

        // Recalculate subtotal with discounted prices
        const subtotal = cartItemsWithOffers.reduce((sum, item) => sum + item.totalPrice, 0);

        res.render('userCart', { 
            cart: updatedCart, 
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

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ 
                status: 'error',
                message: "Product not found" 
            });
        }

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

        // Add new item to cart (using regular price)
        cart.items.push({
            productId,
            variantId: selectedVariant._id,
            size: parseInt(size),
            color: selectedVariant.color,
            quantity,
            price: product.regularPrice,
            totalPrice: product.regularPrice * quantity,
            availableQuantity: sizeObj.quantity
        });

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

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        // Find the specific variant
        const variant = product.variants.find(v => 
            v._id.toString() === variantId && v.color === color
        );
        if (!variant) {
            return res.status(404).json({ message: "Variant not found" });
        }

        // Check stock availability for specific size
        const sizeObj = variant.sizes.find(s => s.size === parseInt(size));
        if (!sizeObj || sizeObj.quantity < quantity) {
            return res.status(400).json({ 
                message: `Only ${sizeObj ? sizeObj.quantity : 0} items available in stock for this size` 
            });
        }

        // Quantity limit check
        if (quantity > 5) {
            return res.status(400).json({ 
                message: "Cannot add more than 5 items of this product" 
            });
        }

        // Find the cart
        const userCart = await Cart.findOne({ userId });
        if (!userCart) {
            return res.status(404).json({ message: "Cart not found" });
        }

        // Find the specific cart item with matching product, variant, and size
        const itemIndex = userCart.items.findIndex(
            item => item.productId.toString() === productId &&
                    item.variantId.toString() === variantId &&
                    item.color === color &&
                    item.size === parseInt(size)
        );
        
        if (itemIndex !== -1) {
            // Find applicable offers for the product
            const offers = await Offer.find({
                $or: [
                    { offerType: 'product', productIds: productId },
                    { offerType: 'category', categoryIds: product.category }
                ],
                status: 'active',
                expireDate: { $gte: new Date() }
            });

            // Determine the maximum discount offer
            let maxOffer = null;
            let originalPrice = product.regularPrice;
            let price = originalPrice;

            if (offers.length > 0) {
                maxOffer = offers.reduce((max, offer) => 
                    offer.discount > (max ? max.discount : 0) ? offer : max
                , null);

                if (maxOffer) {
                    price = originalPrice * (1 - maxOffer.discount / 100);
                }
            }

            // Update quantity and total price for the specific item
            userCart.items[itemIndex].quantity = quantity;
            userCart.items[itemIndex].price = price;
            userCart.items[itemIndex].totalPrice = price * quantity;
            userCart.items[itemIndex].availableQuantity = sizeObj.quantity;

            // Optional: Update offer details in cart item if needed
            if (maxOffer) {
                userCart.items[itemIndex].offer = {
                    offerName: maxOffer.offerName,
                    discount: maxOffer.discount,
                    originalPrice: originalPrice
                };
            }
            
            await userCart.save();
            
            // Recalculate subtotal
            const subtotal = userCart.items.reduce((sum, item) => sum + item.totalPrice, 0);
            
            return res.status(200).json({
                cart: userCart,
                subtotal: subtotal
            });
        }

        return res.status(404).json({ message: "Item not found in cart" });
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

module.exports = {
    getCartPage,
    addToCart,
    removeFromCart,
    updateCart,
    checkStockAvailability,
};