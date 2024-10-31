const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");



const getProducts = async (req, res) => {
  try {
      const validCategories = await Category.find({ isListed: true });
      const validCategoryIds = validCategories.map(category => category._id);

      const products = await Product.find({
         category: { $in: validCategoryIds },
         isBlocked:false
        }); 
      
      res.render('products', { products }); 
  } catch (error) {
      console.error(error);
      res.status(500).send('Server Error');
  }
};

const productDetails = async(req,res) => {
  try {
    const id = req.params.id;
    const product = await Product.findById(id).populate('category');

      const relatedProducts = await Product.find({
        category: product.category,
        _id: { $ne: id }
      }).limit(3); 

    res.render('product-details', {
       product:product,
       relatedProducts
      });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error retrieving product details");
  }
}



module.exports = {
  getProducts,
  productDetails
}