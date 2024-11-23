const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

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
      reportTypes,
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

const downloadReport = async (req, res) => {
  //console.log("Inside the controller block of downloadReport");
  try {
    const { format, reportType, startDate, endDate } = req.query;

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
      .populate({ path: "orderedItems.product", select: "productName" })
      .lean();

    if (format === 'pdf') {
      const doc = new PDFDocument();
      res.setHeader('Content-Disposition', 'attachment; filename="sales_report.pdf"');
      res.setHeader('Content-Type', 'application/pdf');

      doc.pipe(res);
      doc.fontSize(18).text('Sales Report', { align: 'center' });
      doc.moveDown();

      orders.forEach(order => {
        doc.fontSize(12).text(`Order ID: ${order.orderId}`);
        doc.text(`User: ${order.userId?.name || 'N/A'}`);
        doc.text(`Total Price: ${order.totalPrice}`);
        doc.text(`Final Amount: ${order.finalAmount}`);
        doc.text(`Discount: ${order.discount}`);
        doc.text(`Status: ${order.status}`);
        doc.text(`Payment Method: ${order.paymentMethod}`);
        doc.text(`Date: ${order.createdOn ? new Date(order.createdOn).toDateString() : 'N/A'}`);
        doc.moveDown();
      });

      doc.end();
    } else if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sales Report');

      // Add headers
      worksheet.columns = [
        { header: 'Order ID', key: 'orderId', width: 15 },
        { header: 'User Name', key: 'userName', width: 25 },
        { header: 'Total Price', key: 'totalPrice', width: 15 },
        { header: 'Final Amount', key: 'finalAmount', width: 15 },
        { header: 'Discount', key: 'discount', width: 10 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Payment Method', key: 'paymentMethod', width: 20 },
        { header: 'Date', key: 'date', width: 15 },
      ];

      orders.forEach(order => {
        worksheet.addRow({
          orderId: order.orderId,
          userName: order.userId?.name || 'N/A',
          totalPrice: order.totalPrice,
          finalAmount: order.finalAmount,
          discount: order.discount,
          status: order.status,
          paymentMethod: order.paymentMethod,
          date: order.createdOn ? new Date(order.createdOn).toDateString() : 'N/A',
        });
      });

      res.setHeader('Content-Disposition', 'attachment; filename="sales_report.xlsx"');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

      await workbook.xlsx.write(res);
      res.end();
    } else {
      res.status(400).json({ error: 'Invalid format' });
    }
  } catch (error) {
    console.error("Error generating downloadable report:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
};






module.exports = {
  renderSalesReportPage,
  generateReport,
  downloadReport
}