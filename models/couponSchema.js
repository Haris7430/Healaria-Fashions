const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        validate: {
            validator: function(v) {
                // Allow letters, numbers, and spaces
                return /^[A-Za-z0-9\s]+$/.test(v);
            },
            message: props => `${props.value} is not a valid title! Only letters, numbers, and spaces are allowed.`
        }
    },
    description: {
        type: String,
        trim: true
    },
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    validFrom: {
        type: Date,
        required: true
    },
    expiryDate: {
        type: Date,
        required: true
    },
    discountPercentage: {
        type: Number,
        required: true,
        min: 1,
        max: 80
    },
    maxDiscountAmount: {
        type: Number,
        required: true,
        validate: {
            validator: function(v) {
                return typeof v === 'number' && v >= 0;
            },
            message: props => `${props.value} is not a valid maximum discount amount!`
        }
    },
    minPurchaseLimit: {
        type: Number,
        required: true, 
        min: 0
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    }
}, { timestamps: true });

const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon;