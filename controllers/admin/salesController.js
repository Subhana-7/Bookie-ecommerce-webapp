const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const renderSalesReportPage = async (req, res) => {
  try {
    const reportTypes = [
      { value: 'daily', label: 'Daily' },
      { value: 'weekly', label: 'Weekly' },
      { value: 'monthly', label: 'Monthly' },
      { value: 'yearly', label: 'Yearly' },
      { value: 'custom', label: 'Custom Date Range' },
    ];

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
    res.redirect("/page-not-found");
  }
};

const generateReport = async (req, res) => {
  try {
    const { reportType, startDate, endDate } = req.query;

    let filter = { status: { $nin: ['Returned', 'Cancelled'] } };
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
    res.status(500).json({ error: 'Internal server error' });
  }
};

const BRAND = {
  name: 'BOOKIE',
  tagline: 'Book Selling Webapp',
  website: 'www.bookie.com',
};

const COLORS = {
  primary: '#5C2A1E',    
  primaryDark: '#3E1B13',
  accent: '#C9A227',    
  headerText: '#FFFFFF',
  text: '#222222',
  muted: '#6B6B6B',
  rowAlt: '#F8F3EA',
  border: '#E0DCD3',
  cardBg: '#FBF8F2',
};

const formatCurrency = (amount) => `Rs. ${Number(amount || 0).toFixed(2)}`;

