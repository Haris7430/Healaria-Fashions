
const mongoose = require('mongoose');
const { Schema } = mongoose;

const walletTransactionSchema = new Schema({
    amount: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['credit', 'debit'],
        required: true
    },
    description: {
        type: String,
        required: true
    },
    orderId: {
        type: Schema.Types.ObjectId,
        ref: 'Order',
        default: null
    },
    balance: {
        type: Number,
        required: true
    }
}, { timestamps: true });

const walletSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    balance: {
        type: Number,
        default: 0,
        min: 0
    },
    transactions: [walletTransactionSchema]
});

const Wallet = mongoose.model('Wallet', walletSchema);
module.exports = Wallet;
