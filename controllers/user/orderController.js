const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
const Wallet = require("../../models/walletSchema");
const Order = require("../../models/orderSchema");
const Coupon = require("../../models/couponSchema");
const crypto = require("crypto");
const PDFDocument = require('pdfkit');
const moment = require('moment');



const loadCheckOut = async (req, res) => {
  try {
    const user = await User.findById(req.session.user);
    const cart = await Cart.findOne({ userId: user._id }).populate("items.productId");
    const address = await Address.find({ userId: user._id, isDeleted: false });
    const selectedAddress = req.session.selectedAddress;

    res.render("check-out", { user, cart, address, selectedAddress });
  } catch (error) {
    res.redirect("/page-not-found");
  }
};


const checkOut = async (req, res) => {
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
    res.redirect("/payment");
  } catch (error) {
    res.redirect("/page-not-found");
  }
};


const getCoupons = async (req, res) => {
  try {
    const { totalPrice } = req.query;
    const coupons = await Coupon.find({
      isListed: true,
      minimumPrice: { $lte: totalPrice }
    });

    res.status(200).json({ success: true, coupons });
  } catch (error) {
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

    const coupons = await Coupon.find({
      isList: true,
      minimumPrice: { $lte: totalPrice },
      expireOn: { $gt: new Date() }
    });

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

    res.render("place-order", {
      user: req.session.user,
      cart,
      selectedAddress,
      coupons,
      discount,
      finalAmount
    });
  } catch (error) {
    res.redirect("/page-not-found");
  }
};


const placeOrder = async (req, res) => {
  try {
    const user = await User.findById(req.session.user);
    const { paymentMethod, finalAmount, couponId } = req.body;

    if (!user) {
      return res.status(401).json({ success: false, message: "User not authenticated." });
    }

    const cart = await Cart.findOne({ userId: user._id })
      .populate({
        path: "items.productId",
        match: { isBlocked: false, isDeleted: false },
      });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Your cart is empty." });
    }

    const filteredItems = cart.items.filter(item => item.productId !== null);

    if (!filteredItems.length) {
      return res.status(400).json({ success: false, message: "Your cart contains invalid products." });
    }

    const selectedAddressId = req.session.selectedAddress;
    if (!selectedAddressId) {
      return res.status(400).json({ success: false, message: "No address selected." });
    }

    const selectedAddress = await Address.findOne({
      _id: selectedAddressId,
      userId: user._id,
      isDeleted: false
    });

    if (!selectedAddress) {
      return res.status(400).json({ success: false, message: "Selected address is invalid." });
    }

    const totalPrice = filteredItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const finalOrderAmount = finalAmount || totalPrice;

    if (finalOrderAmount > 1000) {
      return res.status(400).json({
        success: false,
        message: "Cash on Delivery is not available for orders above ₹1000."
      });
    }

    let couponApplied = false;
    let discount = 0;
    if (couponId) {
      const coupon = await Coupon.findById(couponId);
      if (coupon) {
        couponApplied = true;
        discount = (coupon.offerPrice / 100) * totalPrice;
      }
    }

    const newOrder = new Order({
      userId: user._id,
      orderedItems: filteredItems.map(item => ({
        product: item.productId._id,
        productName: item.productId.productName,
        quantity: item.quantity,
        price: item.price,
      })),
      address: selectedAddress._id,
      totalPrice: totalPrice,
      discount: discount,
      finalAmount: finalOrderAmount,
      paymentMethod: "Cash On Delivery",
      couponApplied: couponApplied,
      status: "Pending",
      createdOn: new Date()
    });

    await newOrder.save();

    for (const item of filteredItems) {
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
      message: "Order placed successfully!"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "An error occurred while placing the order"
    });
  }
};


