const mongoose= require('mongoose');
const {Schema} = mongoose;

const wishlistSchema= new mongoose.Schema({
    userId:{
        type:Schema.Types.ObjectId,
        ref:'user',
        required: true
    },
    products: [{
        productId:{
            type:Schema.Types.ObjectId,
            ref:'product',
            required:true
        },
        addedOn:{
            type:Date,
            default:Date.now
        }
    }]
})


const wishlist= mongoose.model('wishlist',wishlistSchema);

module.exports= wishlist;