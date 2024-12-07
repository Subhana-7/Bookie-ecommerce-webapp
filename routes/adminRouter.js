const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const adminUserController = require("../controllers/admin/adminUserController");
const adminCategoryController = require("../controllers/admin/categoryController");
const adminProductController = require("../controllers/admin/productController");
const adminOrderController = require("../controllers/admin/orderController");
const adminCouponController = require("../controllers/admin/couponController");
const adminSalesController = require("../controllers/admin/salesController");
const adminDashboardController = require("../controllers/admin/dashboardController");
const { userAuth, adminAuth } = require("../middlewares/auth");
const multer = require("multer");
const storage = require("../helpers/multer");
const uploads = multer({ storage: storage });


//error page
router.get("/page-error", adminController.pageError);

//Login Management
router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get("/logout", adminController.logout);

//Dashboard Management
router.get("/dashboard", adminAuth, adminDashboardController.renderDashboard);
router.get("/dashboard-data", adminAuth, adminDashboardController.renderDashboardData);

//User Management
router.get("/users", adminAuth, adminUserController.userInfo);
router.get("/block-user", adminAuth, adminUserController.userBlocked);
router.get("/unblock-user", adminAuth, adminUserController.userUnBlocked);

//Category Management
router.get("/category", adminAuth, adminCategoryController.categoryInfo);
router.post("/add-category", adminAuth, adminCategoryController.addCategory);
router.post("/add-category-offer", adminAuth, adminCategoryController.addCategoryOffer);
router.post("/remove-category-offer", adminAuth, adminCategoryController.removeCategoryOffer);
router.get("/list-category", adminAuth, adminCategoryController.getListCategory);
router.get("/unlist-category", adminAuth, adminCategoryController.getUnlistCategory);
router.get("/edit-category", adminAuth, adminCategoryController.getEditCategory);
router.post("/edit-category/:id", adminAuth, adminCategoryController.editCategory);
router.get("/delete-category", adminAuth, adminCategoryController.deleteCategory);

//Product Management
router.get("/add-product", adminAuth, adminProductController.getAddProduct);
router.post("/add-product", adminAuth, uploads.array("images", 4), adminProductController.addProduct);
router.get("/productManagement", adminAuth, adminProductController.getProductManagementPage);
router.post("/add-product-offer", adminAuth, adminProductController.addProductOffer);
router.post("/remove-product-offer", adminAuth, adminProductController.removeProductOffer);
router.get("/block-product", adminAuth, adminProductController.blockProduct);
router.get("/unblock-product", adminAuth, adminProductController.unblockProduct);
router.get("/delete-product", adminAuth, adminProductController.deleteProduct);
router.get("/edit-product", adminAuth, adminProductController.getEditProduct);
router.post("/edit-product/:id", adminAuth, uploads.array("images", 4), adminProductController.editProduct);
router.post("/delete-product-image", adminAuth, adminProductController.deleteSingleImage);

//Order Management
router.get("/order-management", adminAuth, adminOrderController.getOrderManagementPage);
router.post("/order-management/:orderId", adminAuth, adminOrderController.orderManagement);
router.get("/admin-order-details/:orderId", adminAuth, adminOrderController.getOrderDetails);

//Coupon Management
router.get("/coupon-management", adminAuth, adminCouponController.loadCoupon);
router.get("/create-coupon", adminAuth, adminCouponController.loadCreateCoupon);
router.post("/create-coupon", adminAuth, adminCouponController.createCoupon);
router.get("/edit-coupon/:id", adminAuth, adminCouponController.loadEditCoupon);
router.post("/edit-coupon/:id", adminAuth, adminCouponController.editCoupon);
router.get("/delete-coupon/:id", adminAuth, adminCouponController.deleteCoupon);

//Sales Management
router.get("/sales-report", adminAuth, adminSalesController.renderSalesReportPage);
router.get("/generate-report", adminAuth, adminSalesController.generateReport);
router.get("/download-report", adminAuth, adminSalesController.downloadReport);



module.exports = router;