const downloadReport = async (req, res) => {
  try {
    const { format, reportType, startDate, endDate } = req.query;

    let filter = { status: { $nin: ['Returned', 'Cancelled'] } };
    const currentDate = new Date();
    let rangeLabel = 'All Time';

    switch (reportType) {
      case 'daily':
        filter.createdOn = { $gte: new Date().setHours(0, 0, 0, 0) };
        rangeLabel = 'Today';
        break;
      case 'weekly':
        filter.createdOn = { $gte: new Date(currentDate.setDate(currentDate.getDate() - 7)) };
        rangeLabel = 'Last 7 Days';
        break;
      case 'monthly':
        filter.createdOn = { $gte: new Date(currentDate.setMonth(currentDate.getMonth() - 1)) };
        rangeLabel = 'Last 30 Days';
        break;
      case 'yearly':
        filter.createdOn = { $gte: new Date(currentDate.setFullYear(currentDate.getFullYear() - 1)) };
        rangeLabel = 'Last 12 Months';
        break;
      case 'custom':
        if (!startDate || !endDate) {
          return res.status(400).json({ error: 'Start and end dates are required for custom reports' });
        }
        filter.createdOn = { $gte: new Date(startDate), $lte: new Date(endDate) };
        rangeLabel = `${new Date(startDate).toDateString()} - ${new Date(endDate).toDateString()}`;
        break;
      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }

    const orders = await Order.find(filter)
      .populate("userId", "name")
      .populate({ path: "orderedItems.product", select: "productName" })
      .sort({ createdOn: -1 })
      .lean();

    const totalSalesCount = orders.length;
    const totalOrderAmount = orders.reduce((sum, order) => sum + (order.finalAmount || 0), 0);
    const totalDiscounts = orders.reduce((sum, order) => sum + (order.discount || 0), 0);

    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
      res.setHeader('Content-Disposition', 'attachment; filename="sales_report.pdf"');
      res.setHeader('Content-Type', 'application/pdf');
      doc.pipe(res);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 40;
      const contentWidth = pageWidth - margin * 2;

      const columns = [
        { key: 'orderId', label: 'Order ID', width: 170 },
        { key: 'customer', label: 'Customer', width: 90 },
        { key: 'amount', label: 'Amount', width: 75 },
        { key: 'payment', label: 'Payment', width: 90 },
        { key: 'date', label: 'Date', width: 90 },
      ];
      const tableX = margin;
      const rowHeight = 26;
      const headerRowHeight = 24;

      const drawBrandHeader = () => {
        doc.rect(0, 0, pageWidth, 90).fill(COLORS.primary);
        doc
          .fillColor(COLORS.headerText)
          .font('Helvetica-Bold')
          .fontSize(24)
          .text(BRAND.name, margin, 24);
        doc
          .font('Helvetica')
          .fontSize(10)
          .fillColor(COLORS.accent)
          .text(BRAND.tagline, margin, 52);

        doc
          .font('Helvetica-Bold')
          .fontSize(16)
          .fillColor(COLORS.headerText)
          .text('Sales Report', 0, 26, { width: pageWidth - margin, align: 'right' });
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor(COLORS.accent)
          .text(`Generated on ${new Date().toDateString()}`, 0, 48, {
            width: pageWidth - margin,
            align: 'right',
          });

        doc.fillColor(COLORS.text);
      };

      const drawMetaRow = (y) => {
        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor(COLORS.muted)
          .text(`Report Period: `, margin, y, { continued: true })
          .font('Helvetica')
          .fillColor(COLORS.text)
          .text(rangeLabel);
        return y + 18;
      };

      const drawSummaryCards = (y) => {
        const cardGap = 12;
        const cardWidth = (contentWidth - cardGap * 2) / 3;
        const cardHeight = 50;
        const cards = [
          { label: 'Total Orders', value: String(totalSalesCount) },
          { label: 'Total Revenue', value: formatCurrency(totalOrderAmount) },
          { label: 'Total Discount', value: formatCurrency(totalDiscounts) },
        ];

        cards.forEach((card, i) => {
          const x = margin + i * (cardWidth + cardGap);
          doc
            .rect(x, y, cardWidth, cardHeight)
            .fillAndStroke(COLORS.cardBg, COLORS.border);
          doc
            .fillColor(COLORS.muted)
            .font('Helvetica')
            .fontSize(9)
            .text(card.label, x + 12, y + 10);
          doc
            .fillColor(COLORS.primary)
            .font('Helvetica-Bold')
            .fontSize(14)
            .text(card.value, x + 12, y + 25);
        });

        return y + cardHeight + 20;
      };

      const drawTableHeader = (y) => {
        doc.rect(tableX, y, contentWidth, headerRowHeight).fill(COLORS.primary);
        let x = tableX;
        columns.forEach((col) => {
          doc
            .fillColor(COLORS.headerText)
            .font('Helvetica-Bold')
            .fontSize(9)
            .text(col.label, x + 6, y + 7, { width: col.width - 10, align: 'left' });
          x += col.width;
        });
        doc.fillColor(COLORS.text);
        return y + headerRowHeight;
      };

      const drawFooter = (pageNum, pageCount) => {
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor(COLORS.muted)
          .text(
            `${BRAND.name} | ${BRAND.website}`,
            margin,
            pageHeight - 30,
            { width: contentWidth / 2, align: 'left' }
          );
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor(COLORS.muted)
          .text(
            `Page ${pageNum} of ${pageCount}`,
            margin + contentWidth / 2,
            pageHeight - 30,
            { width: contentWidth / 2, align: 'right' }
          );
      };

      drawBrandHeader();
      let cursorY = 110;
      cursorY = drawMetaRow(cursorY);
      cursorY = drawSummaryCards(cursorY);
      cursorY = drawTableHeader(cursorY);

      const bottomLimit = pageHeight - 50;

      if (orders.length === 0) {
        doc
          .font('Helvetica')
          .fontSize(11)
          .fillColor(COLORS.muted)
          .text('No orders found for the selected period.', tableX, cursorY + 20, {
            width: contentWidth,
            align: 'center',
          });
      }

      orders.forEach((order, index) => {
        if (cursorY + rowHeight > bottomLimit) {
          doc.addPage();
          cursorY = margin;
          cursorY = drawTableHeader(cursorY);
        }

        if (index % 2 === 1) {
          doc.rect(tableX, cursorY, contentWidth, rowHeight).fill(COLORS.rowAlt);
        }
        doc.rect(tableX, cursorY, contentWidth, rowHeight).stroke(COLORS.border);

        const rowValues = {
          orderId: order.orderId || 'N/A',
          customer: order.userId?.name || 'N/A',
          amount: formatCurrency(order.finalAmount),
          payment: order.paymentMethod || 'N/A',
          date: order.createdOn ? new Date(order.createdOn).toDateString() : 'N/A',
        };

        let x = tableX;
        columns.forEach((col) => {
          doc
            .fillColor(COLORS.text)
            .font(col.key === 'orderId' ? 'Courier' : 'Helvetica')
            .fontSize(col.key === 'orderId' ? 7.5 : 8.5)
            .text(rowValues[col.key], x + 6, cursorY + 8, {
              width: col.width - 10,
              align: col.key === 'amount' ? 'right' : 'left',
            });
          x += col.width;
        });

        cursorY += rowHeight;
      });

      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        drawFooter(i - range.start + 1, range.count);
      }

      doc.end();
    } else if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sales Report');

      worksheet.addRow(['Bookie - Sales Report']);
      worksheet.getRow(1).font = { bold: true, size: 14 };
      worksheet.addRow([`Report Period: ${rangeLabel}`]);
      worksheet.addRow([]);
      worksheet.addRow(['Total Sales Count', totalSalesCount]);
      worksheet.addRow(['Total Revenue', totalOrderAmount.toFixed(2)]);
      worksheet.addRow(['Total Discount', totalDiscounts.toFixed(2)]);
      worksheet.addRow([]);

      const headerRowIndex = worksheet.rowCount + 1;
      worksheet.columns = [
        { header: 'Order ID', key: 'orderId', width: 38 },
        { header: 'User Name', key: 'userName', width: 25 },
        { header: 'Final Amount', key: 'finalAmount', width: 15 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Payment Method', key: 'paymentMethod', width: 20 },
        { header: 'Date', key: 'date', width: 20 },
      ];

      orders.forEach(order => {
        worksheet.addRow({
          orderId: order.orderId,
          userName: order.userId?.name || 'N/A',
          finalAmount: order.finalAmount.toFixed(2),
          status: order.status,
          paymentMethod: order.paymentMethod,
          date: order.createdOn ? new Date(order.createdOn).toDateString() : 'N/A',
        });
      });

      worksheet.getRow(headerRowIndex).font = { bold: true };
      worksheet.getRow(headerRowIndex).eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5C2A1E' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      });

      res.setHeader('Content-Disposition', 'attachment; filename="sales_report.xlsx"');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

      await workbook.xlsx.write(res);
      res.end();
    } else {
      res.status(400).json({ error: 'Invalid format' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  renderSalesReportPage,
  generateReport,
  downloadReport
}