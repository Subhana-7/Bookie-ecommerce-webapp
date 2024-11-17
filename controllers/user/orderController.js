const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
const Wallet = require("../../models/walletSchema");
const Order = require("../../models/orderSchema");
const Coupon = require("../../models/couponSchema");
const razorpay = require("razorpay");
const crypto = require("crypto");
const { log } = require("console");


const loadCheckOut = async (req, res) => {
  console.log("loadCheckout");
  try {
    const user = await User.findById(req.session.user);
    const cart = await Cart.findOne({ userId: user._id }).populate("items.productId");
    const address = await Address.find({ userId: user._id, isDeleted: false });

    const selectedAddress = req.session.selectedAddress;
    res.render("check-out", { user, cart, address, selectedAddress });
  } catch (error) {
    console.error("Error in loadCheckOut:", error);
    res.redirect("/pageNotFound");
  }
};


const checkOut = async (req, res) => {
  console.log("Inside checkOut controller");
  try {
    const { selectedAddress } = req.body;

    if (!selectedAddress) {
      return res.status(400).send("No address selected.");
    }
    const selectedAddr = await Address.findOne({
      _id: selectedAddress,
      userId: req.session.user,
      isDeleted: false
    });

    if (!selectedAddr) {
      return res.status(400).send("Invalid address.");
    }

    const cart = await Cart.findOne({ userId: req.session.user }).populate("items.productId");

    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }

    req.session.selectedAddress = selectedAddr;
    //console.log("Session after setting selectedAddress:", req.session);
    res.redirect("/payment");
  } catch (error) {
    console.error("Error in checkOut controller:", error);
    res.redirect("/pageNotFound");
  }
};

const getCoupons = async (req, res) => {
  try {
    const { totalPrice } = req.query; 
    const coupons = await Coupon.find({ 
      isListed: true, 
      minimumPrice: { $lte: totalPrice } 
    });

    console.log("Coupons fetched:", coupons); 

    res.status(200).json({ success: true, coupons });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    res.status(500).json({ success: false, message: "Failed to fetch coupons." });
  }
};



const loadPlaceOrderPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }

    const selectedAddressId = req.session.selectedAddress;

    if (!selectedAddressId) {
      return res.status(400).send("No selected address found");
    }

    const selectedAddress = await Address.findOne({
      _id: selectedAddressId,
      userId: userId,
      isDeleted: false
    });

    if (!selectedAddress) {
      return res.status(400).send("Selected address is not valid or no longer exists");
    }

    const totalPrice = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);

    console.log("Total Price:", totalPrice);


    const coupons = await Coupon.find({
      isList: true, 
      minimumPrice: { $lte: totalPrice },
      expireOn: { $gt: new Date() }
    });

    console.log("Available coupons:", coupons);

     let discount = 0;
     let finalAmount = totalPrice;
     const couponId = req.session.couponId; 
 
     if (couponId) {
       const selectedCoupon = coupons.find(coupon => coupon._id.toString() === couponId);
       if (selectedCoupon) {
         discount = selectedCoupon.offerPrice; 
         finalAmount = totalPrice - discount;
       }
     }

    //console.log(selectedAddress);
    res.render("place-order", {
      user: req.session.user,
      cart,
      selectedAddress,
      coupons, 
      discount,
      finalAmount
    });
  } catch (error) {
    console.error("Error in loadPlaceOrderPage:", error);
    res.redirect("/pageNotFound");
  }
};



const placeOrder = async (req, res) => {
  console.log("place order");
  try {
    console.log("placeOrder inside try");
    const user = await User.findById(req.session.user);
    const {address, paymentMethod, finalAmount } = req.body;

    if (!user) {
      return res.status(401).json({ success: false, message: "User  not authenticated." });
    }

    const cart = await Cart.findOne({ userId: user._id }).populate("items.productId");

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Your cart is empty." });
    }

    const selectedAddressId = req.session.selectedAddress;

    //console.log("selected address in placeOrder", selectedAddressId);

    if (!cart || !selectedAddressId) {
      return res.status(400).send("Cart or address not found.");
    }

    const selectedAddress = await Address.findOne({
      _id: selectedAddressId,
      userId: user._id,
      isDeleted: false
    });

    if (!selectedAddress) {
      return res.status(400).send("Selected address is not valid or no longer exists");
    }

    //
    const totalPrice = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
    // Use finalAmount from the frontend (already discounted)
    const finalOrderAmount = finalAmount || totalPrice;
    //
  

    const newOrder = new Order({
      userId: user._id,
      orderedItems: cart.items.map(item => ({
        product: item.productId._id,
        quantity: item.quantity,
        price: item.price,
        
      })),
      address: selectedAddress._id,
      totalPrice:totalPrice,
      finalAmount:finalOrderAmount,
      paymentMethod: paymentMethod === "Cash On Delivery" ? "Cash On Delivery" : "Pending",
      status: paymentMethod === "Cash On Delivery" ? "Pending" : "Processing",
      createdOn: new Date()
    });
    await newOrder.save();

    //
    if(paymentMethod === 'Razorpay') {
      const options = {
        amount: finalAmount * 100,
        currency:"INR",
        //receipt: order_rcptid_${newOrder._id},
      };

      const order = await razorpay.orders.create(options);
      return res.status(201).json({
        success: true,
        orderId: newOrder._id,
        razorpayOrderId: order.id,
        amount: finalOrderAmount,
        currency: "INR",
        keyId: razorpay.key_id,
      });
    } else {
      for (const item of cart.items) {
        await Product.updateOne(
          { _id: item.productId._id },
          { $inc: { quantity: -item.quantity } }
        );
      }

      cart.items = [];
      await cart.save();
      return res.status(201).json({
        success: true,
        orderId: newOrder._id,
        message: "Order placed successfully!",
      });
    }

  } catch (error) {
    console.error("Error in placeOrder controller:", error);
    res.redirect("/pageNotFound");
  }
};


const createRazorpayOrder = async (req, res) => {
  try {
    const user = await User.findById(req.session.user);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not authenticated." });
    }

    const cart = await Cart.findOne({ userId: user._id }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty." });
    }

    const { addressId } = req.body;
    if (!addressId) {
      return res.status(400).json({ success: false, message: "Address is required." });
    }

    const selectedAddress = await Address.findById(addressId);
    if (!selectedAddress) {
      return res.status(400).json({ success: false, message: "Invalid address." });
    }

    const totalPrice = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);

    const newOrder = new Order({
      userId: user._id,
      orderedItems: cart.items.map(item => ({
        product: item.productId._id,
        quantity: item.quantity,
        price: item.price
      })),
      address: selectedAddress._id,
      totalPrice,
      finalAmount: totalPrice,
      status: 'Pending', 
      paymentMethod: 'pending', 
      paymentStatus: 'Pending', 
      createdOn: new Date()
    });
    
    await newOrder.save();

    const razorpay = req.app.locals.razorpayInstance;
    const razorpayOrder = await razorpay.orders.create({
      amount: totalPrice * 100,
      currency: "INR",
      receipt: `order_rcptid_${newOrder._id}`
    });

    res.status(201).json({
      success: true,
      keyId: process.env.RAZORPAY_KEY_ID,
      razorpayOrderId: razorpayOrder.id,
      orderId: newOrder._id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpayOrderId, orderId, paymentId, signature } = req.body;
    
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }
    
    //console.log("RAZORPAY_SECRET_KEY:", process.env.RAZORPAY_SECRET_KEY);

    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    hmac.update(`${razorpayOrderId}|${paymentId}`);
    const expectedSignature = hmac.digest("hex");

    if (expectedSignature === signature) {
      order.status = 'Processing';
      order.paymentStatus = 'completed'; 
      order.paymentMethod = 'Razorpay';
      order.paymentId = paymentId;
      await order.save();

      for (const item of order.orderedItems) {
        await Product.updateOne(
          { _id: item.product },
          { $inc: { quantity: -item.quantity } }
        );
      }

      // Clear cart
      await Cart.updateOne(
        { userId: order.userId }, 
        { $set: { items: [] } }
      );

      return res.json({
        success: true,
        message: "Payment verified and order placed successfully."
      });
    } else {
      order.status = 'Cancelled';
      order.paymentStatus = 'Pending';
      await order.save();
      return res.status(400).json({ 
        success: false, 
        message: "Payment verification failed." 
      });
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};


