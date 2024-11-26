const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
const Wallet = require("../../models/walletSchema");
const Order = require("../../models/orderSchema");


const Razorpay = require('razorpay');

const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const env = require("dotenv").config();

const crypto = require('crypto');



const continuePayment = async(req,res) => {
  console.log("inside the controller block of continuepayment");
  try {
    console.log("inside the try block of continue payment");

    const orderId = req.params.orderId;
    const order = await Order.findById(orderId); 

      console.log("your orderId and order:",orderId,order)

/*
    if (!order) {
        return res.status(404).send({ message: 'Order not found' });
    }

    if (order.paymentStatus === 'completed') {
        return res.status(400).send({ message: 'Payment already completed' });
    }

    if (order.paymentMethod !== 'razorpay' || order.paymentStatus !== 'Pending') {
        return res.status(400).send({ message: 'Invalid order status for payment retry' });
    }
        */

    console.log("checking inside continue payment");

    const paymentOptions = {
        amount: order.finalAmount * 100, 
        currency: 'INR',
        receipt: order._id.toString(),
        payment_capture: 1  
    };

    console.log("payment opyion:",paymentOptions);

    const razorpayOrder = await razorpayInstance.orders.create(paymentOptions);

    if (!razorpayOrder) {
        return res.status(500).send({ message: 'Failed to create Razorpay order' });
    }

    order.paymentGatewayOrderId = razorpayOrder.id;
    await order.save();

    return res.json({ 
        key_id: process.env.RAZORPAY_KEY_ID, 
        order_id: razorpayOrder.id, 
        amount: razorpayOrder.amount, 
        currency: razorpayOrder.currency 
    });

} catch (error) {
    console.error(error);
    return res.status(500).send({ message: 'Something went wrong, please try again.' });
}
}

const handlePaymentSuccess = async(req,res) => {
  console.log("inside the controller block of handlePaymentSuccess");
  try {
    console.log("inside the try block of handle payment success");
    const { order_id, payment_id, signature } = req.body;

    console.log("order_id :" ,order_id);
    console.log("payment_id: ",payment_id);
    console.log("signature:",signature);

    const order = await Order.findById(order_id);
    
    if (!order) {
        return res.status(404).send({ message: 'Order not found' });
    }

        console.log("order:",order);

    const body = order_id + '|' + payment_id;
    const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest('hex');

        console.log("expectedSignature: ",expectedSignature);

    if (expectedSignature !== signature) {
        order.paymentStatus = 'completed';
        order.paymentId = payment_id;
        order.orderStatus = 'Processing';  
        await order.save();

        return res.json({ success: true });
    } else {
        return res.status(400).send({ message: 'Payment verification failed' });
    }
} catch (error) {
    console.error(error);
    return res.status(500).send({ message: 'Payment verification failed' });
}
}


module.exports = {
  continuePayment,
  handlePaymentSuccess
}
