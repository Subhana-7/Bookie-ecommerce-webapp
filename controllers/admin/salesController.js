const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");

const renderSalesReportPage = async (req, res) => {
  console.log("inside the controller block of renderSalesReportPage");
  try {
    console.log("inside the try block of renderSalesReportPage");
    const reportTypes = [
      { value: 'daily', label: 'Daily' },
      { value: 'weekly', label: 'Weekly' },
      { value: 'monthly', label: 'Monthly' },
      { value: 'yearly', label: 'Yearly' },
      { value: 'custom', label: 'Custom Date Range' },
    ];

    // Existing logic to fetch totals and orders
    const totalOrders = await Order.countDocuments();
    const totalOrderAmountData = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalOrderAmount: { $sum: "$totalPrice" },
          totalDiscount: { $sum: "$discount" },
        },
      },
    ]);
    const totalOrderAmount = totalOrderAmountData[0]?.totalOrderAmount || 0;
    const totalDiscount = totalOrderAmountData[0]?.totalDiscount || 0;

    const orders = await Order.find()
      .populate("userId", "name")
      .populate({
        path: "orderedItems.product",
        select: "productName",
      })
      .lean();

    res.render("salesManagement", {
      title: "Sales Report",
      totalOrders,
      totalOrderAmount,
      totalDiscount,
      orders,
      reportTypes, // Pass report types to the frontend
    });
  } catch (error) {
    console.error("Error:", error);
    res.redirect("/pageNotFound");
  }
};


const generateReport = async (req, res) => {
  console.log("Inside the controller block of generateReports");
  try {
    console.log("inside the try block of generateReports");
      const { reportType, startDate, endDate } = req.query;

      let filter = {};
      const currentDate = new Date();

      switch (reportType) {
          case 'daily':
              filter = { createdOn: { $gte: new Date().setHours(0, 0, 0, 0) } };
              break;
          case 'weekly':
              filter = { createdOn: { $gte: new Date(currentDate.setDate(currentDate.getDate() - 7)) } };
              break;
          case 'monthly':
              filter = { createdOn: { $gte: new Date(currentDate.setMonth(currentDate.getMonth() - 1)) } };
              break;
          case 'yearly':
              filter = { createdOn: { $gte: new Date(currentDate.setFullYear(currentDate.getFullYear() - 1)) } };
              break;
          case 'custom':
              if (!startDate || !endDate) {
                  return res.status(400).json({ error: 'Start and end dates are required for custom reports' });
              }
              filter = { createdOn: { $gte: new Date(startDate), $lte: new Date(endDate) } };
              break;
          default:
              return res.status(400).json({ error: 'Invalid report type' });
      }

      const orders = await Order.find(filter)
          .populate("userId", "name")
          .populate({
              path: "orderedItems.product",
              select: "productName",
          })
          .lean();

      res.json({ success: true, orders });
  } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ error: 'Internal server error' });
  }
};





module.exports = {
  renderSalesReportPage,
  generateReport
}