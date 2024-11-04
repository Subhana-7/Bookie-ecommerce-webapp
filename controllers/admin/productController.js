
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


const getProductManagementPage = async(req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 10;

    
    const productData = await Product.find({
      $or: [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
      ],
    }).limit(limit * 1).skip((page - 1) * limit).populate("category").exec();

    //console.log("Fetched products:", productData); 

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
    const findProduct = await Product.findOne({_id:id});
    await findProduct.deleteOne({_id:id});
    res.redirect("/admin/productManagement");
    req.flash('success', 'Product deleted successfully'); 
   } catch (error) {
    console.log("product not found");
    req.flash('error', 'An error occurred while deleting the product'); 
    res.redirect("pageNotFound");
   }

}

const getEditProduct = async(req,res) => {
  try {
    const id = req.query.id;
     const product = await Product.findOne({_id:id});
     const category = await Category.find({});
    res.render("edit-product",{
      product:product,
      cat:category
    });
  } catch (error) {
    res.redirect("pageNotFound");
  }
}

const editProduct = async (req, res) => {
  try {
    const id = req.params.id;
    console.log(id);
    const product  = await  Product.findById(id).populate('category');
    const data = req.body;
    const existingProduct = await Product.findOne({
      productName: data.productName,
      _id: { $ne: id },
    });
    console.log(existingProduct);
    console.log(product);

    if (existingProduct) {
      return res.status(400).json({ error:"Product with this name already exists. Please try another name."});
    }
    
   var images = [];

    // Handle file uploads
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const originalImagePath = req.files[i].path;
        console.log(`Original filename: ${req.files[i].filename}`);

        const resizedImagePath = path.join("public", "uploads", "product-images", req.files[i].filename);
    
                // Resize the image
                await sharp(originalImagePath)
                .resize({ width: 440, height: 440 })
                .toFile(resizedImagePath);
      
              images.push(req.files[i].filename);
            }
          }
      
      

          const updateFields = {
            productName: data.productName || product.productName,
            description: data.description || product.description,
            author: data.author || product.author,
            publisher: data.publisher || product.publisher,
            category: data.cat || product.category,
            regularPrice: data.regularPrice || product.regularPrice,
            salePrice: data.salePrice || product.salePrice,
            quantity: data.quantity || product.quantity,
          };
          
    console.log("Update fields:", updateFields);

    if (images.length > 0) {
      updateFields.image = { $push: { $each: images } };
    }
    
  
    const updatedProducts = await Product.findByIdAndUpdate(id, updateFields, { new: true });
    
    console.log("updated successfully");
    console.log(updatedProducts);
  
    res.redirect("/admin/productManagement");

  } catch (error) {
    console.error(error);
    res.redirect("/pageNotFound");
  }
}

const deleteSingleImage = async(req,res) => {
  try {
    const {imageNameToServer,productIdToServer} = req.body;
    const product = await Product.findByIdAndUpdate(productIdToServer,{$pull:{productImage:imageNameToServer}});
    const imagePath = path.join("public","uploads","product-images",imageNameToServer);
    if(fs.existsSync(imagePath)) {
      await fs.unlinkSync(imagePath);
      console.log(`image ${imageNameToServer} deleted successfully`);
    }else {
      console.log(`image ${imageNameToServer} not found`);
    }

    res.send({status:true});
  } catch (error) {
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
  deleteProduct,
  getEditProduct,
  editProduct,
  deleteSingleImage
}