

// controllers/orderController.js
const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Product= require('../../models/productSchema')
const Address= require('../../models/addressSchema')
const Wallet = require('../../models/walletSchema');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');


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
        const order = await Order.findOne({ orderId: orderId })
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
            return res.status(404).render('pageerror', { 
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
        
        const order = await Order.findById(id)
            .populate('items.productId')
            .populate('userId');

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

        // Calculate total refund amount
        const refundAmount = order.items.reduce((total, item) => {
            if (item.status !== 'cancelled') {
                return total + item.totalPrice;
            }
            return total;
        }, 0);

        // Process each item for quantity restoration
        for (const item of order.items) {
            if (item.status !== 'cancelled') {
                const product = await Product.findById(item.productId);
                if (!product) continue;

                const variant = product.variants.find(v => v.color === item.color);
                if (!variant) continue;

                const sizeVariant = variant.sizes.find(s => s.size === item.size);
                if (sizeVariant) {
                    sizeVariant.quantity += item.quantity;
                }

                await product.save();
                item.status = 'cancelled';
            }
        }
        
        // Update order status
        order.status = 'cancelled';

        // Process refund to wallet
        let wallet = await Wallet.findOne({ userId: order.userId._id });
        if (!wallet) {
            wallet = new Wallet({ userId: order.userId._id });
        }

        // Add refund transaction
        wallet.balance += refundAmount;
        wallet.transactions.push({
            amount: refundAmount,
            type: 'credit',
            description: `Refund for cancelled order ${order.orderId}`,
            orderId: order._id,
            balance: wallet.balance
        });

        await Promise.all([
            order.save(),
            wallet.save()
        ]);

        res.json({ 
            success: true, 
            message: 'Order cancelled successfully and amount refunded to wallet',
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


// Update the handleReturnRequest function in orderController.js
const handleReturnRequest = async (req, res) => {
    try {
        const { orderId, itemId, action, adminResponse, refundAmount } = req.body;

        if (!orderId || !itemId || !action || (action === 'approve' && !refundAmount)) {
            return res.status(400).json({
                success: false,
                message: 'Missing required parameters'
            });
        }

        const order = await Order.findOne({ orderId })
            .populate('items.productId')
            .populate('userId');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        const orderItem = order.items.find(item => 
            item._id.toString() === itemId.toString()
        );

        if (!orderItem) {
            return res.status(404).json({
                success: false,
                message: 'Order item not found'
            });
        }

        if (action === 'approve') {
            // Update item status to returned
            orderItem.status = 'returned';
            orderItem.returnRequest.status = 'approved';
            orderItem.returnRequest.adminResponse = adminResponse;
            orderItem.returnRequest.refundAmount = refundAmount;

            // Process refund
            let wallet = await Wallet.findOne({ userId: order.userId });
            if (!wallet) {
                wallet = new Wallet({ userId: order.userId });
            }

            wallet.balance += refundAmount;
            wallet.transactions.push({
                amount: refundAmount,
                type: 'credit',
                description: `Refund for returned item from order ${order.orderId}`,
                orderId: order._id,
                balance: wallet.balance
            });

            await wallet.save();

            // Restore inventory
            const product = await Product.findById(orderItem.productId);
            if (product) {
                const variant = product.variants.find(v => v.color === orderItem.color);
                if (variant) {
                    const sizeVariant = variant.sizes.find(s => s.size === orderItem.size);
                    if (sizeVariant) {
                        sizeVariant.quantity += orderItem.quantity;
                        await product.save();
                    }
                }
            }
        } else if (action === 'reject') {
            orderItem.status = 'return_rejected';  // Updated status
            orderItem.returnRequest.status = 'rejected';
            orderItem.returnRequest.adminResponse = adminResponse;
        }

        await order.save();

        res.json({
            success: true,
            message: `Return request ${action}ed successfully`
        });
    } catch (error) {
        console.error('Error handling return request:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to process return request'
        });
    }
};



// Add this function for wallet refunds on order cancellation
const handleOrderRefund = async (order, items) => {
    try {
        let refundAmount = 0;
        
        // Calculate refund amount for specified items or all items
        const itemsToRefund = items || order.items;
        itemsToRefund.forEach(item => {
            refundAmount += item.totalPrice;
        });

        // Create or update wallet
        let wallet = await Wallet.findOne({ userId: order.userId });
        if (!wallet) {
            wallet = new Wallet({ userId: order.userId });
        }

        // Add refund transaction
        wallet.balance += refundAmount;
        wallet.transactions.push({
            amount: refundAmount,
            type: 'credit',
            description: `Refund for cancelled items from order ${order.orderId}`,
            orderId: order._id,
            balance: wallet.balance
        });

        await wallet.save();
        return true;
    } catch (error) {
        console.error('Error processing refund:', error);
        return false;
    }
};

// Modify existing cancel functions to include refund
const cancelOrderItem = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { itemIndex } = req.body;

        const order = await Order.findById(orderId)
            .populate('items.productId');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        const item = order.items[itemIndex];
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item not found'
            });
        }

        item.status = 'cancelled';
        await handleOrderRefund(order, [item]);
        await order.save();

        res.json({
            success: true,
            message: 'Item cancelled and refunded successfully'
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel item'
        });
    }
};




