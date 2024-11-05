const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const passport = require("passport");
const userProductController = require("../controllers/user/userProductController");
const profileController = require("../controllers/user/profileController");
const {userAuth,adminAuth} = require("../middlewares/auth");


router.get("/pageNotFound",userController.pageNotFound);
router.get("/signup",userController.loadSignup);
router.post("/signup",userController.signup);
router.post("/verify-otp",userController.verifyOtp);
router.post("/resend-otp",userController.resendOtp);
router.get("/",userAuth,userController.loadHomePage);

router.get("/auth/google",passport.authenticate("google",{scope:["profile","email"]}));
router.get("/auth/google/callback",passport.authenticate("google",{failureRedirect:"/signup"}),(req,res) => {
  res.redirect("/")
});

//reset password
router.get("/reset-password",userController.getResetPassword);

router.get("/login",userController.loadLogin);
router.post("/login",userController.login);
router.get("/logout",userAuth,userController.logout);

router.get("/products",userAuth,userProductController.getProducts);
router.get("/product-details/:id",userAuth,userProductController.productDetails);

//user profile

router.get("/profile",userAuth,profileController.getProfile);
router.get("/edit-profile",userAuth,profileController.loadEditProfile);
router.post("/edit-profile",userAuth,profileController.editProfile);
router.get("/add-address",userAuth,profileController.loadAddAddress);
router.post("/add-address",userAuth,profileController.addAddress);
router.get("/edit-address/:id",userAuth,profileController.loadEditAddress);
router.post("/edit-address/:id",userAuth,profileController.editAddress);
router.delete("/delete-address/:id",userAuth,profileController.deleteAddress);

router.get("/cart",userAuth,profileController.cart);
router.post("/cart/add",userAuth,profileController.addItemToCart);


module.exports = router;