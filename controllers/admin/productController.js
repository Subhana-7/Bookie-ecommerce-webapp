
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
      return res.redirect("/admin/productManagement");
    } else {
      return res.status(400).json("Product already exists, please try with another name");
    }
  } catch (error) {
    console.error("Error saving product", error);
    return res.redirect("/admin/pageNotFound");
  }
};


const getProductManagementPage = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 6;

    // Fetch products with conditions for search and not deleted/blocked
    const productData = await Product.find({
      $and: [
        { isDeleted: false}, // Exclude deleted products
        {
          $or: [
            { productName: { $regex: new RegExp(".*" + search + ".*", "i") } }, // Search condition
          ],
        },
      ],
    })
      .limit(limit)
      .skip((page - 1) * limit)
      .populate("category")
      .exec();

    // Count documents with the same conditions
    const count = await Product.find({
      $and: [
        { isDeleted: false },
        {
          $or: [
            { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
          ],
        },
      ],
    }).countDocuments();

    // Fetch listed categories
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

    const findProduct = await Product.findOne({ _id: productId });
    if (!findProduct) {
      return res.status(404).json({ status: false, message: "Product not found" });
    }

    const findCategory = await Category.findOne({ _id: findProduct.category });
    if (!findCategory) {
      return res.status(404).json({ status: false, message: "Category not found" });
    }

    if (findCategory.categoryOffer > percentage) {
      return res.json({ status: false, message: "This product's category already has a category offer" });
    }

    findProduct.salePrice = Math.floor(findProduct.regularPrice * (percentage / 100));
    findProduct.productOffer = parseInt(percentage);
    
    await findProduct.save();
    findCategory.categoryOffer = 0; 
    await findCategory.save();

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
    await Product.findByIdAndUpdate(id, {
      isDeleted:true
    })
    res.redirect("/admin/productManagement");
    req.flash('success', 'Product deleted successfully'); 
   } catch (error) {
    console.log("product not found");
    req.flash('error', 'An error occurred while deleting the product'); 
    res.redirect("pageNotFound");
   }
}



const getEditProduct = async(req,res) => {
  console.log("inside getEditProduct block-controller")
  try {
    console.log("Inside the try block of getEditproduct");
    const id = req.query.id;
    const product = await Product.findOne({_id:id});
    const category = await Category.find({});

    res.render("edit-product",{
      product:product,
      cat:category,
    })
  } catch (error) {
    res.redirect("/pageNotFound");
  }
}

const editProduct = async(req,res) => {
  console.log("inside editProduct of controller");
  try {
    console.log("inside the try block of editProduct")
    const id = req.params.id;
    const product = await Product.findOne({_id:id});
    const data = req.body;
    const existingProduct = await Product.findOne({
      productName:data.productName,
      _id:{$ne:id}
    })

    if(existingProduct) {
      return res.status(400).json({error:"Product with this name already exists.Please try with another name"})
    }

    const images = [];

    if(req.files && req.files.length > 0) {
      for(let i = 0; i < req.files.length; i++) {
        images.push(req.files[i].filename);
      }
    }

    const updateFields = {
      productName : data.productName,
      author:data.author,
      description:data.description,
      publisher:data.publisher,
      category:data.category,
      regularPrice:data.regularPrice,
      salePrice:data.salePrice,
      quantity:data.quantity,
    }

    if(req.files.length > 0) {
      updateFields.$push = {productImage:{$each:images}};
    }

    console.log(images);

    await Product.findByIdAndUpdate(id,updateFields,{new:true});
    res.redirect("/admin/productManagement")
  } catch (error) {
    console.error(error);
    res.redirect("/pageNotFound");
  }
}

const deleteSingleImage = async (req, res) => {
  try {
      console.log("Inside the try block of deleteSingleImage");

      const { imageNameToServer, productIdToServer } = req.body;

      console.log("Image to delete:", imageNameToServer);
      console.log("Product ID:", productIdToServer);

      if (!imageNameToServer || !productIdToServer) {
          return res.status(400).json({ 
              success: false, 
              message: "Missing required parameters" 
          });
      }

      const product = await Product.findByIdAndUpdate(
          productIdToServer,
          { $pull: { productImage: imageNameToServer } },
          { new: true }
      );

      if (!product) {
          return res.status(404).json({ 
              success: false, 
              message: "Product not found" 
          });
      }

      // Define the full path to the image
      const imagePath = path.join(
          process.cwd(),
          "public",
          "uploads",
          "re-image",
          imageNameToServer
      );

      console.log("Full image path:", imagePath);

      if (fs.existsSync(imagePath)) {
          await fs.promises.unlink(imagePath);
          console.log(`Image ${imageNameToServer} deleted successfully`);
          
          res.json({ 
              success: true, 
              message: "Image deleted successfully" 
          });
      } else {
          console.log(`Image ${imageNameToServer} not found at ${imagePath}`);
          res.json({ 
              success: true, 
              message: "Image reference removed from database successfully" 
          });
      }

  } catch (error) {
      console.error("Error in deleteSingleImage:", error);
      res.status(500).json({ 
          success: false, 
          message: "Internal server error",
          error: error.message 
      });
  }
};



module.exports = {
  getProductManagementPage,
  getAddProduct,
  addProduct,
  addProductOffer,
  removeProductOffer,
  blockProduct,
  unblockProduct,
  deleteProduct,
  getEditProduct,
  editProduct,
  deleteSingleImage,
}