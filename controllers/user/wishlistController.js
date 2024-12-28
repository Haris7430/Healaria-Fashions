const Wishlist = require('../../models/wishlistSchema');
const Product = require('../../models/productSchema');
const Cart = require('../../models/cartSchema');
const Offer = require('../../models/offerSchema'); 


const addToWishlist = async (req, res) => {
    try {
        const { productId, selectedVariant } = req.body;
        let wishlist = await Wishlist.findOne({ userId: req.user._id });

        if (!wishlist) {
            wishlist = new Wishlist({
                userId: req.user._id,
                items: []
            });
        }

        const existingItem = wishlist.items.find(item => 
            item.productId.toString() === productId
        );

        if (existingItem) {
            return res.status(400).json({
                success: false,
                message: 'Product already in wishlist',
                isExisting: true
            });
        }

        // Add product with selected variant (if provided)
        wishlist.items.push({
            productId,
            selectedVariant: selectedVariant || null,
            addedAt: new Date()
        });

        await wishlist.save();

        res.status(200).json({
            success: true,
            message: 'Product added to wishlist'
        });
    } catch (error) {
        console.error('Add to wishlist error:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding to wishlist'
        });
    }
};

const getWishlist = async (req, res) => {
    try {
        const wishlist = await Wishlist.findOne({ userId: req.user._id })
            .populate({
                path: 'items.productId',
                select: 'productName regularPrice offerPercentage variants'
            });

        res.render('userProfile', { 
            activeSection: 'wishlist',
            wishlist,
            user: req.user
        });
    } catch (error) {
        console.error('Get wishlist error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching wishlist'
        });
    }
};

const removeFromWishlist = async (req, res) => {
    try {
        const { productId } = req.params;
        await Wishlist.updateOne(
            { userId: req.user._id },
            { $pull: { items: { productId } } }
        );
        
        res.status(200).json({
            success: true,
            message: 'Product removed from wishlist'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error removing product from wishlist'
        });
    }
};

const clearWishlist = async (req, res) => {
    try {
        await Wishlist.updateOne(
            { userId: req.user._id },
            { $set: { items: [] } }
        );
        
        res.status(200).json({
            success: true,
            message: 'Wishlist cleared'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error clearing wishlist'
        });
    }
};


const addAllToCart = async (req, res) => {
    try {
        const wishlist = await Wishlist.findOne({ userId: req.user._id })
            .populate('items.productId');
        
        if (!wishlist || !wishlist.items.length) {
            return res.status(400).json({
                success: false,
                message: 'No items in wishlist'
            });
        }

        let cart = await Cart.findOne({ userId: req.user._id });
        if (!cart) {
            cart = new Cart({ userId: req.user._id, items: [] });
        }

        let addedItems = 0;
        let skippedItems = 0;
        let notSelectedItems = 0;
        let outOfStockItems = 0;
        let existingItems = 0;

        for (const item of wishlist.items) {
            // Skip items without selected variant
            if (!item.selectedVariant || !item.selectedVariant.size || !item.selectedVariant.color) {
                notSelectedItems++;
                continue;
            }

            // Check if item already exists in cart
            const existingCartItem = cart.items.find(cartItem => 
                cartItem.productId.toString() === item.productId._id.toString() &&
                cartItem.color === item.selectedVariant.color &&
                cartItem.size === item.selectedVariant.size
            );

            if (existingCartItem) {
                existingItems++;
                continue;
            }

            // Verify product and check stock
            const product = await Product.findById(item.productId._id)
                .populate('category');

            if (!product) {
                skippedItems++;
                continue;
            }

            // Find variant and check stock
            const variant = product.variants.find(v => 
                v.color === item.selectedVariant.color
            );
            
            const sizeObj = variant?.sizes.find(s => 
                s.size === item.selectedVariant.size
            );

            if (!variant || !sizeObj || sizeObj.quantity < 1) {
                outOfStockItems++;
                continue;
            }

            // Calculate price with any applicable offers
            const offers = await Offer.find({
                $or: [
                    { offerType: 'product', productIds: product._id },
                    { offerType: 'category', categoryIds: product.category._id }
                ],
                status: 'active',
                expireDate: { $gte: new Date() }
            });

            let maxDiscount = 0;
            let applicableOfferName = '';
            
            offers.forEach(offer => {
                if (offer.discount > maxDiscount) {
                    maxDiscount = offer.discount;
                    applicableOfferName = offer.offerName;
                }
            });

            const originalPrice = product.regularPrice;
            const discountedPrice = originalPrice * (1 - maxDiscount / 100);

            // Add to cart
            cart.items.push({
                productId: product._id,
                variantId: variant._id,
                size: item.selectedVariant.size,
                color: item.selectedVariant.color,
                quantity: 1,
                originalPrice,
                price: discountedPrice,
                totalPrice: discountedPrice,
                availableQuantity: sizeObj.quantity,
                ...(maxDiscount > 0 && {
                    offer: {
                        discount: maxDiscount,
                        offerName: applicableOfferName
                    }
                })
            });

            addedItems++;
        }

        await cart.save();

        // Prepare detailed message
        let message = `Added ${addedItems} items to cart.`;
        if (notSelectedItems > 0) message += ` ${notSelectedItems} items skipped (no variant selected).`;
        if (existingItems > 0) message += ` ${existingItems} items already in cart.`;
        if (outOfStockItems > 0) message += ` ${outOfStockItems} items out of stock.`;
        if (skippedItems > 0) message += ` ${skippedItems} items unavailable.`;
        
        res.status(200).json({
            success: true,
            message
        });
    } catch (error) {
        console.error('Add all to cart error:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding items to cart'
        });
    }
};




