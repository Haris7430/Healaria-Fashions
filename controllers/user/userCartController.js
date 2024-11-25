
const User = require('../../models/userSchema');
const Category= require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const Cart = require('../../models/cartSchema');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');




const getCartPage = async (req, res) => {
    try {
        const cart = await Cart.findOne({ userId: req.user._id }).populate({
            path: 'items.productId',
            model: 'Product'
        });

        // If the cart is not found, create an empty cart
        if (!cart) {
            return res.render('userCart', { cart: { items: [] } });
        }

        res.render('userCart', { cart });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
};



const addToCart = async (req, res) => {
    try {
        // Check if user is authenticated
        if (!req.user) {
            return res.status(401).json({ message: 'Please log in to add items to cart' });
        }

        const productId = req.params.id;
        const userId = req.user._id;
        const { quantity = 1, size, color, variantId } = req.body;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        // Validate quantity
        if (quantity > 5) {
            return res.status(400).json({ message: "Cannot add more than 5 of this product" });
        }

        // Check available quantity based on variant or main product
        let availableQuantity;
        if (variantId && product.variants) {
            const variant = product.variants.find(v => v._id.toString() === variantId);
            if (variant) {
                const sizeObj = variant.sizes.find(s => s.size === parseInt(size));
                availableQuantity = sizeObj ? sizeObj.quantity : 0;
            } else {
                availableQuantity = 0;
            }
        } else {
            availableQuantity = product.quantity;
        }

        if (quantity > availableQuantity) {
            return res.status(400).json({ message: `Only ${availableQuantity} items available in stock` });
        }

        // Find or create cart
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }

        // Check if item already exists
        const existingItemIndex = cart.items.findIndex(item => 
            item.productId.toString() === productId &&
            item.size === parseInt(size) &&
            item.color === color &&
            (variantId ? item.variantId?.toString() === variantId : true)
        );

        if (existingItemIndex !== -1) {
            return res.status(400).json({ message: "Product already in the cart" });
        }

        // Add new item to cart
        cart.items.push({
            productId,
            variantId: variantId || null,
            size: parseInt(size),
            color,
            quantity,
            price: product.salesPrice,
            totalPrice: product.salesPrice * quantity
        });

        await cart.save();
        return res.status(200).json({ message: "Product added to cart successfully" });
    } catch (error) {
        console.error('Add to cart error:', error);
        res.status(500).json({ message: "Server error" });
    }
};





const removeFromCart = async (req, res) => {
    try {
        const { productId } = req.params; 
        const userId = req.user._id; 

       
        await Cart.updateOne(
            { userId: userId },
            { $pull: { items: { productId: productId } } } 
        );

        res.status(200).json({ message: 'Item removed from cart' });
    } catch (error) {
        console.error('Error removing item from cart:', error);
        res.status(500).json({ message: 'Error removing item from cart' });
    }
};




const updateCart = async (req, res) => {
    try {
        const { productId } = req.params;
        const { quantity } = req.body;
        const userId = req.user._id;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        // Check if requested quantity is available in stock
        if (quantity > product.quantity) {
            return res.status(400).json({ 
                message: `Only ${product.quantity} items available in stock` 
            });
        }

        // Apply maximum limit of 5
        if (quantity > 5) {
            return res.status(400).json({ 
                message: "Cannot add more than 5 items of this product" 
            });
        }

        const userCart = await Cart.findOne({ userId });
        if (!userCart) {
            return res.status(404).json({ message: "Cart not found" });
        }

        const itemIndex = userCart.items.findIndex(
            item => item.productId.toString() === productId
        );
        
        if (itemIndex !== -1) {
            userCart.items[itemIndex].quantity = quantity;
            userCart.items[itemIndex].totalPrice = product.salesPrice * quantity;
            await userCart.save();
            return res.status(200).json(userCart);
        }

        return res.status(404).json({ message: "Item not found in cart" });
    } catch (error) {
        console.error('Error updating cart:', error);
        res.status(500).json({ message: "Server error" });
    }
};



module.exports = {
    getCartPage,
    addToCart,
    removeFromCart,
    updateCart,

}