const createRazorpayOrder = async (req, res) => {
  try {
    const user = await User.findById(req.session.user);
    const { finalAmount, couponId } = req.body;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated.",
        action: "redirect",
        redirectUrl: "/login"
      });
    }

    const cart = await Cart.findOne({ userId: user._id })
      .populate({
        path: "items.productId",
        match: { isBlocked: false, isDeleted: false },
      });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Your cart is empty.",
        action: "redirect",
        redirectUrl: "/cart"
      });
    }

    const filteredItems = cart.items.filter(item => item.productId !== null);

    if (!filteredItems.length) {
      return res.status(400).json({
        success: false,
        message: "Your cart contains invalid products.",
        action: "redirect",
        redirectUrl: "/cart"
      });
    }

    const { addressId } = req.body;
    if (!addressId) {
      return res.status(400).json({
        success: false,
        message: "Address is required.",
        action: "prompt",
        promptMessage: "Please select a shipping address."
      });
    }

    const selectedAddress = await Address.findById(addressId);
    if (!selectedAddress) {
      return res.status(400).json({
        success: false,
        message: "Invalid address.",
        action: "redirect",
        redirectUrl: "/addresses"
      });
    }

    const totalPrice = filteredItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const finalOrderAmount = finalAmount || totalPrice;

    if (finalOrderAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid order amount.",
        action: "refresh"
      });
    }

    let couponApplied = false;
    let discount = 0;
    if (couponId) {
      const coupon = await Coupon.findById(couponId);
      if (coupon) {
        couponApplied = true;
        discount = (coupon.offerPrice / 100) * totalPrice;
      }
    }

    const newOrder = new Order({
      userId: user._id,
      orderedItems: filteredItems.map(item => ({
        product: item.productId._id,
        productName: item.productId.productName,
        quantity: item.quantity,
        price: item.price
      })),
      address: selectedAddress._id,
      totalPrice,
      discount,
      finalAmount: finalOrderAmount,
      status: 'Pending',
      paymentMethod: 'Razorpay',
      paymentStatus: 'Pending',
      couponApplied,
      createdOn: new Date()
    });

    await newOrder.save();

    try {
      const razorpay = req.app.locals.razorpayInstance;
      const razorpayOrder = await razorpay.orders.create({
        amount: finalOrderAmount * 100,
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
    } catch (razorpayError) {
      newOrder.status = 'Pending';
      newOrder.paymentStatus = 'Pending';
      await newOrder.save();

      return res.status(500).json({
        success: false,
        message: "Failed to create Razorpay order",
        action: "redirect",
        redirectUrl: `/payment-failed/${newOrder._id}`
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      action: "refresh"
    });
  }
};


const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpayOrderId, orderId, paymentId, signature } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

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
      order.paymentStatus = 'Payment Pending';
      await order.save();
      return res.status(400).json({
        success: false,
        message: "Payment verification failed.",
        redirect: "/payment-failed"
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};



const orderConfirmation = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId)
      .populate("orderedItems.product")
      .populate("address");

    if (!order) {
      return res.status(404).send("Order not found.");
    }

    res.render("order-confirmation", { order });
  } catch (error) {
    res.redirect("/page-not-found");
  }
};


const paymentFailed = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate("address orderedItems.product");

    if (!order) {
      return res.redirect("/page-not-found");
    }

    res.render("payment-failed", { order });
  } catch (error) {
    res.redirect("/page-not-found");
  }
};




