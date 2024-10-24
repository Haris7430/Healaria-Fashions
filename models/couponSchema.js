
const mongoose= require('mongoose')
const {Schema}= mongoose;

const couponSchema= new mongoose.Schema({
     name: {
        type:String,
        required:true,
        unique:true
     },
     createdOn: {
        type:Date,
        defaulte: Date.now,
        required:true
     },
     expireOn: {
        type:Date,
        required:true
     },
     offerPrice:{
        type:Number,
        required:true
     },
     minimumPrice:{
        type:NUmber,
        required:true
     },
     isList:{
        type:Boolean,
        defaulte:true
     },
     userId:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
     }]
})


const Coupon= mongoose.model('Coupon',couponSchema);

module.exports= Coupon