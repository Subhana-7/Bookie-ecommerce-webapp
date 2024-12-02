const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const passport = require("passport");
const userProductController = require("../controllers/user/userProductController");
const profileController = require("../controllers/user/profileController");
const orderController = require("../controllers/user/orderController");
const wishlistController = require("../controllers/user/wishlistController");
const walletController = require("../controllers/user/walletController");
const retryPaymentController = require("../controllers/user/retryPaymentController");
const chatBoxController = require("../controllers/user/chatBoxController");
const {userAuth,adminAuth} = require("../middlewares/auth");


router.get("/pageNotFound",userController.pageNotFound);
router.get("/signup",userController.loadSignup);
router.post("/signup",userController.signup);
router.post("/verify-otp",userController.verifyOtp);
router.post("/resend-otp",userController.resendOtp);
router.get("/",userAuth,userController.loadHomePage);


router.get('/auth/google',
  passport.authenticate('google', {
      scope: ['profile', 'email'],
      prompt: 'select_account' 
  })
);

router.get('/auth/google/callback',
  passport.authenticate('google', {
      failureRedirect: '/login',
      failureFlash: true
  }),
  (req, res) => {
      req.session.user = req.user;
      console.log("Authentication successful:", req.user);
      res.redirect('/');
  }
);


const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
      return next();
  }
  res.redirect('/login');
};

//reset password
router.get("/reset-password",userController.getResetPassword);
router.post("/send-reset-password-otp", userController.sendResetPasswordOTP);
router.post("/verify-reset-password-otp", userController.verifyResetPasswordOTP);
router.post("/reset-password", userController.resetPassword);


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
router.post("/cart/remove",userAuth,profileController.removeItemFromCart);
router.post("/cart/update",userAuth,profileController.updateCart);
router.get("/cart/item-count",userAuth,profileController.getCartItemCount);

//order routes

router.get("/order", userAuth, orderController.loadCheckOut);
router.post("/order", userAuth, orderController.checkOut);
router.get("/payment", userAuth, orderController.loadPlaceOrderPage);
router.post("/payment", userAuth, orderController.placeOrder);
router.post("/create-razorpay-order", userAuth, orderController.createRazorpayOrder);
router.post("/verify-razorpay-payment",userAuth,orderController.verifyRazorpayPayment);
router.get("/order-confirmation/:orderId", userAuth, orderController.orderConfirmation);
router.get("/payment-failed",userAuth,orderController.paymentFailed);

//coupon

router.get("/coupon",adminAuth,orderController.getCoupons);


//orders view

router.get("/orders-list",userAuth,orderController.loadListOrders);
router.get("/order-details/:orderId",userAuth,orderController.loadOrderDetails);
router.get("/cancel-order-page/:id",userAuth,orderController.getCancelOrder);
router.post("/cancel-order/:orderId",userAuth,orderController.cancelOrder);
router.get("/return-order-page/:id",userAuth,orderController.getReturnOrder);
router.post("/return-order/:orderId",userAuth,orderController.returnRequest);

//wishlist
router.get("/wishlist",userAuth,wishlistController.loadWishlist);
router.post("/wishlist/add",userAuth,wishlistController.addItemToWishlist);
router.post("/wishlist/remove",userAuth,wishlistController.removeItemFromWishlist);

//wallet
router.get("/wallet",userAuth,walletController.loadWallet);

//invoice
router.get('/download-invoice/:orderId',userAuth,orderController.invoiceDownload);

//continue payment

router.get("/continue-payment/:orderId",userAuth,retryPaymentController.getContinuePaymentPage);
router.post("/continue-payment/:orderId",userAuth,retryPaymentController.initiatePayment);
router.post("/payment-success/:orderId",userAuth,retryPaymentController.handlePaymentSuccess);

//chatBox

router.get("/chat",userAuth,chatBoxController.loadChatBox);
router.post("/chat",userAuth,chatBoxController.chatbox);


module.exports = router;