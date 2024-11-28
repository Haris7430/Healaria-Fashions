const mongoose= require('mongoose');
const {Schema}= mongoose;








const cartSchema = new mongoose.Schema({
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
        variantId: {  // Add this for variant reference
            type: Schema.Types.ObjectId,
            default: null
        },
        size: {  // Add this for size
            type: Number,
            required: true
        },
        color: {  // Add this for color
            type: String,
            required: true
        },
        quantity: {
            type: Number,
            default: 1
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
            default: 'placed'
        },
        cancellationReason: {
            type: String,
            default: 'none'
        }
    }]
});


const Cart= mongoose.model('Cart',cartSchema)

module.exports= Cart