const getReturnRequestDetails = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findOne({ orderId })
            .populate({
                path: 'items.productId',
                select: 'productName variants'
            });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Filter only items with return requests
        const returnRequestItems = order.items.filter(item => 
            item.status === 'return_requested' && item.returnRequest
        );

        if (returnRequestItems.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No return requests found for this order'
            });
        }

        // Calculate coupon discount proportion for each item if applicable
        const totalOrderValue = order.items.reduce((sum, item) => sum + item.totalPrice, 0);
        
        // Format the response data
        const items = returnRequestItems.map(item => {
            let couponDiscount = 0;
            if (order.couponApplied && order.couponApplied.discountAmount) {
                const itemProportion = item.totalPrice / totalOrderValue;
                couponDiscount = order.couponApplied.discountAmount * itemProportion;
            }

            return {
                _id: item._id,
                productId: item.productId,
                color: item.color,
                size: item.size,
                quantity: item.quantity,
                price: item.price,
                totalPrice: item.totalPrice,
                couponDiscount: couponDiscount,
                returnRequest: {
                    reason: item.returnRequest.reason,
                    customReason: item.returnRequest.customReason,
                    status: item.returnRequest.status,
                    createdAt: item.returnRequest.createdAt
                }
            };
        });

        res.json({
            success: true,
            items
        });
    } catch (error) {
        console.error('Error fetching return request details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch return request details',
            error: error.message
        });
    }
};






