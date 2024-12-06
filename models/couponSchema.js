const mongoose = require("mongoose");
const { bool } = require("sharp");

const { Schema } = mongoose;

const couponSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    createdOn: {
        type: Date,
        default: Date.now,
        requried: true
    },
    expireOn: {
        type: Date,
        required: true
    },
    offerPrice: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
    },
    minimumPrice: {
        type: Number,
        required: true
    },
    isList: {
        type: Boolean,
        default: true
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
    userId: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]


})

const Coupon = mongoose.model("Coupon", couponSchema);

module.exports = Coupon;