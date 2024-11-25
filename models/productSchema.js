const mongoose = require("mongoose");
const {Schema} = mongoose;


const productSchema = new Schema({
    productName : {
        type: String,
        required:true,
    },
    description: {
        type :String,
        required:true,
    },
    author: {
        type:String,
        required:true,
    },
    category: {
        type:Schema.Types.ObjectId,
        ref:"Category",
        required:true,
    },
    regularPrice:{
        type:Number,
        required:true,
    },
    salePrice:{
        type:Number,
        required:true,
    },
    productOffer : {
        type:Number,
        default:0,
    },
    quantity:{
        type:Number,
        required:true
    },
    publisher: {
        type:String,
        required:true
    },
    productImage:{
        type:[String],
        required:true
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    status:{
        type:String,
        enum:["Available","out of stock","Discountinued"],
        required:true,
        default:"Available"
    },
    createdOn: {
        type: Date,
        default: Date.now
    },
    rating: {
        type:Number,
        default:0,
        min:0,
        max:5,
    },
    popularity: {
        type: Number,
        default: 0 
    }, 
    featured: {
        type: Boolean,
        default: false 
    }, 
    isDeleted : {
        type:Boolean,
        default:false,
    }
});

const Product = mongoose.model("Product",productSchema);

module.exports = Product;