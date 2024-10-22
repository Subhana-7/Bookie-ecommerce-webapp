const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const adminUserController = require("../controllers/admin/adminUserController");
const {userAuth,adminAuth} = require("../middlewares/auth");


router.get("/pageNotFound",adminController.pageError);
//Login Management
router.get("/login",adminController.loadLogin);
router.post("/login",adminController.login);
router.get("/dashboard",adminAuth,adminController.loadDashboard);//remove /dashboard just / is enough
router.get("/logout",adminController.logout);

//Customer Management
router.get("/users",adminAuth,adminUserController.userInfo);
router.get("/blockUser",adminAuth,adminUserController.userBlocked);
router.get("/unblockUser",adminAuth,adminUserController.userUnBlocked);

module.exports = router;