const invoiceDownload = async (req, res) => {
  try {
    const id = req.params.id;
    const order = await Order.findById(id)
      .populate('orderedItems.product')
      .populate('address');

    if (!order) {
      return res.status(404).send("Order not found.");
    }

    const doc = new PDFDocument({
      margin: 50,
      size: 'A4'
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Invoice-${order.orderId}.pdf"`
    );

    const colors = {
      primary: '#2C3E50',
      secondary: '#34495E',
      accent: '#E74C3C',
      light: '#ECF0F1',
      text: '#2C3E50'
    };

    doc.save();
    doc
      .fillOpacity(0.1)
      .fontSize(100)
      .fillColor(colors.primary)
      .rotate(45, { origin: [300, 400] })
      .text('BOOKIE', 100, 300, {
        width: 500,
        align: 'center'
      })
      .restore();

    doc
      .fillColor(colors.primary)
      .fontSize(26)
      .text('BOOKIE', { align: 'left', continued: true })
      .fontSize(12)
      .fillColor(colors.secondary)
      .text('   Premium E-Commerce', { continued: false });

    doc
      .moveDown(1)
      .fillColor(colors.accent)
      .fontSize(20)
      .text('INVOICE', { align: 'right' });

    doc
      .moveDown(0.5)
      .fillColor(colors.text)
      .fontSize(10)
      .text(`Invoice Date: ${moment().format('MMMM Do, YYYY')}`, { align: 'right' })
      .text(`Order ID: ${order.orderId}`, { align: 'right' });

    doc
      .strokeColor(colors.light)
      .lineWidth(2)
      .moveTo(50, doc.y + 10)
      .lineTo(550, doc.y + 10)
      .stroke();

    doc.moveDown(1);

    const columnGap = 50;
    const leftColumnX = 50;
    const rightColumnX = 350;

    doc
      .fillColor(colors.primary)
      .fontSize(14)
      .text('Billing Details', leftColumnX, doc.y, { underline: true });

    doc
      .fillColor(colors.text)
      .fontSize(10)
      .text('Bookie E-Commerce Pvt. Ltd.')
      .text('123 Fashion Street')
      .text('Trendy District, Style City')
      .text('Fashion State - 123456');

    doc
      .fillColor(colors.primary)
      .fontSize(14)
      .text('Shipping Address', rightColumnX, doc.y - 60, { underline: true });

    doc
      .fillColor(colors.text)
      .fontSize(10)
      .text(`${order.address.name}`, rightColumnX)
      .text(`${order.address.streetName}, ${order.address.landmark}`)
      .text(`${order.address.locality}`)
      .text(`${order.address.city}, ${order.address.state} - ${order.address.pin}`)
      .text(`Contact: ${order.address.contactNo}`);

    doc.moveDown(1);

    doc
      .fillColor(colors.primary)
      .fontSize(14)
      .text('Order Summary', { underline: true });

    const tableTop = doc.y + 10;
    const headers = ['#', 'Product', 'Quantity', 'Unit Price', 'Total'];
    const columnWidths = [30, 250, 70, 90, 100];

    headers.forEach((header, i) => {
      doc
        .fillColor(colors.light)
        .rect(50 + columnWidths.slice(0, i).reduce((a, b) => a + b, 0), tableTop, columnWidths[i], 25)
        .fill(colors.secondary);

      doc
        .fillColor('white')
        .fontSize(10)
        .text(header, 50 + columnWidths.slice(0, i).reduce((a, b) => a + b, 0) + 5, tableTop + 5);
    });

    let yPosition = tableTop + 35;
    order.orderedItems.forEach((item, index) => {
      const totalPrice = item.price * item.quantity;

      doc
        .fillColor(colors.text)
        .fontSize(9)
        .text(`${index + 1}`, 55, yPosition)
        .text(item.product.productName, 80, yPosition, { width: 240 })
        .text(`${item.quantity}`, 330, yPosition, { align: 'center' })
        .text(`₹${item.price.toFixed(2)}`, 400, yPosition, { align: 'right' })
        .text(`₹${totalPrice.toFixed(2)}`, 510, yPosition, { align: 'right' });

      yPosition += 20;
    });

    doc
      .fillColor(colors.secondary)
      .rect(50, yPosition + 10, 500, 80)
      .fill();

    doc
      .fillColor('white')
      .fontSize(12)
      .text('Subtotal:', 300, yPosition + 20, { continued: true })
      .text(`₹${order.totalPrice.toFixed(2)}`, { align: 'right' });

    doc
      .text('Discount:', 300, yPosition + 35, { continued: true })
      .text(`- ₹${order.discount.toFixed(2)}`, { align: 'right' });

    doc
      .text('Total:', 300, yPosition + 50, { continued: true })
      .text(`₹${order.finalAmount.toFixed(2)}`, { align: 'right' });


    doc
      .fillColor(colors.secondary)
      .fontSize(8)
      .text('Thank you for your purchase!', 50, doc.page.height - 100, {
        align: 'center',
        width: 500
      })
      .text('www.bookie.com | support@bookie.com', 50, doc.page.height - 80, {
        align: 'center',
        width: 500
      });

    doc.end();
    doc.pipe(res);

  } catch (error) {
    res.status(500).send("Error generating invoice.");
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

    res.render("orders", { orders });
  } catch (error) {
    res.redirect("/page-not-found");
  }
};


const loadOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId)
      .populate("orderedItems.product")
      .populate("address");

    const user = req.session.user;
    res.render("order-details", { order, user });
  } catch (error) {
    res.redirect("/page-not-found");
  }
}


const getCancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const order = await Order.findById(id);

    Order.findByIdAndUpdate(id, { status: 'cancelled', cancellationReason: reason });

    res.render("cancel-order", { order });
  } catch {
    res.redirect("page-not-found");
  }
}



const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const userId = req.session.user;
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

    const product = await Product.findById(order.product);
    if (product) {
      product.quantity += 1;
      await product.save();
    }

    if (order.paymentMethod === "Razorpay") {
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
    }

    res.status(200).json({ message: 'Order has been canceled successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to cancel order.' });
  }
};



const getReturnOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const order = await Order.findById(id);

    Order.findByIdAndUpdate(id, { status: 'Returned', returnRequestReason: reason });

    res.render("return-order", { order });
  } catch {
    res.redirect("page-not-found");
  }
}





const returnRequest = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (order.status !== "Delivered") {
      return res.status(400).json({ message: "Only delivered orders can be returned." });
    }

    order.status = "Return Request";
    order.returnRequestReason = reason;
    await order.save();

    res.status(200).json({
      message: "Return request has been recorded successfully and is pending admin approval.",
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to process return request." });
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
  getCoupons,
  invoiceDownload,
  getCancelOrder,
  getReturnOrder,
  paymentFailed
}