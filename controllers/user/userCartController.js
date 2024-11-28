const User = require('../../models/userSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const Cart = require('../../models/cartSchema');

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

        // Enhanced subtotal calculation
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
        const { quantity = 1, size, color, variantId } = req.body;

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
            v._id.toString() === variantId
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
            item.productId.toString() === productId &&
            item.variantId.toString() === variantId &&
            item.size === parseInt(size)
        );

        if (existingItemIndex !== -1) {
            return res.status(400).json({ 
                status: 'error',
                message: "Product with this variant and size already in the cart" 
            });
        }

        // Add new item to cart
        cart.items.push({
            productId,
            variantId: selectedVariant._id,
            size: parseInt(size),
            color: selectedVariant.color, // Use the color from the variant
            quantity,
            price: product.salesPrice,
            totalPrice: product.salesPrice * quantity,
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
            // Update quantity and total price for the specific item
            userCart.items[itemIndex].quantity = quantity;
            userCart.items[itemIndex].totalPrice = product.salesPrice * quantity;
            userCart.items[itemIndex].availableQuantity = sizeObj.quantity;
            
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
        const { color, size } = req.query; // Add color and size to query
        const userId = req.session.user._id; 

        const result = await Cart.updateOne(
            { 
                userId: userId,
                items: {
                    $elemMatch: {
                        productId: productId,
                        color: color,
                        size: parseInt(size)
                    }
                }
            },
            { 
                $pull: { 
                    items: { 
                        productId: productId,
                        color: color,
                        size: parseInt(size)
                    } 
                } 
            }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ message: 'Item not found in cart' });
        }

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