const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();


const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.session.user);
    const addressData = await Address.findOne({ userId: user._id });

    // Pass the address array if address data exists, else pass an empty array
    const address = addressData ? addressData.address : [];

    return res.render("profile", { user, address });
  } catch (error) {
    return res.render("PageNotFound");
  }
};


const loadEditProfile = async(req, res) => {
  try {
    const user = await User.findById(req.session.user);
    return res.render("edit-profile", { user: user });
  } catch (error) {
    return res.redirect("/pageNotFound");
  }
}


const editProfile = async(req, res) => {
  try {
    const { name, email, phone } = req.body;
    const updateDetails = await User.findByIdAndUpdate(req.session.user,
      {
        name: name,
        email: email,
        phone: phone,
      },{ new: true }
    );

    if (updateDetails) {
      return res.redirect("/profile");
    } else {
      res.status(404).json({ error: "Profile details not found" });
    }
  } catch (error) {
    return res.redirect("/pageNotFound");
  }
}

const loadAddAddress = async(req,res) => {
  try {
    const user = await User.findById(req.session.user);
    return res.render("add-address",{user});
  } catch (error) {
    return res.redirect("/pageNotFound");
  }
}

const addAddress = async (req, res) => {
  try {
    const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;

    // Find the existing address document for the user
    const addressData = await Address.findOne({ userId: req.session.user });

    if (addressData) {
      // If the address document exists, push the new address to the array
      addressData.address.push({
        addressType,
        name,
        city,
        landMark,
        state,
        pincode,
        phone,
        altPhone,
      });

      // Save the updated address document
      await addressData.save();
    } else {
      // If no address document exists, create a new one with the address array
      await Address.create({
        userId: req.session.user,
        address: [{
          addressType,
          name,
          city,
          landMark,
          state,
          pincode,
          phone,
          altPhone,
        }]
      });
    }

    console.log("Address successfully added");

    return res.redirect("/profile");
  } catch (error) {
    console.log("Failed to add address:", error);
    return res.redirect("/pageNotFound");
  }
};




module.exports = {
  getProfile,
  loadEditProfile,
  editProfile,
  loadAddAddress,
  addAddress
}