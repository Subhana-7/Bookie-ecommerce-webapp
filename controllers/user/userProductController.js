const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const mongoose = require("mongoose");
const { console } = require("inspector");


const getProducts = async (req, res) => {
  try {
    const categories = await Category.find(); 
    const searchQuery = req.query.search || '';
    const sortOption = req.query.sort || 'default';
    const inStock = req.query.inStock === 'true';
    const categoryFilter = req.query.category || ''; 

    const filter = {};

    if (searchQuery) {
      filter.productName = new RegExp(searchQuery, 'i');
    }

    if (inStock) {
      filter.quantity = { $gt: 0 };  
    }

    if (categoryFilter) {
      const selectedCategories = categoryFilter.split(',');
      filter.category = { $in: selectedCategories }; 
    }

    console.log("Filter:", filter); 

    const sortOptions = {
      popularity: { popularity: -1 },
      priceAsc: { salePrice: 1 },
      priceDesc: { salePrice: -1 },
      averageRating: { rating: -1 },
      featured: { featured: -1 },
      newest: { createdOn: -1 },
      aToZ: { productName: 1 },
      zToA: { productName: -1 },
    };
    const sort = sortOptions[sortOption] || {};

    const products = await Product.find(filter).sort(sort).populate('category');

    res.render('products', {
      products,
      categories,
      searchQuery,
      sortOption,
      inStock,
      categoryFilter,  
    });
  } catch (error) {
    console.error("Error retrieving products:", error); 
    res.status(500).send("An error occurred while retrieving products.");
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