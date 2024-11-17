const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const adminUserController = require("../controllers/admin/adminUserController");
const adminCategoryController = require("../controllers/admin/categoryController");
const adminProductController = require("../controllers/admin/productController");
const adminOrderController = require("../controllers/admin/orderController");
const adminCouponController = require("../controllers/admin/couponController");
const adminSalesController = require("../controllers/admin/salesController");
const {userAuth,adminAuth} = require("../middlewares/auth");
const multer = require("multer");
const storage = require("../helpers/multer");

const uploads = multer({ storage: storage });

router.get("/pageNotFound",adminController.pageError);
//Login Management
router.get("/login",adminController.loadLogin);
router.post("/login",adminController.login);
router.get("/dashboard",adminAuth,adminController.loadDashboard);
router.get("/logout",adminController.logout);

//Customer Management
router.get("/users",adminAuth,adminUserController.userInfo);
router.get("/blockUser",adminAuth,adminUserController.userBlocked);
router.get("/unblockUser",adminAuth,adminUserController.userUnBlocked);

//category Management
router.get("/category",adminAuth,adminCategoryController.categoryInfo);
router.post("/add-category",adminAuth,adminCategoryController.addCategory);
router.post("/addCategoryOffer",adminAuth,adminCategoryController.addCategoryOffer);
router.post("/removeCategoryOffer",adminAuth,adminCategoryController.removeCategoryOffer);
router.get("/listCategory",adminAuth,adminCategoryController.getListCategory);
router.get("/unlistCategory",adminAuth,adminCategoryController.getUnlistCategory);
router.get("/editCategory",adminAuth,adminCategoryController.getEditCategory);
router.post("/editCategory/:id",adminAuth,adminCategoryController.editCategory);
router.get("/deleteCategory",adminAuth,adminCategoryController.deleteCategory);


//product Management

router.get("/addProduct",adminAuth,adminProductController.getAddProduct);
router.post("/addProduct",adminAuth,uploads.array("images",4),adminProductController.addProduct);
router.get("/productManagement",adminAuth,adminProductController.getProductManagementPage);
router.post("/addProductOffer",adminAuth,adminProductController.addProductOffer);
router.post("/removeProductOffer",adminAuth,adminProductController.removeProductOffer);
router.get("/blockProduct",adminAuth,adminProductController.blockProduct);
router.get("/unblockProduct",adminAuth,adminProductController.unblockProduct);
router.get("/deleteProduct",adminAuth,adminProductController.deleteProduct);
router.get("/edit-product", adminAuth, adminProductController.getEditProduct);
router.post("/edit-product/:id",adminAuth,uploads.array("images",4),adminProductController.editProduct);
router.post("/delete-image",adminAuth,adminProductController.deleteSingleImage)
//router.post("/editProduct/:id",adminAuth,uploads.array("images",4),adminProductController.editProduct);
//router.post("/deleteImage",adminAuth,adminProductController.deleteSingleImage);



//order Management

router.get("/order-management",adminAuth,adminOrderController.getOrderManagementPage);
router.post("/order-management/:orderId", adminAuth, adminOrderController.orderManagement);
router.get("/admin-order-details/:orderId",adminAuth,adminOrderController.getOrderDetails);

//coupon Management
router.get("/coupon-management",adminAuth,adminCouponController.loadCoupon);
router.get("/create-coupon",adminAuth,adminCouponController.loadCreateCoupon);
router.post("/create-coupon",adminAuth,adminCouponController.createCoupon);
router.get("/edit-coupon/:id",adminAuth,adminCouponController.loadEditCoupon);
router.post("/edit-coupon/:id",adminAuth,adminCouponController.editCoupon);
router.get("/delete-coupon/:id",adminAuth,adminCouponController.deleteCoupon);


//sales report
router.get("/sales-report",adminAuth,adminSalesController.renderSalesReportPage);
router.get("/generate-report",adminAuth,adminSalesController.generateReport);


module.exports = router;