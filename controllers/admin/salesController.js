const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const renderSalesReportPage = async (req, res) => {
  console.log("Inside the controller block of renderSalesReportPage");
  try {
    const reportTypes = [
      { value: 'daily', label: 'Daily' },
      { value: 'weekly', label: 'Weekly' },
      { value: 'monthly', label: 'Monthly' },
      { value: 'yearly', label: 'Yearly' },
      { value: 'custom', label: 'Custom Date Range' },
    ];

    // Exclude orders with 'Returned' or 'Cancelled' statuses
    const statusFilter = { status: { $nin: ['Returned', 'Cancelled'] } };

    const totalOrders = await Order.countDocuments(statusFilter);
    const totalOrderAmountData = await Order.aggregate([
      { $match: statusFilter },
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

    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const orders = await Order.find(statusFilter)
      .populate("userId", "name")
      .populate({
        path: "orderedItems.product",
        select: "productName",
      })
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPages = Math.ceil(totalOrders / limit);

    res.render("salesManagement", {
      title: "Sales Report",
      totalOrders,
      totalOrderAmount,
      totalDiscount,
      orders,
      reportTypes,
      currentPage: page,
      totalPages: totalPages,
    });
  } catch (error) {
    console.error("Error:", error);
    res.redirect("/pageNotFound");
  }
};

const generateReport = async (req, res) => {
  console.log("Inside the controller block of generateReports");
  try {
    const { reportType, startDate, endDate } = req.query;

    let filter = { status: { $nin: ['Returned', 'Cancelled'] } }; // Exclude returned and cancelled orders
    const currentDate = new Date();

    switch (reportType) {
      case 'daily':
        filter.createdOn = { $gte: new Date().setHours(0, 0, 0, 0) };
        break;
      case 'weekly':
        filter.createdOn = { $gte: new Date(currentDate.setDate(currentDate.getDate() - 7)) };
        break;
      case 'monthly':
        filter.createdOn = { $gte: new Date(currentDate.setMonth(currentDate.getMonth() - 1)) };
        break;
      case 'yearly':
        filter.createdOn = { $gte: new Date(currentDate.setFullYear(currentDate.getFullYear() - 1)) };
        break;
      case 'custom':
        if (!startDate || !endDate) {
          return res.status(400).json({ error: 'Start and end dates are required for custom reports' });
        }
        filter.createdOn = { $gte: new Date(startDate), $lte: new Date(endDate) };
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

    // Calculate dynamic state data
    const totalSalesCount = orders.length;
    const totalOrderAmount = orders.reduce((sum, order) => sum + order.totalPrice, 0);
    const totalDiscounts = orders.reduce((sum, order) => sum + (order.discount || 0), 0);

    res.json({
      success: true,
      orders,
      totalSalesCount,
      totalOrderAmount,
      totalDiscounts,
    });
  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
};



const downloadReport = async (req, res) => {
  try {
    const { format, reportType, startDate, endDate } = req.query;

    let filter = { status: { $nin: ['Returned', 'Cancelled'] } }; // Exclude returned and cancelled orders
    const currentDate = new Date();

    switch (reportType) {
      case 'daily':
        filter.createdOn = { $gte: new Date().setHours(0, 0, 0, 0) };
        break;
      case 'weekly':
        filter.createdOn = { $gte: new Date(currentDate.setDate(currentDate.getDate() - 7)) };
        break;
      case 'monthly':
        filter.createdOn = { $gte: new Date(currentDate.setMonth(currentDate.getMonth() - 1)) };
        break;
      case 'yearly':
        filter.createdOn = { $gte: new Date(currentDate.setFullYear(currentDate.getFullYear() - 1)) };
        break;
      case 'custom':
        if (!startDate || !endDate) {
          return res.status(400).json({ error: 'Start and end dates are required for custom reports' });
        }
        filter.createdOn = { $gte: new Date(startDate), $lte: new Date(endDate) };
        break;
      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }

    const orders = await Order.find(filter)
      .populate("userId", "name")
      .populate({ path: "orderedItems.product", select: "productName" })
      .lean();

    // Calculate dynamic state data
    const totalSalesCount = orders.length;
    const totalOrderAmount = orders.reduce((sum, order) => sum + order.totalPrice, 0);
    const totalDiscounts = orders.reduce((sum, order) => sum + (order.discount || 0), 0);

    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      res.setHeader('Content-Disposition', 'attachment; filename="sales_report.pdf"');
      res.setHeader('Content-Type', 'application/pdf');
    
      doc.pipe(res);
    
      // Table headers
      const headers = [
        'Order ID',
        'User Name',
        'Total Price',
        'Final Amount',
        'Discount',
        'Status',
        'Payment Method',
        'Date',
      ];
    
      // Constants for layout
      const pageHeight = doc.page.height;
      const margin = 10;
      const headerHeight = 20;
      const rowHeight = 30;
      const footerHeight = 50;
      const columnWidths = [90, 100, 80, 80, 70, 80, 110, 100]; // Adjust column widths for proper spacing
      const tableX = margin;
      let currentY = margin + 220; // Starting Y position for the first row
    
      // Function to draw headers
      const drawHeaders = () => {
        let currentX = tableX;
        headers.forEach((header, index) => {
          doc.text(header, currentX, currentY, { width: columnWidths[index], align: 'center' });
          currentX += columnWidths[index];
        });
    
        // Draw header line
        doc.moveTo(tableX, currentY + headerHeight - 5)
          .lineTo(currentX, currentY + headerHeight - 5)
          .stroke();
    
        currentY += headerHeight;
      };
    
      // Function to draw footer
      const drawFooter = () => {
        doc.fontSize(10)
          .text('Generated by Bookie | www.bookie.com', margin, pageHeight - footerHeight, { align: 'center' });
      };
    
      // Function to handle page breaks
      const handlePageBreak = () => {
        if (currentY + rowHeight + footerHeight >= pageHeight) {
          drawFooter();
          doc.addPage();
          currentY = margin + 100;  // Reset to start of the new page
          drawHeaders(); // Re-draw headers on the new page
        }
      };
    
      // Add title and summary
      doc.fontSize(24).text('Bookie', { align: 'center' }).moveDown();
      doc.fontSize(20).text('Sales Report', { align: 'center' }).moveDown();
      doc.fontSize(12).text(`Total Sales Count: ${totalSalesCount}`).moveDown();
      doc.text(`Total Revenue: ${totalOrderAmount.toFixed(2)}`).moveDown();
      doc.text(`Total Discounts: ${totalDiscounts.toFixed(2)}`).moveDown();
    
      // Draw table headers
      drawHeaders();

      // Draw vertical lines for the entire table grid (before drawing rows)
// Draw vertical lines for the entire table grid
let lineX = tableX;
for (let i = 0; i < columnWidths.length; i++) {
  doc.moveTo(lineX, currentY - headerHeight - 5) // Starting from the top of the header row
    .lineTo(lineX, currentY + orders.length * rowHeight + margin) // End at the bottom of the last row
    .stroke();
  lineX += columnWidths[i];
}
    
      // Draw table rows
      orders.forEach(order => {
        handlePageBreak(); // Check if a page break is needed
    
        let currentX = tableX;
        const rowData = [
          order.orderId.substring(0, 8) + '...', // Truncate long Order IDs
          order.userId?.name || 'N/A',
          order.totalPrice.toFixed(2),
          order.finalAmount.toFixed(2),
          order.discount ? order.discount.toFixed(2) : '0.00',
          order.status,
          order.paymentMethod,
          order.createdOn ? new Date(order.createdOn).toDateString() : 'N/A',
        ];
    
        rowData.forEach((data, index) => {
          doc.text(data, currentX, currentY, { width: columnWidths[index], align: 'center' });
          currentX += columnWidths[index];
        });
    
        // Draw row separator
        doc.moveTo(tableX, currentY + rowHeight - 5)
          .lineTo(currentX, currentY + rowHeight - 5)
          .stroke();
    
        currentY += rowHeight;
      });
    

    
      // Add footer
      drawFooter();
    
      doc.end();
    }
     else if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sales Report');

      // Add summary section
      worksheet.addRow(['Sales Report']);
      worksheet.addRow([]);
      worksheet.addRow(['Total Sales Count', totalSalesCount]);
      worksheet.addRow(['Total Revenue', totalOrderAmount.toFixed(2)]);
      worksheet.addRow(['Total Discounts', totalDiscounts.toFixed(2)]);
      worksheet.addRow([]);

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

      // Add order data
      orders.forEach(order => {
        worksheet.addRow({
          orderId: order.orderId,
          userName: order.userId?.name || 'N/A',
          totalPrice: order.totalPrice.toFixed(2),
          finalAmount: order.finalAmount.toFixed(2),
          discount: order.discount ? order.discount.toFixed(2) : '0.00',
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