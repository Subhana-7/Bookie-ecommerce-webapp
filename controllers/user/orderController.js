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

    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Invoice-${order.orderId}.pdf"`
    );
    doc.pipe(res);

    const colors = {
      header: '#2C3E50',
      accent: '#2C3E50',
      tableHead: '#34495E',
      text: '#2C3E50',
      muted: '#7F8C8D',
      lightRow: '#F5F6F7'
    };

    const currency = (n) => `Rs. ${Number(n || 0).toFixed(2)}`;

    const pageWidth = doc.page.width;
    const marginX = 50;
    const contentWidth = pageWidth - marginX * 2;

    doc.rect(0, 0, pageWidth, 90).fill(colors.header);
    doc
      .fillColor('#FFFFFF')
      .fontSize(22)
      .text('BOOKIE', marginX, 30);
    doc
      .fontSize(10)
      .fillColor('#D5DBDB')
      .text('Premium E-Commerce', marginX, 58);

    doc
      .fillColor('#FFFFFF')
      .fontSize(20)
      .text('INVOICE', 0, 35, { align: 'right', width: pageWidth - marginX });

    doc.fillColor(colors.text);
    doc.y = 115;

    const infoTop = doc.y;
    const colWidth = contentWidth / 2;

    doc
      .fontSize(9)
      .fillColor(colors.muted)
      .text('BILLED TO', marginX, infoTop);
    doc
      .fontSize(11)
      .fillColor(colors.text)
      .text(order.address.name || '', marginX, infoTop + 14)
      .fontSize(9)
      .fillColor(colors.muted)
      .text(`${order.address.streetName || ''}, ${order.address.landmark || ''}`, marginX, doc.y + 2)
      .text(order.address.locality || '', marginX)
      .text(`${order.address.city || ''}, ${order.address.state || ''} - ${order.address.pin || ''}`, marginX)
      .text(`Contact: ${order.address.contactNo || ''}`, marginX);

    doc
      .fontSize(9)
      .fillColor(colors.muted)
      .text('INVOICE NO.', marginX + colWidth, infoTop, { width: colWidth, align: 'right' });
    doc
      .fontSize(11)
      .fillColor(colors.text)
      .text(order.orderId, marginX + colWidth, infoTop + 14, { width: colWidth, align: 'right' });


    const invoiceDate = order.createdOn
      ? moment(order.createdOn).format('MMMM Do, YYYY')
      : moment().format('MMMM Do, YYYY');

    doc
      .fontSize(9)
      .fillColor(colors.muted)
      .text('DATE', marginX + colWidth, doc.y + 8, { width: colWidth, align: 'right' })
      .fontSize(10)
      .fillColor(colors.text)
      .text(invoiceDate, marginX + colWidth, doc.y + 2, { width: colWidth, align: 'right' });

    doc.moveDown(2);
    doc.y = Math.max(doc.y, infoTop + 120);

    const columns = [
      { key: '#', width: 30, align: 'left' },
      { key: 'Product', width: 230, align: 'left' },
      { key: 'Qty', width: 60, align: 'center' },
      { key: 'Unit Price', width: 90, align: 'right' },
      { key: 'Total', width: 90, align: 'right' }
    ];
    const colX = [];
    let cursor = marginX;
    columns.forEach(c => { colX.push(cursor); cursor += c.width; });

    const drawTableHeader = (y) => {
      doc.rect(marginX, y, contentWidth, 24).fill(colors.tableHead);
      columns.forEach((c, i) => {
        doc
          .fillColor('#FFFFFF')
          .fontSize(9)
          .text(c.key, colX[i] + 6, y + 7, { width: c.width - 10, align: c.align });
      });
      return y + 24;
    };

    let tableTop = doc.y + 10;
    tableTop = drawTableHeader(tableTop);
    let y = tableTop + 8;

    const rowHeight = 22;
    const bottomLimit = doc.page.height - 160;

    order.orderedItems.forEach((item, index) => {
      if (y + rowHeight > bottomLimit) {
        doc.addPage();
        y = 50;
        y = drawTableHeader(y) + 8;
      }

      const lineTotal = item.price * item.quantity;
      if (index % 2 === 1) {
        doc.rect(marginX, y - 4, contentWidth, rowHeight).fill(colors.lightRow);
      }

      doc.fillColor(colors.text).fontSize(9);
      doc.text(`${index + 1}`, colX[0] + 6, y, { width: columns[0].width - 10, align: columns[0].align });
      doc.text(item.product?.productName || 'Product unavailable', colX[1] + 6, y, { width: columns[1].width - 10, align: columns[1].align });
      doc.text(`${item.quantity}`, colX[2] + 6, y, { width: columns[2].width - 10, align: columns[2].align });
      doc.text(currency(item.price), colX[3] + 6, y, { width: columns[3].width - 10, align: columns[3].align });
      doc.text(currency(lineTotal), colX[4] + 6, y, { width: columns[4].width - 10, align: columns[4].align });

      y += rowHeight;
    });

    if (y + 100 > doc.page.height - 60) {
      doc.addPage();
      y = 60;
    }

    const totalsBoxTop = y + 15;
    const totalsBoxWidth = 220;
    const totalsBoxX = marginX + contentWidth - totalsBoxWidth;

    doc.rect(totalsBoxX, totalsBoxTop, totalsBoxWidth, 90).fill(colors.header);

    const totalsRow = (label, value, offsetY, opts = {}) => {
      doc
        .fillColor(opts.bold ? '#FFFFFF' : '#D5DBDB')
        .fontSize(opts.bold ? 12 : 10)
        .text(label, totalsBoxX + 16, totalsBoxTop + offsetY, { width: totalsBoxWidth - 32, continued: true })
        .text(value, { align: 'right' });
    };

    totalsRow('Subtotal', currency(order.totalPrice), 16);
    totalsRow('Discount', `- ${currency(order.discount)}`, 38);
    totalsRow('Total', currency(order.finalAmount), 62, { bold: true });

    doc
      .fillColor(colors.muted)
      .fontSize(8)
      .text('Thank you for your purchase!', marginX, doc.page.height - 70, { align: 'center', width: contentWidth })
      .text('www.bookie.com | support@bookie.com', marginX, doc.page.height - 56, { align: 'center', width: contentWidth });

    doc.end();
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).send("Error generating invoice.");
    }
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
    const order = await Order.findById(id)
      .populate('orderedItems.product')
      .populate('address');

    if (!order) {
      return res.redirect('/page-not-found');
    }

    res.render("cancel-order", { order });
  } catch (error) {
    res.redirect("/page-not-found");
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

    order.orderedItems.forEach(item => {
      if (item.status === 'Active') {
        item.status = 'Cancelled';
        item.cancellationReason = reason;
        item.cancelledOn = new Date();
      }
    });

    await order.save();

    for (const item of order.orderedItems) {
      const product = await Product.findById(item.product);
      if (product) {
        product.quantity += item.quantity;
        await product.save();
      }
    }

    if (order.paymentMethod === "Razorpay" && order.paymentStatus === "completed") {
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
    const order = await Order.findById(id)
      .populate('orderedItems.product')
      .populate('address');

    if (!order) {
      return res.redirect('/page-not-found');
    }

    res.render("return-order", { order });
  } catch (error) {
    res.redirect("/page-not-found");
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

    order.orderedItems.forEach(item => {
      if (item.status === 'Active') {
        item.status = 'Return Request';
        item.returnRequestReason = reason;
      }
    });

    await order.save();

    res.status(200).json({
      message: "Return request has been recorded successfully and is pending admin approval.",
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to process return request." });
  }
};



const getCancelOrderItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const order = await Order.findById(orderId)
      .populate('orderedItems.product')
      .populate('address');

    if (!order) {
      return res.redirect('/page-not-found');
    }

    const item = order.orderedItems.id(itemId);
    if (!item) {
      return res.redirect('/page-not-found');
    }

    res.render('cancel-order-item', { order, item });
  } catch (error) {
    res.redirect('/page-not-found');
  }
};

const cancelOrderItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason } = req.body;
    const userId = req.session.user;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'Please provide a reason for cancellation.' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    if (order.userId.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to modify this order.' });
    }

    if (['Delivered', 'Cancelled', 'Returned'].includes(order.status)) {
      return res.status(400).json({ message: 'This order can no longer be modified.' });
    }

    const item = order.orderedItems.id(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found in this order.' });
    }

    if (['Cancelled', 'Returned', 'Return Request'].includes(item.status)) {
      return res.status(400).json({ message: 'This item has already been cancelled or returned.' });
    }

    item.status = 'Cancelled';
    item.cancellationReason = reason;
    item.cancelledOn = new Date();

    await Product.updateOne(
      { _id: item.product },
      { $inc: { quantity: item.quantity } }
    );

    const refundAmount = item.price * item.quantity;

    if (order.paymentMethod === 'Razorpay' && order.paymentStatus === 'completed') {
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
        type: 'Credit',
        amount: refundAmount,
        balance: newBalance,
        description: `Refund for cancelled item "${item.productName}" (Order #${order.orderId})`
      });

      await wallet.save();
    }

    order.finalAmount = Math.max(0, order.finalAmount - refundAmount);
    order.totalPrice = Math.max(0, order.totalPrice - refundAmount);

    const allCancelled = order.orderedItems.every(it => it.status === 'Cancelled');
    if (allCancelled) {
      order.status = 'Cancelled';
      order.cancellationReason = order.cancellationReason || 'All items in this order were cancelled.';
    }

    await order.save();

    res.status(200).json({ message: 'Item has been cancelled successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to cancel item.' });
  }
};

const getReturnOrderItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const order = await Order.findById(orderId)
      .populate('orderedItems.product')
      .populate('address');

    if (!order) {
      return res.redirect('/page-not-found');
    }

    const item = order.orderedItems.id(itemId);
    if (!item) {
      return res.redirect('/page-not-found');
    }

    res.render('return-order-item', { order, item });
  } catch (error) {
    res.redirect('/page-not-found');
  }
};

const returnOrderItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason } = req.body;
    const userId = req.session.user;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'Please provide a reason for return.' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    if (order.userId.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to modify this order.' });
    }

    if (order.status !== 'Delivered') {
      return res.status(400).json({ message: 'Only items from delivered orders can be returned.' });
    }

    const item = order.orderedItems.id(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found in this order.' });
    }

    if (['Cancelled', 'Returned', 'Return Request'].includes(item.status)) {
      return res.status(400).json({ message: 'This item has already been returned or cancelled.' });
    }

    item.status = 'Return Request';
    item.returnRequestReason = reason;

    await order.save();

    res.status(200).json({
      message: 'Return request for this item has been recorded and is pending admin approval.'
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to process return request.' });
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
  paymentFailed,
  getCancelOrderItem,
  cancelOrderItem,
  getReturnOrderItem,
  returnOrderItem
}