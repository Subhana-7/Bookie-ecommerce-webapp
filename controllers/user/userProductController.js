const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");


const getProducts = async (req, res) => {
  try {
      const products = await Product.find(); 
      res.render('products',{products}); 
  } catch (error) {
      console.error(error);
      res.status(500).send('Server Error');
  }
};



module.exports = {
  getProducts
}