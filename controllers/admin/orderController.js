

// controllers/orderController.js
const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Product= require('../../models/productSchema')
const Address= require('../../models/addressSchema')

/// controllers/orderController.js
const listOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        // Search and filter options
        const search = req.query.search ? req.query.search.trim() : '';
        const status = req.query.status || '';
        const paymentStatus = req.query.paymentStatus || '';

        // Build query
        const query = {};
        let noResultsMessage = '';
        let searchApplied = false;

        // Enhanced search logic
        if (search) {
            searchApplied = true;
            query.$or = [
                { orderId: { $regex: search, $options: 'i' } },
                // Perform a lookup on the User collection for name search
                { 'userId': await getUserIdsByName(search) }
            ];
        }

        if (status) {
            searchApplied = true;
            query.status = status;
        }

        if (paymentStatus) {
            searchApplied = true;
            query.paymentStatus = paymentStatus;
        }

        // Fetch orders with pagination and populate
        const orders = await Order.find(query)
            .populate('userId', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Count total documents for pagination
        const totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders / limit);

        // Determine no results message
        if (searchApplied && orders.length === 0) {
            if (search) {
                // Check if search term exists in any field
                const orderIdExists = await Order.findOne({ orderId: { $regex: search, $options: 'i' } });
                const userExists = await User.findOne({ name: { $regex: search, $options: 'i' } });

                if (!orderIdExists && !userExists) {
                    noResultsMessage = `No orders found for "${search}". The order ID or customer name does not exist.`;
                }
            }

            if (status) {
                const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
                if (!validStatuses.includes(status)) {
                    noResultsMessage = `Invalid order status "${status}". Please select a valid status.`;
                } else {
                    noResultsMessage = `No orders found with status "${status}".`;
                }
            }

            if (paymentStatus) {
                const validPaymentStatuses = ['pending', 'paid', 'failed'];
                if (!validPaymentStatuses.includes(paymentStatus)) {
                    noResultsMessage = `Invalid payment status "${paymentStatus}". Please select a valid payment status.`;
                } else {
                    noResultsMessage = `No orders found with payment status "${paymentStatus}".`;
                }
            }

            // Combination search message
            if (search && status) {
                noResultsMessage = `No orders found for "${search}" with status "${status}".`;
            }

            if (search && paymentStatus) {
                noResultsMessage = `No orders found for "${search}" with payment status "${paymentStatus}".`;
            }
        }

        res.render('order-list', {
            orders,
            currentPage: page,
            totalPages,
            search,
            status,
            paymentStatus,
            noResultsMessage
        });
    } catch (error) {
        console.error('Error in listing orders:', error);
        res.status(500).render('error', { 
            message: 'Internal Server Error',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
};

// Helper function to get user IDs by name
async function getUserIdsByName(searchTerm) {
    try {
        const users = await User.find({ 
            name: { $regex: searchTerm, $options: 'i' } 
        }, '_id');
        return { $in: users.map(user => user._id) };
    } catch (error) {
        console.error('Error finding users:', error);
        return [];
    }
}






const orderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await Order.findById(orderId)
            .populate({
                path: 'userId',
                model: 'User'
            })
            .populate({
                path: 'items.productId',
                populate: {
                    path: 'category',
                    model: 'Category'
                }
            });

        if (!order) {
            return res.status(404).render('error', { 
                message: 'Order not found' 
            });
        }

        // Optional: Fetch user's address details
        const userAddress = await Address.findOne({ userId: order.userId._id });

        res.render('order-details', { 
            order, 
            userAddress 
        });
    } catch (error) {
        console.error('Error in order details:', error);
        res.status(500).render('pageerror', { 
            message: 'Internal Server Error',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
};



const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, paymentStatus } = req.body;

        // Log incoming request details for debugging
        console.log('Update Order Status Request:', {
            orderId: id,
            newStatus: status
        });

        // Validate input
        if (!status) {
            console.error('Status is undefined');
            return res.status(400).json({ 
                success: false, 
                message: 'Status is required',
                error: 'Status parameter cannot be empty or undefined'
            });
        }

        // Predefined status flow
        const STATUS_FLOW = {
            'pending': ['processing', 'shipped'],  // Added 'shipped' as a direct option from pending
            'processing': ['shipped'],
            'shipped': ['delivered'],
            'delivered': [],
            'cancelled': []
        };

        // Find the order
        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found',
                error: `No order exists with ID ${id}`
            });
        }

        // Get current status
        const currentStatus = order.status;

        // Validate status transition
        const allowedNextStatuses = STATUS_FLOW[currentStatus] || [];

        console.log('Status Transition Check:', {
            currentStatus,
            requestedStatus: status,
            allowedNextStatuses
        });

        if (!allowedNextStatuses.includes(status)) {
            console.error('Invalid Status Transition', {
                from: currentStatus,
                to: status,
                allowed: allowedNextStatuses
            });

            return res.status(400).json({ 
                success: false, 
                message: `Invalid status transition from ${currentStatus} to ${status}`,
                error: 'Status transition not allowed',
                currentStatus,
                allowedStatuses: allowedNextStatuses
            });
        }

        // Update order status
        order.status = status;

        if (paymentStatus) {
            order.paymentStatus = paymentStatus;
        }

        await order.save();

        console.log('Order Status Successfully Updated', {
            orderId: id,
            newStatus: status
        });

        res.json({ 
            success: true, 
            message: 'Order status updated successfully',
            order 
        });
    } catch (error) {
        
            console.error('Comprehensive Error in Update Order Status:', {
                error: error.message,
                stack: error.stack
            });
    
            res.status(500).json({ 
                success: false, 
                message: 'Internal Server Error',
                error: process.env.NODE_ENV === 'development' 
                    ? { 
                        message: error.message, 
                        stack: error.stack 
                    } 
                    : 'An unexpected error occurred'
            });
        }
};




const cancelEntireOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { cancelReason } = req.body;  // New field for cancellation reason
        
        const order = await Order.findById(id)
            .populate('items.productId');

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

        // Process each item for quantity restoration
        for (const item of order.items) {
            // Find the product
            const product = await Product.findById(item.productId);
            if (!product) continue;

            // Find the specific variant
            const variant = product.variants.find(v => v.color === item.color);
            if (!variant) continue;

            // Find and update the specific size variant
            const sizeVariant = variant.sizes.find(s => s.size === item.size);
            if (sizeVariant) {
                sizeVariant.quantity += item.quantity;
            }

            // Save the product with updated quantities
            await product.save();

            // Update item status
            item.status = 'cancelled';
        }
        
        // Update order status and add cancellation reason
        order.status = 'cancelled';
        order.cancellationReason = cancelReason;

        await order.save();

        res.json({ 
            success: true, 
            message: 'Order cancelled successfully',
            orderStatus: order.status
        });
    } catch (error) {
        console.error('Cancel Entire Order Error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to cancel order' 
        });
    }
};

const cancelOrderItem = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { itemIndex, cancelReason } = req.body;  // New field for cancellation reason

        const order = await Order.findById(orderId)
            .populate('items.productId');

        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found' 
            });
        }

        // Check if order can be modified
        if (order.status === 'delivered' || order.status === 'cancelled') {
            return res.status(400).json({ 
                success: false, 
                message: 'Cannot modify this order' 
            });
        }

        // Get the specific item
        const item = order.items[itemIndex];

        if (!item) {
            return res.status(404).json({ 
                success: false, 
                message: 'Item not found' 
            });
        }

        // Find the product and update quantity
        const product = await Product.findById(item.productId);
        if (product) {
            const variant = product.variants.find(v => v.color === item.color);
            if (variant) {
                const sizeVariant = variant.sizes.find(s => s.size === item.size);
                if (sizeVariant) {
                    sizeVariant.quantity += item.quantity;
                }
                await product.save();
            }
        }

        // Mark item as cancelled and add cancellation reason
        item.status = 'cancelled';
        item.cancellationReason = cancelReason;

        // Check if all items are cancelled
        const allItemsCancelled = order.items.every(i => i.status === 'cancelled');
        if (allItemsCancelled) {
            order.status = 'cancelled';
        }

        await order.save();

        res.json({ 
            success: true, 
            message: 'Item cancelled successfully',
            orderStatus: order.status
        });
    } catch (error) {
        console.error('Cancel Order Item Error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to cancel item' 
        });
    }
}; 




module.exports= {
    listOrders,
    orderDetails,
    updateOrderStatus,
    cancelEntireOrder,
    cancelOrderItem,
}