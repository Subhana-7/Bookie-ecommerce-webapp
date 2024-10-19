const User = require("../../models/userSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();

const pageNotFound = async(req,res) => {
  try{
    return res.render("page-404");
  }catch(error) {
    res.redirect("/pageNotFound");
  }
}


const loadSignup = async(req,res) => {
  try{
    return res.render("signup");
  }catch(error) {
    console.log("signup page not loading" ,error);
    res.status(500).send("Server error");
  }
}

function generateOtp() {
  return Math.floor(100000 + Math.random()*900000).toString();
}

async function sendVerificationEmail(email,otp) {
  try {
    const transporter = nodemailer.createTransport({
      service:"gmail",
      port:587,
      secure:false,
      requireTLS:true,
      auth:{
        user: process.env.NODEMAILER_EMAIL,
        pass:process.env.NODEMAILER_PASSWORD
      }
    })

    const info = await transporter.sendMail({
      from:process.env.NODEMAILER_EMAIL,
      to:email,
      subject:"Verify your account",
      text:`your otp is ${otp}`,
      html:`<b>Your OTP:${otp}</b>`
    })

    return info.accepted.length > 0

  } catch (error) {
    console.error("Error Sending email",error);
    return false;
  }
}


const signup = async(req,res) => {
  try {
    const {name,phone,email,password,cPassword} = req.body;
    if(password !== cPassword) {
      return res.render("signup",{message:"passwords do not match"});
    }

    const findUser = await User.findOne({email});
    if(findUser) {
      return res.render("signup",{message:"User with this email already exists"})
    }

    const otp = generateOtp();

    const emailSent = await sendVerificationEmail(email,otp);

    if(!emailSent) {
      return res.json("email-error")
    }

    req.session.userOtp = otp;
    req.session.userData = {name,phone,email,password};

    res.render("verify-otp");
    console.log("OTP Sent",otp);

  }catch(error) {
    console.error("signup error",error);
    res.redirect("/pageNotFound");
  }
}

const securePassword = async(password) => {
  try {
    const passwordHash = await bcrypt.hash(password,10)

    return passwordHash;
  } catch (error) {
    
  }
}

const verifyOtp = async(req,res) => {
  try {
    const {otp} = req.body;

    console.log(otp);

    if(otp === req.session.userOtp) {
      const user = req.session.userData
      const passwordHash = await securePassword(user.password);

      const saveUserData = new User({
        name:user.name,
        email:user.email,
        phone:user.phone,
        password:passwordHash,
      })
      await saveUserData.save();
      req.session.user = saveUserData._id;
      return res.json({ success: true, redirectUrl: "/" });
    }else {
      return res.status(400).json({success:false,message:"Invalid OTP, Please try again"})
    }

  } catch (error) {
    console.error("Error Verifying OTP",error);
    res.status(500).json({success:false,message:"An error occured"})
  }
}
  
  


const loadHomePage = async(req,res) => {
  try{
    return res.render("home");
  }catch(error) {
    console.log("Home page not found",error);
    res.status(500).send("Server error");
  }
}


module.exports = {
  loadHomePage,
  pageNotFound,
  loadSignup,
  signup,
  verifyOtp,
}