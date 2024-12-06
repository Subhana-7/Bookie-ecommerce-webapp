const Razorpay = require("razorpay");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");

const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const getContinuePaymentPage = async (req, res) => {
    const orderId = req.params.orderId;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).render("error", { message: "Invalid Order ID." });
    }

    try {
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).render("error", { message: "Order not found." });
        }
        res.render("continue-payment", { order });
    } catch (error) {
        console.error(error);
        res.redirect("/pageNotFound");
    }
};


const initiatePayment = async (req, res) => {
    console.log("inside the controller block of initiate payment");
    const orderId = req.params.orderId;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({ success: false, message: "Invalid Order ID." });
    }

    try {
        console.log("inside the try block of initiate payment");
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        const amount = order.finalAmount * 100; 
        const currency = "INR";

        const razorpayOrder = await razorpayInstance.orders.create({
            amount,
            currency,
            receipt: `order_rcptid_${order._id}`
        });

        if (!razorpayOrder) {
            return res.status(500).json({ success: false, message: "Failed to create Razorpay order." });
        }

        res.json({
            success: true,
            key_id: razorpayInstance.key_id,
            amount,
            currency,
            order_id: razorpayOrder.id 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Internal Server Error." });
    }
};

const handlePaymentSuccess = async (req, res) => {
    console.log("inside the controller block of handle payment success");
    
    try {
        const Id = req.params.orderId;
        //console.log("doc id:",orderDocId)

        const { order_id, payment_id, signature } = req.body;
        // console.log("order id:",order_id);
        // console.log("payment id:",payment_id);
        // console.log("signature:",signature);

        console.log("inside the try block of handle payment success");
        const generatedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${order_id}|${payment_id}`)
        .digest("hex");

        console.log("generated sig:",generatedSignature);
        if (generatedSignature !== signature) {
            return res.status(400).json({ success: false, message: "Invalid payment signature." });
        }

        const order = await Order.findOneAndUpdate(
            {_id:Id} ,
            {
                status:'Processing',
                paymentStatus: "completed",
                paymentId: payment_id,
                paymentSignature: signature
            },
            { new: true }
        );


        for (const item of order.orderedItems) {
            await Product.updateOne(
              { _id: item.product },
              { $inc: { quantity: -item.quantity } }
            );
          }

        

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        res.json({ success: true, message: "Payment verified and order updated." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Internal Server Error." });
    }
};

module.exports = {
    getContinuePaymentPage,
    initiatePayment,
    handlePaymentSuccess
};