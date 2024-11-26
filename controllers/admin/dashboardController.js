const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const flash = require('express-flash');
const Order = require("../../models/orderSchema");


const renderDashboard = async (req, res) => {
    if (req.session.admin) {
      try {
        const totalOrders = await Order.countDocuments();
        const totalRevenueData = await Order.aggregate([
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: "$totalPrice" },
            },
          },
        ]);
        const totalRevenue = totalRevenueData[0]?.totalRevenue || 0;
  
        const monthlySalesData = await Order.aggregate([
          {
            $group: {
              _id: { $month: "$createdOn" },
              totalSales: { $sum: "$totalPrice" },
            },
          },
          { $sort: { _id: 1 } },
        ]);
  
        const salesData = Array(12).fill(0);
        monthlySalesData.forEach((item) => {
          salesData[item._id - 1] = item.totalSales;
        });
  
        const bestSellingProducts = await Order.aggregate([
          { $unwind: "$orderedItems" }, 
          {
            $group: {
              _id: "$orderedItems.product", 
              unitsSold: { $sum: "$orderedItems.quantity" }, 
            },
          },
          {
            $lookup: {
              from: "products", 
              localField: "_id",
              foreignField: "_id",
              as: "productDetails",
            },
          },
          { $unwind: "$productDetails" }, 
          {
            $project: {
              name: "$productDetails.productName", 
              unitsSold: 1,
            },
          },
          { $sort: { unitsSold: -1 } }, 
          { $limit: 10 }, 
        ]);
        
        const bestSellingCategories = await Order.aggregate([
          { $unwind: "$orderedItems" }, 
          {
            $lookup: {
              from: "products",
              localField: "orderedItems.product",
              foreignField: "_id",
              as: "productDetails",
            },
          },
          { $unwind: "$productDetails" },
          {
            $lookup: {
              from: "categories",
              localField: "productDetails.category",
              foreignField: "_id",
              as: "categoryDetails",
            },
          },
          { $unwind: "$categoryDetails" },
          {
            $group: {
              _id: "$categoryDetails._id",
              name: { $first: "$categoryDetails.name" },
              unitsSold: { $sum: "$orderedItems.quantity" },
            },
          },
          { $sort: { unitsSold: -1 } }, 
          { $limit: 10 },
        ]);
        
        res.render("dashboard", {
          totalOrders,
          totalRevenue,
          salesData,
          bestSellingProducts,
          bestSellingCategories,
        });
      } catch (error) {
        console.error("Error rendering dashboard:", error);
        res.redirect("/pageNotFound");
      }
    } else {
      res.redirect("/admin/login");
    }
  };
  


const renderDashboardData = async (req, res) => {
  const filter = req.query.filter || "monthly";
  try {
    let salesData = [];
    let labels = [];

    if (filter === "daily") {
      // Group data by day
      const dailySalesData = await Order.aggregate([
        {
          $group: {
            _id: { $dayOfMonth: "$createdOn" },
            totalSales: { $sum: "$totalPrice" },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      labels = dailySalesData.map((item) => `Day ${item._id}`);
      salesData = dailySalesData.map((item) => item.totalSales);

    } else if (filter === "monthly") {
      const monthlySalesData = await Order.aggregate([
        {
          $group: {
            _id: { $month: "$createdOn" },
            totalSales: { $sum: "$totalPrice" },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      labels = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
      ];
      salesData = Array(12).fill(0);
      monthlySalesData.forEach((item) => {
        salesData[item._id - 1] = item.totalSales;
      });

    } else if (filter === "yearly") {
      const yearlySalesData = await Order.aggregate([
        {
          $group: {
            _id: { $year: "$createdOn" },
            totalSales: { $sum: "$totalPrice" },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      labels = yearlySalesData.map((item) => `Year ${item._id}`);
      salesData = yearlySalesData.map((item) => item.totalSales);
    }

    res.json({ labels, sales: salesData });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({ error: "Unable to fetch data" });
  }
};



module.exports = {
 renderDashboard,
 renderDashboardData
};