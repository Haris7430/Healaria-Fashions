


const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
    referralCode: {
        type: String,
        required: true,
        unique: true,
    },
    referrer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    referees: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        joinedAt: {
            type: Date,
            default: Date.now
        },
        rewardStatus: {
            type: String,
            enum: ['Pending', 'Completed', 'Failed'],
            default: 'Pending'
        },
        rewardAmount: {
            type: Number,
            default: 0
        },
        walletTransactionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Wallet'
        }
    }],
    status: {
        type: String,
        enum: ['Active', 'Expired', 'Deactivated'],
        default: 'Active'
    },
    hasUsedReferral: {
      type: Boolean,
      default: false
  },
    totalRewards: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Referral', referralSchema);