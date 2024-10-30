//edit product
//delete product

const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const flash = require('express-flash');



const getAddProduct = async(req,res) => {
  try {
    category = await Category.find({isListed:true});
    res.render("addProduct",{
      cat:category
    });

  } catch (error) {
    res.redirect("pageNotFound");
  }
}


const addProduct = async(req, res) => {
  try {
    const products = req.body;
    const productExists = await Product.findOne({ productName: products.productName });
    if(!products.category) {
      return res.status(400).json({message:"Select"})
    }
    if (!productExists) {
      const images = [];
      if (req.files && req.files.length > 0) {
        for (let i = 0; i < req.files.length; i++) {
          const originalImagePath = req.files[i].path;
          console.log(req.files[i].filename);
          // Check if the original file exists
          // if (!fs.existsSync(originalImagePath)) {
          //   return res.status(400).json("Uploaded file not found");
          // }

          const resizedImagePath = path.join("public", "uploads", "product-images", req.files[i].filename);
          console.log(resizedImagePath);
          await sharp(originalImagePath).resize({ width: 440, height: 440 }).toFile(resizedImagePath);
          images.push(req.files[i].filename);
        }
      }

      const categoryId = await Category.findOne({ name: products.category });
      if (!categoryId) {
        return res.status(400).json("Invalid category name");
      }

      const newProduct = new Product({
        productName: products.productName,
        description: products.description,
        category: categoryId._id,
        publisher:products.publisher,
        author:products.author,
        regularPrice: products.regularPrice,
        salePrice: products.salePrice,
        createdOn: new Date(),
        quantity: products.quantity,
        productImage: images,
        status: "Available",
      });

      await newProduct.save();
      return res.redirect("/admin/addProduct");
    } else {
      return res.status(400).json("Product already exists, please try with another name");
    }
  } catch (error) {
    console.error("Error saving product", error);
    return res.redirect("/admin/pageNotFound");
  }
};


const getProductManagementPage = async(req, res) => {
  try {
    const search = req.query.search || "";
    const page = req.query.page || 1;
    const limit = 4;

    
    const productData = await Product.find({
      $or: [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
      ],
    }).limit(limit * 1).skip((page - 1) * limit).populate("category").exec();

    //console.log("Fetched products:", productData); // Log fetched products

    const count = await Product.find({
      $or: [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
      ],
    }).countDocuments();
    const category = await Category.find({ isListed: true });
    if (category) {
      res.render("productManagement", {
        data: productData,
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        cat: category,
      });
    } else {
      console.log("Category fetch failed.");
      res.render("pageNotFound");
    }
  } catch (error) {
    console.log("Error in getProductManagementPage:", error);
    res.redirect("pageNotFound");
  }
};



const addProductOffer = async(req, res) => {
  try {
    const { productId, percentage } = req.body;

    // Find the product
    const findProduct = await Product.findOne({ _id: productId });
    if (!findProduct) {
      return res.status(404).json({ status: false, message: "Product not found" });
    }

    // Find the category associated with the product
    const findCategory = await Category.findOne({ _id: findProduct.category });
    if (!findCategory) {
      return res.status(404).json({ status: false, message: "Category not found" });
    }

    // Check if the category already has an offer
    if (findCategory.categoryOffer > percentage) {
      return res.json({ status: false, message: "This product's category already has a category offer" });
    }

    // Calculate and set the sale price
    findProduct.salePrice = Math.floor(findProduct.regularPrice * (percentage / 100));
    findProduct.productOffer = parseInt(percentage);
    
    // Save the product and the category
    await findProduct.save();
    findCategory.categoryOffer = 0; // Reset category offer
    await findCategory.save();

    // Send successful response
    return res.json({ status: true });
  } catch (error) {
    console.error("Error in addProductOffer:", error);
    return res.status(500).json({ status: false, message: "Internal Server Error" });
  }
}



const removeProductOffer = async(req,res) => {
  try {
    const {productId} = req.body;
    const findProduct = await Product.findOne({_id:productId});
    const percentage = findProduct.productOffer;
    findProduct.salePrice = findProduct.salePrice+Math.floor(findProduct.regularPrice*(percentage/100));
    findProduct.productOffer = 0;
    await findProduct.save();
    res.json({status:true})
  } catch (error) {
    res.redirect("pageNotFound");
  }
}


const blockProduct = async(req,res) => {
  try {
    let id = req.query.id;
    await Product.updateOne({_id:id},{$set:{isBlocked:true}});
    res.redirect("/admin/productManagement")
  } catch (error) {
    res.redirect("/pageNotFound");
  }
}


const unblockProduct = async(req,res) => {
  try {
    let id = req.query.id;
    await Product.updateOne({_id:id},{$set:{isBlocked:false}});
    res.redirect("/admin/productManagement");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
}





const deleteProduct = async(req,res) => {
   try {
    const id = req.query.id;
    const findProduct = await Product.findOne({_id:id});
    await findProduct.deleteOne({_id:id});
    res.redirect("/admin/productManagement");
    req.flash('success', 'Product deleted successfully'); // Set flash message
   } catch (error) {
    console.log("product not found");
    req.flash('error', 'An error occurred while deleting the product'); // Set flash message
    res.redirect("pageNotFound");
   }

}



module.exports = {
  getProductManagementPage,
  getAddProduct,
  addProduct,
  addProductOffer,
  removeProductOffer,
  blockProduct,
  unblockProduct,
  deleteProduct
}