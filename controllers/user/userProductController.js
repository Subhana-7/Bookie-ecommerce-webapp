const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const mongoose = require("mongoose");
const { console } = require("inspector");


/*const getProducts = async (req, res) => {
  try {

      const searchQuery = req.query.search || '';
      const sortOption = req.query.sort || 'default';
      const inStock = req.query.inStock === 'true'; 

      const validCategories = await Category.find({ isListed: true });
      const validCategoryIds = validCategories.map(category => category._id);

      const query = {
          category: { $in: validCategoryIds },
          isBlocked: false,
          productName: { $regex: searchQuery, $options: 'i' },
      };

      if (inStock) {
          query.quantity = { $gt: 0 }; 
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
      res.render('products', { products ,searchQuery});
  } catch (error) {
      console.error(error);
      res.status(500).send('Server Error');
  }
};*/



/*const getProducts = async (req, res) => {
  try {
    const categories = await Category.find();

    const searchQuery = req.query.search || '';
    const sortOption = req.query.sort || 'default';
    const inStock = req.query.inStock === 'true';
    const categoryFilter = req.query.category || '';  

    const filter = {};
    if (searchQuery) filter.productName = new RegExp(searchQuery, 'i');
    if (inStock) filter.quantity = { $gt: 0 };
    //if (categoryFilter) filter.category = categoryFilter;

    if (categoryFilter) {
      const selectedCategories = categoryFilter.split(',');
      filter.category = { $in: selectedCategories };
    }


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

    const products = await Product.find(filter).sort(sort);

    res.render('products', {
      products,
      categories,
      searchQuery,
      sortOption,
      inStock,
      categoryFilter,  
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while retrieving products.");
  }
};
*/

const getProducts = async (req, res) => {
  try {
    const categories = await Category.find(); // Assuming Category model is set up
    const searchQuery = req.query.search || '';
    const sortOption = req.query.sort || 'default';
    const inStock = req.query.inStock === 'true';
    const categoryFilter = req.query.category || ''; // Get the selected categories from the query

    const filter = {};

    // Handle search query
    if (searchQuery) {
      filter.productName = new RegExp(searchQuery, 'i');
    }

    // Handle in-stock filter
    if (inStock) {
      filter.quantity = { $gt: 0 };  // Only show products that are in stock
    }

    // Handle category filter (check if categoryFilter exists and process it)
    if (categoryFilter) {
      const selectedCategories = categoryFilter.split(',');
      filter.category = { $in: selectedCategories };  // Use ObjectId matching with $in
    }

    console.log("Filter:", filter); // Log filter to debug

    // Sorting logic
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

    // Find products with the filter and sort options
    const products = await Product.find(filter).sort(sort);

    res.render('products', {
      products,
      categories,
      searchQuery,
      sortOption,
      inStock,
      categoryFilter,  // Pass categoryFilter to the view to retain selected categories
    });
  } catch (error) {
    console.error("Error retrieving products:", error); // Log the error to identify issues
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