const downloadInvoice = async (req, res) => {
    try {
        const { orderId } = req.params;
        
        const order = await Order.findOne({ orderId })
            .populate('userId')
            .populate({
                path: 'items.productId',
                populate: {
                    path: 'category',
                    model: 'Category'
                }
            });

        if (!order) {
            return res.status(404).send('Order not found');
        }

        // Create PDF document with adjusted margins
        const doc = new PDFDocument({ margin: 50 });

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${orderId}.pdf`);

        // Pipe PDF to response
        doc.pipe(res);

        // Helper function to format currency (without the small number)
        const formatCurrency = (amount) => {
            return `Rs ${amount.toFixed(2)}`;
        };

        // Helper function to truncate product name
        const formatProductName = (name) => {
            if (name.length > 30) {
                return name.substring(0, 30) + '...';
            }
            return name;
        };

        // Add company info with adjusted positioning
        doc.fontSize(20).text('Helaria Fashions', 50, 50);
        doc.fontSize(10)
           .text('123 Business Street', 50, 80)
           .text('Palakkad, Kerala, 678342', 50, 95)
           .text('Phone: (123) 456-7890', 50, 110)
           .text('Email: helariafashions@gmail.com', 50, 125);

        // Add invoice title and details with adjusted positioning
        doc.fontSize(20)
           .text('INVOICE', 350, 50);

        doc.fontSize(10)
           .text(`Invoice Number: ${order.orderId}`, 350, 80)
           .text(`Date: ${order.createdAt.toLocaleDateString()}`, 350, 95)
           .text(`Payment Status: ${order.paymentStatus.toUpperCase()}`, 350, 110);

        // Add customer info
        doc.fontSize(14)
           .text('Bill To:', 50, 170);
        
        doc.fontSize(10)
           .text(order.shippingAddress.name, 50, 190)
           .text(order.shippingAddress.landmark, 50, 205)
           .text(`${order.shippingAddress.city}, ${order.shippingAddress.state}`, 50, 220)
           .text(`PIN: ${order.shippingAddress.pincode}`, 50, 235)
           .text(`Phone: ${order.shippingAddress.phone}`, 50, 250);

        // Table header with adjusted column spacing
        let y = 300;
        const columns = {
            item: { x: 50, width: 200 },
            color: { x: 250, width: 80 },
            size: { x: 330, width: 40 },
            qty: { x: 370, width: 40 },
            price: { x: 410, width: 70 },
            total: { x: 480, width: 70 }
        };

        // Table headers
        doc.fontSize(10)
           .text('Item', columns.item.x, y)
           .text('Color', columns.color.x, y)
           .text('Size', columns.size.x, y)
           .text('Qty', columns.qty.x, y)
           .text('Price', columns.price.x, y)
           .text('Total', columns.total.x, y);

        // Add line below headers
        y += 15;
        doc.moveTo(50, y).lineTo(550, y).stroke();
        y += 15;

        // Add items
        for (const item of order.items) {
            const productName = formatProductName(item.productId.productName);
            
            doc.text(productName, columns.item.x, y, { width: columns.item.width })
               .text(item.color, columns.color.x, y)
               .text(item.size.toString(), columns.size.x, y)
               .text(item.quantity.toString(), columns.qty.x, y)
               .text(formatCurrency(item.price), columns.price.x, y)
               .text(formatCurrency(item.totalPrice), columns.total.x, y);

            y += 40;
        }

        // Add line after items
        doc.moveTo(50, y).lineTo(550, y).stroke();
        y += 20;

        // Add totals with adjusted positioning
        const totalStartX = 350;
        const valueStartX = 480;

        doc.text('Subtotal:', totalStartX, y)
           .text(formatCurrency(order.subtotal), valueStartX, y);
        y += 20;

        doc.text('Shipping:', totalStartX, y)
           .text(formatCurrency(order.shippingCost), valueStartX, y);
        y += 20;

        if (order.couponApplied && order.couponApplied.code) {
            doc.text(`Discount (${order.couponApplied.code}):`, totalStartX, y)
               .text(`-${formatCurrency(order.couponApplied.discountAmount)}`, valueStartX, y);
            y += 20;
        }

        // Total with bold formatting
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('Total:', totalStartX, y)
           .text(formatCurrency(order.total), valueStartX, y);

        // Add footer
        doc.fontSize(10)
           .font('Helvetica')
           .text('Thank you for your business!', 50, y + 50)
           .text('For any queries, please contact our support team.', 50, y + 65);

        // Finalize PDF
        doc.end();

    } catch (error) {
        console.error('Error generating invoice:', error);
        res.status(500).send('Error generating invoice');
    }
};


module.exports= {
    listOrders,
    orderDetails,
    updateOrderStatus,
    cancelEntireOrder,
    handleOrderRefund,
    handleOrderRefund,
    handleReturnRequest,
    cancelOrderItem,
    getReturnRequestDetails,
    downloadInvoice
}