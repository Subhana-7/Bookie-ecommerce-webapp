const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");

const getOrderManagementPage = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("userId", "name");
      //console.log(orders);
    res.render("order-management", { orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.redirect("/pageNotFound");
  }
};




const orderManagement = async (req, res) => {
  //console.log("Entering orderManagement controller");
  try {
    //console.log("Inside try block of orderManagement");
    const status = req.body.status;
    const orderId = req.params.orderId;

    const order = await Order.findById(orderId).populate("orderedItems.product");

    if (!order) {
      return res.status(404).send("Order not found");
    }

    if (status === "Cancelled" && order.status !== "Cancelled") {
      for (let item of order.orderedItems) {
        const product = await Product.findById(item.product._id);
        if (product) {
          product.quantity += item.quantity;
          await product.save();
        }
      }
    }
    order.status = status;
    await order.save();
    //console.log("Order status updated successfully");
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

      //console.log(order);
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
}