const orderConfirmation = async (req, res) => {
  try {
    console.log("order-confirmation inside try");
    const orderId = req.params.orderId;  
    const order = await Order.findById(orderId)
      .populate("orderedItems.product")
      .populate("address"); 

    //console.log(order);  
    if (!order) {
      return res.status(404).send("Order not found.");
    }

    res.render("order-confirmation", { order });
  } catch (error) {
    console.error("Error in orderConfirmation controller:", error);
    res.redirect("/pageNotFound");
  }
};



const loadListOrders = async (req, res) => {
  try {
    const userId = req.session.user;

    if (!userId) {
      return res.redirect("/login");
    }
    const orders = await Order.find({ userId })
      .populate({
        path: 'orderedItems.product',
        select: 'productName'
      })
      .populate('address', 'street city zip')
      .sort({ createdOn: -1 });

    //console.log("Orders found:", orders); 

    if (!orders || orders.length === 0) {
      console.log("No orders found for user:", userId);
    }
    res.render("orders", { orders });
  } catch (error) {
    console.error("Error in loadListOrders controller:", error);
    res.redirect("/pageNotFound");
  }
};


const loadOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId)
     .populate("orderedItems.product")
     .populate("address");

     //console.log("Order found:", order);
     res.render("order-details", { order });
}catch (error) {
  console.error("Error in loadOrderDetails controller:", error);
  res.redirect("/pageNotFound");
}
}




const cancelOrder = async (req, res) => {
  console.log("Inside cancelOrder controller");
  try {
    const { orderId } = req.params;  
    const { reason } = req.body;
    const userId = req.session.user; 

    console.log("Order ID:", orderId);
    console.log("Cancellation Reason:", reason);

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    if (order.status === "Delivered" || order.status === "Returned") {
      return res.status(400).json({ message: "Order cannot be canceled." });
    }

    order.status = 'Cancelled';
    order.cancellationReason = reason;
    await order.save();

    const refundAmount = order.finalAmount;

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = await Wallet.create({ userId, transactions: [] });
    }

    const lastBalance = wallet.transactions.length 
      ? wallet.transactions[wallet.transactions.length - 1].balance 
      : 0;
    const newBalance = lastBalance + refundAmount;

    wallet.transactions.push({
      date: new Date(),
      type: "Credit",
      amount: refundAmount,
      balance: newBalance,
      description: `Refund for canceled order #${orderId}`
    });

    await wallet.save();

    console.log("Order updated successfully:", order);
    res.status(200).json({ message: 'Order has been canceled successfully and refund amount is creadited to your wallet.' });
    
  } catch (error) {
    console.error('Error canceling order:', error);
    res.status(500).json({ message: 'Failed to cancel order.' });
  }
};






// Controller for handling return request
const returnRequest = async (req, res) => {
  try {
    const orderId = req.params.orderId;  // Corrected to orderId
    const { reason } = req.body;

      // Update the order with return reason and set status to 'return_requested'
      await Order.findByIdAndUpdate(orderId, {
          status: 'Return Pending',
          returnRequestReason: reason
      });

      res.status(200).json({ message: 'Return request submitted successfully.' });
  } catch (error) {
      console.error('Error submitting return request:', error);
      res.status(500).json({ message: 'Failed to submit return request.' });
  }
};






module.exports = {
  loadCheckOut,
  checkOut,
  placeOrder,
  loadPlaceOrderPage,
  orderConfirmation,
  loadListOrders,
  loadOrderDetails,
  cancelOrder,
  returnRequest,
  verifyRazorpayPayment,
  createRazorpayOrder,
  getCoupons
}