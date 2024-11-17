const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Wallet = require("../../models/walletSchema");
const mongoose = require("mongoose");


const loadWallet = async(req,res) => {
  try {
    const userId = req.session.user;
    const wallet = await Wallet.findOne({userId}).populate('userId','name email');

    if (!wallet) {
      await Wallet.create({ userId, transactions: [] });
      return res.redirect('/wallet');
    }

    res.render("wallet",{wallet});
  } catch (error) {
    res.redirect("/pageNotFound");
  }
}


module.exports = {
  loadWallet,
}