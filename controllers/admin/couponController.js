const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Coupon = require("../../models/couponSchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const flash = require('express-flash');


const loadCoupon = async (req, res) => {
  try {
    const coupons = await Coupon.find({isDeleted:false});
    res.render("couponManagement", { coupons });
  } catch (error) {
    return res.redirect("/pageNotFound");
  }
};

const loadCreateCoupon = async(req,res) => {
  try {
    //const coupon = await Coupon.find({});
    res.render("createCoupon")
  } catch (error) {
    res.redirect("/pageNotFound");
  }
}

const createCoupon = async(req,res) => {
  try {
    console.log("try block of createcoupon")
    const { name, expireOn, offerPrice, minimumPrice, isList } = req.body;
    console.log("after destructuring of createcoupon")
    const newCoupon = new Coupon({
      name,
      expireOn,
      offerPrice,
      minimumPrice,
      isList:isList === 'on'
    });

    await newCoupon.save();
    res.redirect("/admin/coupon-management");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
}

const loadEditCoupon = async(req,res) => {
  try {
    let id = req.params.id;
    const coupon = await Coupon.findOne({_id:id});
    res.render("edit-coupon",{coupon:coupon});
  } catch (error) {
    
  }
}

const editCoupon = async(req,res) => {
  try {
    console.log("inside try block of editcoupon")
    const id = req.params.id;
    console.log(id);
    const {expireOn, offerPrice, minimumPrice, isList } = req.body;
    console.log(expireOn,offerPrice,minimumPrice,isList);
    const updateCoupon = await Coupon.findByIdAndUpdate(id,{
      expireOn:expireOn,
      offerPrice:offerPrice,
      minimumPrice:minimumPrice,
      isList:isList === "on"
    },{new:true});

    console.log(updateCoupon);

    if(updateCoupon) {
      res.redirect("/admin/coupon-management");
    }else{
      res.status(404).json({error:"Coupon Not Found"});
    }
  } catch (error) {
    res.redirect("/pageNotFound");
  }
}

const deleteCoupon = async(req,res) =>{
  try {
    let id = req.params.id;
    await Coupon.findByIdAndUpdate(id, {
      isDeleted:true
    });
    res.redirect("/admin/coupon-management");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
}


module.exports = {
  loadCoupon,
  loadCreateCoupon,
  createCoupon,
  loadEditCoupon,
  editCoupon,
  deleteCoupon,
}