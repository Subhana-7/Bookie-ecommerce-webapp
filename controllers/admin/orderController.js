const Product = require("../../models/productSchema");
const Order = require("../../models/orderSchema");
const Wallet = require("../../models/walletSchema");

const getOrderManagementPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const orders = await Order.find()
      .populate("userId", "name")
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit);

    const totalOrders = await Order.countDocuments();
    const totalPages = Math.ceil(totalOrders / limit);

    res.render("order-management", {
      orders,
      currentPage: page,
      totalPages: totalPages,
    });
  } catch (error) {
    res.redirect("/page-not-found");
  }
};

const creditWallet = async (userId, amount, description) => {
  let wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    wallet = await Wallet.create({ userId, transactions: [] });
  }

  const lastBalance = wallet.transactions.length
    ? wallet.transactions[wallet.transactions.length - 1].balance
    : 0;
  const newBalance = lastBalance + amount;

  wallet.transactions.push({
    date: new Date(),
    type: "Credit",
    amount,
    balance: newBalance,
    description,
  });

  await wallet.save();
};

const orderManagement = async (req, res) => {
  try {
    const status = req.body.status;
    const returnAction = req.body.returnAction;
    const orderId = req.params.orderId;

    const order = await Order.findById(orderId).populate(
      "orderedItems.product",
    );

    if (!order) {
      return res.status(404).send("Order not found");
    }

    const wasPaidOnline =
      order.paymentMethod === "Razorpay" && order.paymentStatus === "completed";

    if (order.status === "Return Request" && returnAction) {
      if (returnAction === "allow") {
        order.status = "Returned";

        for (const item of order.orderedItems) {
          if (item.status !== "Cancelled" && item.status !== "Returned") {
            item.status = "Returned";
            item.returnedOn = new Date();

            const product = await Product.findById(item.product._id);
            if (product) {
              product.quantity += item.quantity;
              await product.save();
            }
          }
        }

        if (wasPaidOnline) {
          await creditWallet(
            order.userId,
            order.finalAmount,
            `Refund for returned order #${order.orderId}`,
          );
        }
      } else if (returnAction === "deny") {
        order.status = "Delivered";
        order.orderedItems.forEach((item) => {
          if (item.status === "Return Request") {
            item.status = "Active";
          }
        });
      }
    } else if (status) {
      if (status === "Cancelled" && order.status !== "Cancelled") {
        for (const item of order.orderedItems) {
          if (item.status === "Active") {
            item.status = "Cancelled";
            item.cancellationReason =
              item.cancellationReason || "Cancelled by admin";
            item.cancelledOn = new Date();

            const product = await Product.findById(item.product._id);
            if (product) {
              product.quantity += item.quantity;
              await product.save();
            }
          }
        }

        if (wasPaidOnline) {
          await creditWallet(
            order.userId,
            order.finalAmount,
            `Refund for cancelled order #${order.orderId}`,
          );
        }
      }

      order.status = status;
      if (status === "Delivered") {
        order.paymentStatus = "completed";
      }
    }

    await order.save();
    res.redirect("/admin/order-management");
  } catch (error) {
    res.redirect("/page-not-found");
  }
};

const manageItemReturnRequest = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { returnAction } = req.body;

    const order = await Order.findById(orderId).populate(
      "orderedItems.product",
    );
    if (!order) {
      return res.status(404).send("Order not found");
    }

    const item = order.orderedItems.id(itemId);
    if (!item) {
      return res.status(404).send("Item not found");
    }

    if (item.status !== "Return Request") {
      return res.status(400).send("This item has no pending return request.");
    }

    const wasPaidOnline =
      order.paymentMethod === "Razorpay" && order.paymentStatus === "completed";

    if (returnAction === "allow") {
      item.status = "Returned";
      item.returnedOn = new Date();

      const product = await Product.findById(item.product._id);
      if (product) {
        product.quantity += item.quantity;
        await product.save();
      }

      const refundAmount = item.price * item.quantity;

      if (wasPaidOnline) {
        await creditWallet(
          order.userId,
          refundAmount,
          `Refund for returned item "${item.productName}" (Order #${order.orderId})`,
        );
      }

      order.finalAmount = Math.max(0, order.finalAmount - refundAmount);
      order.totalPrice = Math.max(0, order.totalPrice - refundAmount);

      const allSettled = order.orderedItems.every(
        (it) => it.status === "Cancelled" || it.status === "Returned",
      );
      if (allSettled) {
        order.status = "Returned";
      }
    } else if (returnAction === "deny") {
      item.status = "Active";
    } else {
      return res.status(400).send("Invalid action.");
    }

    await order.save();
    res.redirect(`/admin/admin-order-details/${order.orderId}`);
  } catch (error) {
    res.redirect("/page-not-found");
  }
};

const getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findOne({ orderId })
      .populate("userId", "name email phone")
      .populate("address")
      .populate("orderedItems.product");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.render("admin-order-details", { order });
  } catch (error) {
    res.redirect("/page-not-found");
  }
};

module.exports = {
  getOrderManagementPage,
  orderManagement,
  manageItemReturnRequest,
  getOrderDetails,
};
