const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
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
    const addressData = await Address.findOne({ userId: req.session.user });

    if (addressData) {
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

      await addressData.save();
    } else {
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


const loadEditAddress = async(req,res) => {
  try {
    const user = await User.findById(req.session.user);
    const addressId = req.params.id;
    const address = await Address.findOne({"address._id":addressId});
    return res.render("edit-address", { user, address: address.address.id(addressId) });
  } catch (error) {
    return res.redirect("/pageNotFound");
  }
}

const editAddress = async(req,res) => {
  try {
    const addressId = req.params.id;
    const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;
    const updatedAddress = await Address.updateOne({"address._id": addressId},
      {
        $set: {
          "address.$.addressType": addressType,
          "address.$.name": name,
          "address.$.city": city,
          "address.$.landMark": landMark,
          "address.$.state": state,
          "address.$.pincode": pincode,
          "address.$.phone": phone,
          "address.$.altPhone": altPhone,
        }
      }
    );
    if (updatedAddress.modifiedCount > 0) {
      return res.redirect("/profile");
    } else {
      return res.status(404).json({ error: "Address not found or no changes made." });
    }
  } catch (error) {
    return res.redirect("/pageNotFound");
  }
}


const deleteAddress = async(req,res) => {
  try {
    const addressId = req.params.id;
    const result = await Address.updateOne(
      { "address._id": addressId },
      { $pull: { address: { _id: addressId } } }
  );
  if (result.modifiedCount > 0) {
    return res.status(200).json({ message: "Address deleted successfully." });
} else {
    return res.status(404).json({ error: "Address not found." });
}
  } catch (error) {
    return res.redirect("pageNotFound");
  }
}

const cart = async (req, res) => {
  try {
    const userId = req.session.user; // Correctly extract userId from session

    // Find the cart for the user
    const cart = await Cart.findOne({ userId }).populate("items.productId");

    // Check if the cart exists
    if (!cart || !cart.items.length) {
      // If there is no cart or no items, render the cart page with an empty message
      return res.render("cart", { cart: [], message: "Your cart is empty." });
    }

    // Render the cart view with the cart items
    return res.render("cart", { cart: cart.items, message: null }); // Pass the items to the view
  } catch (error) {
    console.error("Error fetching cart:", error); // Log error for debugging
    return res.redirect("pageNotFound");
  }
}


const addItemToCart = async (req, res) => {
  try {
    console.log("yrying")
    const userId = req.session.user;
    const { productId, quantity } = req.body;

    // Ensure `quantity` is a number and greater than 0
    const parsedQuantity = parseInt(quantity, 10);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      return res.status(400).json({ message: "Invalid quantity provided" });
    }

    // Find the product and validate its existence and price
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    if (typeof product.price !== "number") {
      return res.status(500).json({ message: "Product price is invalid" });
    }

    // Calculate total price based on the quantity
    const totalPrice = product.price * parsedQuantity;

    // Check if a cart already exists for the user, otherwise create one
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    // Find if the item already exists in the cart
    const existingItemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
    if (existingItemIndex > -1) {
      // Update quantity and totalPrice if the item exists
      cart.items[existingItemIndex].quantity += parsedQuantity;
      cart.items[existingItemIndex].totalPrice += totalPrice;
    } else {
      // Add the item to the cart if it doesn't exist
      cart.items.push({
        productId,
        quantity: parsedQuantity,
        price: product.price,
        totalPrice,
      });
    }

    // Save the cart to the database
    await cart.save();
    return res.redirect("cart");
  } catch (error) {
    console.error("Error adding item to cart:", error);
    return res.redirect("/pageNotFound");
  }
};







module.exports = {
  getProfile,
  loadEditProfile,
  editProfile,
  loadAddAddress,
  addAddress,
  loadEditAddress,
  editAddress,
  deleteAddress,
  cart,
  addItemToCart,
}