const updateWishlistVariant = async (req, res) => {
    try {
        const { productId } = req.params;
        const { selectedVariant } = req.body;
        
        // Validate input
        if (!selectedVariant || !selectedVariant.size || !selectedVariant.color) {
            return res.status(400).json({
                success: false,
                message: 'Invalid variant selection'
            });
        }

        // First verify the product and variant exist
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Verify the variant exists and has stock
        const variant = product.variants.find(v => 
            v.color === selectedVariant.color &&
            v.sizes.some(s => s.size === selectedVariant.size && s.quantity > 0)
        );

        if (!variant) {
            return res.status(400).json({
                success: false,
                message: 'Selected variant not available'
            });
        }

        // Update the wishlist item
        const result = await Wishlist.findOneAndUpdate(
            { 
                userId: req.user._id,
                'items.productId': productId 
            },
            { 
                $set: { 
                    'items.$.selectedVariant': selectedVariant 
                } 
            },
            { new: true }
        );

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Wishlist item not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Variant updated successfully'
        });

    } catch (error) {
        console.error('Update wishlist variant error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating variant'
        });
    }
};




const addToCartFromWishlist = async (productId, variantData) => {
    try {
        // Check if item exists in cart
        const checkResponse = await fetch('/check-cart-item', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content
            },
            body: JSON.stringify(variantData)
        });

        const checkData = await checkResponse.json();

        if (!checkResponse.ok) {
            throw new Error(checkData.message || 'Failed to check cart item');
        }

        if (checkData.exists) {
            await Swal.fire({
                title: 'Item Already in Cart',
                text: `This product with color ${variantData.color} and size ${variantData.size} is already in your cart`,
                icon: 'info'
            });
            return false;
        }

        // If item doesn't exist, add to cart
        const addResponse = await fetch(`/addToCart/${productId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content
            },
            body: JSON.stringify(variantData)
        });

        if (!addResponse.ok) {
            const errorData = await addResponse.json();
            throw new Error(errorData.message || 'Failed to add to cart');
        }

        const result = await Swal.fire({
            title: 'Success!',
            text: 'Product added to cart successfully',
            icon: 'success',
            showCancelButton: true,
            confirmButtonText: 'Go to Cart',
            cancelButtonText: 'Continue Shopping'
        });

        if (result.isConfirmed) {
            window.location.href = '/userCart';
        }

        return true;
    } catch (error) {
        await Swal.fire('Error', error.message, 'error');
        return false;
    }
};








const checkWishlistItem = async (req, res) => {
    try {
        const productId = req.params.productId;
        const userId = req.session.user._id;

        const wishlistItem = await Wishlist.findOne({
            userId,
            'items.productId': productId
        });

        res.json({ exists: !!wishlistItem });
    } catch (error) {
        console.error('Check wishlist item error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

const getWishlistItems = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const wishlist = await Wishlist.findOne({ userId });
        
        if (!wishlist) {
            return res.json([]);
        }

        res.json(wishlist.items);
    } catch (error) {
        console.error('Get wishlist items error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
    addToWishlist,
    getWishlist,
    removeFromWishlist,
    clearWishlist,
    addAllToCart,
    updateWishlistVariant,
    checkWishlistItem,
    getWishlistItems,
};