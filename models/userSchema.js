


const mongoose= require("mongoose");
const {Schema}= mongoose;

const userSchema= new Schema ({
    name:{
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique:true
    },
    phone: {
        type:String,
        required: false,
        unique: true,
        sparse:true,
        default:undefined
    },
    googleId:{
        type:String,
        unique:true,
        sparse:true
    },
    password: {
        type:String,
        required: false
    },
    isBlocked: {
        type: Boolean,
        default:false
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    cart: [{
        type: Schema.Types.ObjectId,
        ref: 'Cart'
    }],
    
    wallet: {
        type: Number,
        default:0,
    },
    wishlist: [{
        type: Schema.Types.ObjectId,
        ref: "wishlist"
    }],
    orderHistory: [{
        type: Schema.Types.ObjectId,
        ref: "Order"
    }],
    createdOn : {
        type:Date,
        default:Date.now,
    },
    referralCode: {
        type: String,
        // required:true
    },
    redeemed: {
        type: Boolean,
        // defaulte:false
 
    },
    redeemedUsers: [{
        type: Schema.Types.ObjectId,
        ref: "User",
        // required:true
    }],
    searchHistory: [{
        category: {
            type: Schema.Types.ObjectId,
            ref: "Category"
        },
        Brand: {
            type: String,

        },
        searchOn: {
            type: Date,
            default: Date.now
        }
    }]
},{timestamps:true})





const user= mongoose.model("User",userSchema);


module.exports= user