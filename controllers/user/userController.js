const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const Wallet = require("../../models/walletSchema");
const env = require("dotenv").config();
const crypto = require("crypto");
const transporter = require('../../config/emailConfig');



const pagNotFound = async (req, res) => {
  try {
    return res.render("page-404");
  } catch (error) {
    res.redirect("/page-not-found");
  }
}


const loadSignup = async (req, res) => {
  try {
    return res.render("signup");
  } catch (error) {
    res.status(500).send("Server error");
  }
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD
      }
    })


    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify your account",
      text: `your otp is ${otp}`,
      html: `<b>Your OTP:${otp}</b>`
    })

    return info.accepted.length > 0

  } catch (error) {
    return false;
  }
}


const generateReferralCode = () => {
  return Math.random().toString(36).substring(2, 8);
}



const signup = async (req, res) => {
  try {
    const { name, phone, email, password, cPassword, referalCode } = req.body;

    if (password !== cPassword) {
      return res.render("signup", { message: "Passwords do not match" });
    }

    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.render("signup", { message: "User with this email already exists" });
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      return res.json("email-error");
    }

    req.session.userOtp = otp;
    req.session.userData = { name, phone, email, password, referalCode };

    res.render("verify-otp");
  } catch (error) {
    res.redirect("/page-not-found");
  }
};



const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    res.redirect("/page-not-found");
  }
}

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    if (otp === req.session.userOtp) {
      const user = req.session.userData;
      const passwordHash = await securePassword(user.password);

      const referralCode = generateReferralCode();

      const newUser = new User({
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: passwordHash,
        referalCode: referralCode,
      });

      await newUser.save();

      const newUserWallet = new Wallet({
        userId: newUser._id,
        transactions: [
          {
            type: "Credit",
            amount: 50,
            balance: 50,
            description: "Signup bonus",
          },
        ],
      });

      await newUserWallet.save();

      req.session.user = newUser._id;

      return res.json({ success: true, redirectUrl: "/" });
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP, Please try again",
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "An error occurred" });
  }
};




const loadHomePage = async (req, res) => {
  try {
    const user = req.user || req.session.user;
    const categories = await Category.find({ isListed: true });

    let productData = await Product.find({
      isBlocked: false,
      isDeleted: false,
      category: { $in: categories.map(category => category._id) },
      quantity: { $gt: 0 },
    });
    productData.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));

    productData = productData.slice(0, 4);

    if (user) {
      const userData = await User.findOne({ _id: user._id });
      return res.render("home", { user: userData, products: productData });
    } else {
      return res.render("home", { products: productData });
    }
  } catch (error) {
    res.status(500).send("Server error");
  }
};


const resendOtp = async (req, res) => {
  try {
    const { email } = req.session.userData;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email not found in session" })
    }

    const otp = generateOtp();
    req.session.userOtp = otp;

    const emailSent = await sendVerificationEmail(email, otp);

    if (emailSent) {
      res.status(200).json({ success: true, message: "OTP Resend Successfully" })
    } else {
      res.status(500).json({ success: false, message: "Internal Server Error, please try again" });
    }
  } catch (error) {
    res.redirect("/page-not-found");
  }
}

const loadLogin = async (req, res) => {
  try {
    if (req.session.user) {
      const user = await User.findById(req.session.user);
      if (user && user.isBlocked) {
        req.session.destroy(() => {
          res.render("login", { message: "Your account has been blocked." });
        });
      } else {
        res.redirect("/");
      }
    } else {
      res.render("login");
    }
  } catch (error) {
    res.redirect("/page-not-found");
  }
};



const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const findUser = await User.findOne({ isAdmin: 0, email: email });

    if (!findUser) {
      return res.render("login", { message: "User not found" })
    }
    if (findUser.isBlocked) {
      return res.render("login", { message: "User is blocked by admin" })
    }

    const passwordMatch = await bcrypt.compare(password, findUser.password);

    if (!passwordMatch) {
      return res.render("login", { message: "Incorrect Password" })
    }

    req.session.user = findUser._id;
    res.redirect("/");
  } catch (error) {
    res.render("login", { message: "login failed. please try again later" })
  }
}

const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        return res.redirect("/page-not-found")
      }
      return res.redirect("/login")
    })
  } catch (error) {
    res.redirect("page-not-found");
  }
}

const getResetPassword = async (req, res) => {
  try {
    return res.render("user-reset-password");
  } catch (error) {
    return res.redirect("/page-not-found");
  }
};



const sendResetPasswordOTP = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.json({
        success: false,
        message: 'No account found with this email address.'
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    user.resetPasswordOTP = otp;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; 
    await user.save();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Reset Password OTP',
      html: `
        <h1>Password Reset</h1>
        <p>Your OTP for resetting your password is: <strong>${otp}</strong></p>
        <p>This OTP will expire in 15 minutes.</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    return res.json({
      success: true,
      message: 'OTP sent to your email successfully.'
    });

  } catch (error) {
    return res.json({
      success: false,
      message: 'Error sending OTP. Please try again.'
    });
  }
};

const verifyResetPasswordOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({
      email,
      resetPasswordOTP: parseInt(otp),
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.json({
        success: false,
        message: "Invalid or expired OTP!"
      });
    }

    return res.json({
      success: true,
      message: "OTP verified successfully!"
    });

  } catch (error) {
    return res.json({
      success: false,
      message: "Error verifying OTP. Please try again."
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({
        success: false,
        message: "User not found!"
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.resetPasswordOTP = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.json({
      success: true,
      message: "Password reset successful!"
    });

  } catch (error) {
    return res.json({
      success: false,
      message: "Error resetting password. Please try again."
    });
  }
};







module.exports = {
  loadHomePage,
  pagNotFound,
  loadSignup,
  signup,
  verifyOtp,
  resendOtp,
  loadLogin,
  login,
  logout,
  getResetPassword,
  sendResetPasswordOTP,
  verifyResetPasswordOTP,
  resetPassword
}