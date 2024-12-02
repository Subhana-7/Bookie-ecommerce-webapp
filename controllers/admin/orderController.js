const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
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
      totalPages: totalPages
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.redirect("/pageNotFound");
  }
};

const orderManagement = async (req, res) => {
  try {
    const status = req.body.status;
    const returnAction = req.body.returnAction; 
    const orderId = req.params.orderId;

    const order = await Order.findById(orderId).populate("orderedItems.product");

    if (!order) {
      return res.status(404).send("Order not found");
    }

    if (order.status === "Return Request" && returnAction) {
      if (returnAction === "allow") {
        order.status = "Returned"; 

        const userId = order.userId;
        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
          wallet = await Wallet.create({ userId, transactions: [] });
        }

        const lastBalance = wallet.transactions.length
          ? wallet.transactions[wallet.transactions.length - 1].balance
          : 0;
        const newBalance = lastBalance + order.finalAmount;

        wallet.transactions.push({
          date: new Date(),
          type: "Credit",
          amount: order.finalAmount,
          balance: newBalance,
          description: `Refund for returned order #${orderId}`,
        });

        await wallet.save();
        console.log("Wallet updated successfully:", wallet);
      } else if (returnAction === "deny") {
        order.status = "Delivered"; 
      }
    } else if (status) {
      if (status === "Cancelled" && order.status !== "Cancelled") {
        if (order.paymentMethod === "Razorpay") {
          const userId = order.userId;
          let wallet = await Wallet.findOne({ userId });
          if (!wallet) {
            wallet = await Wallet.create({ userId, transactions: [] });
          }

          const lastBalance = wallet.transactions.length
            ? wallet.transactions[wallet.transactions.length - 1].balance
            : 0;
          const newBalance = lastBalance + order.totalPrice;

          wallet.transactions.push({
            date: new Date(),
            type: "Credit",
            amount: order.totalPrice,
            balance: newBalance,
            description: `Refund for cancelled order #${orderId}`,
          });

          await wallet.save();
          console.log("Wallet updated successfully:", wallet);
        }

        for (let item of order.orderedItems) {
          const product = await Product.findById(item.product._id);
          if (product) {
            product.quantity += item.quantity;
            await product.save();
          }
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
    console.error("Error updating order status:", error);
    res.redirect("/pageNotFound");
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
    console.error("Error fetching order details:", error);
  }
};

module.exports = {
  getOrderManagementPage,
  orderManagement,
  getOrderDetails,
};
