const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const mongoose = require("mongoose");



const getProducts = async (req, res) => {
  try {
      const searchQuery = req.query.search || '';
      const sortOption = req.query.sort || 'default';
      const inStock = req.query.inStock === 'true'; // Check if in-stock filter is applied

      const validCategories = await Category.find({ isListed: true });
      const validCategoryIds = validCategories.map(category => category._id);

      const query = {
          category: { $in: validCategoryIds },
          isBlocked: false,
          productName: { $regex: searchQuery, $options: 'i' },
      };

      // Apply in-stock filter if checked
      if (inStock) {
          query.quantity = { $gt: 0 }; // Only show products with quantity > 0
      }

      let sortCriteria = {};

      switch (sortOption) {
          case 'popularity':
              sortCriteria = { popularity: -1 };
              break;
          case 'priceAsc':
              sortCriteria = { salePrice: 1 };
              break;
          case 'priceDesc':
              sortCriteria = { salePrice: -1 };
              break;
          case 'averageRating':
              sortCriteria = { averageRating: -1 };
              break;
          case 'featured':
              sortCriteria = { featured: -1 };
              break;
          case 'newest':
              sortCriteria = { createdOn: -1 };
              break;
          case 'aToZ':
              sortCriteria = { productName: 1 };
              break;
          case 'zToA':
              sortCriteria = { productName: -1 };
              break;
          default:
              break;
      }

      const products = await Product.find(query).sort(sortCriteria);
      res.render('products', { products });
  } catch (error) {
      console.error(error);
      res.status(500).send('Server Error');
  }
};



const productDetails = async(req,res) => {
  try {
    const id = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send("Invalid product ID");
    }

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