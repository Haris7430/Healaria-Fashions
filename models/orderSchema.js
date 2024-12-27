const mongoose = require('mongoose');
const { Schema } = mongoose;



const returnRequestSchema = new Schema({
    itemId: {
        type: Schema.Types.ObjectId,
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    adminResponse: {
        type: String,
        default: null
    },
    customReason: {
        type: String,
        default: null
    },
    refundAmount: {
        type: Number,
        required: true
    }
}, { timestamps: true });


const orderSchema = new Schema({
    orderId: {
        type: String,
        unique: true,
        default: function() {
           
            const timestamp = Date.now().toString().slice(-10);
            const randomStr = Math.random().toString(36).substr(2, 6).toUpperCase();
            return `ORD-${timestamp}-${randomStr}`;
        }
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [{
        productId: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        variantId: {
            type: Schema.Types.ObjectId,
            ref: 'Product'
        },
        color: {
            type: String,
            required: true
        },
        size: {
            type: Number,
            required: true
        },
        quantity: {
            type: Number,
            required: true
        },
        price: {
            type: Number,
            required: true
        },
        totalPrice: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            enum: ['placed', 'cancelled', 'returned', 'return_requested', 'return_rejected'],
            default: 'placed'
        },
        returnRequest: returnRequestSchema
    }],
    // Embedded shipping address details
    shippingAddress: {
        name: {
            type: String,
            required: true,
            trim: true
        },
        addressType: {
            type: String,
            enum: ['Home', 'Work', 'Other'],
            required: true
        },
        city: {
            type: String,
            required: true,
            trim: true
        },
        landmark: {
            type: String,
            required: true,
            trim: true
        },
        state: {
            type: String,
            required: true,
            trim: true
        },
        pincode: {
            type: String,
            required: true,
            match: [/^[0-9]{6}$/, 'Please enter a valid 6-digit pincode']
        },
        phone: {
            type: String,
            required: true,
            validate: {
                validator: function(v) {
                    return /^[1-9][0-9]{9}$/.test(v);
                },
                message: props => `${props.value} is not a valid phone number!`
            }
        },
        altPhone: {
            type: String,
            validate: {
                validator: function(v) {
                    return v === '' || /^[1-9][0-9]{9}$/.test(v);
                },
                message: props => `${props.value} is not a valid phone number!`
            }
        }
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ['COD', 'RazorPay', 'Wallet']  
    },
    walletAmountUsed: {
        type: Number,
        default: 0
    },
    subtotal: {
        type: Number,
        required: true
    },
    shippingCost: {
        type: Number,
        required: true
    },
    discountAmount: {
        type: Number,
        default: 0
    },
    total: {
        type: Number,
        required: true
    },
    couponApplied: {
        code: {
            type: String,
            default: null
        },
        discountPercentage: {
            type: Number,
            default: null
        },
        discountAmount: {
            type: Number,
            default: null
        }
    },
    
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed'],
        default: 'pending'
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled']
    },
    paymentDetails: {
        razorpay_payment_id: String,
        razorpay_order_id: String,
        razorpay_signature: String
    },

    totalDiscount: {
        type: Number,
        default: 0,
        comment: 'Total discount including product discount and coupon discount'
    }
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;