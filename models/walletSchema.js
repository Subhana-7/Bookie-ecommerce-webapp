const mongoose = require("mongoose");
const { Schema } = mongoose;

const walletSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    transactions: [{
        date: {
            type: Date,
            default: Date.now
        },
        type: {
            type: String,
            enum: ['Credit', 'Debit'],
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        balance: {
            type: Number,
            required: true
        },
        description: {
            type: String,
            required: true
        }
    }]
});

const Wallet = mongoose.model("Wallet", walletSchema);

module.exports = Wallet;
