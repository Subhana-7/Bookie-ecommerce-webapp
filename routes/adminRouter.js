const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const adminUserController = require("../controllers/admin/adminUserController");
const adminCategoryController = require("../controllers/admin/categoryController");
const adminProductController = require("../controllers/admin/productController");
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


module.exports = router;