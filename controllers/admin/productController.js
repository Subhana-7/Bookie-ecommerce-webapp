const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");



const getAddProduct = async (req, res) => {
  try {
    category = await Category.find({ isListed: true });
    res.render("addProduct", {
      cat: category
    });

  } catch (error) {
    res.redirect("page-not-found");
  }
}


const addProduct = async (req, res) => {
  try {
    const products = req.body;

    const productExists = await Product.findOne({ productName: products.productName });
    if (!products.category) {
      return res.status(400).json({ message: "Please select a category." });
    }

    if (!productExists) {
      const images = [];
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const originalImagePath = file.path;
          const resizedImagePath = path.join(
            "public",
            "uploads",
            "product-images",
            `resized-${file.filename}`
          );

          await sharp(originalImagePath)
            .resize({ width: 440, height: 440 })
            .toFile(resizedImagePath);

          images.push(`resized-${file.filename}`);
        }
      }

      const categoryId = await Category.findOne({ name: products.category });
      if (!categoryId) {
        return res.status(400).json({ message: "Invalid category name." });
      }

      const regularPrice = parseFloat(products.regularPrice);
      const newProduct = new Product({
        productName: products.productName,
        description: products.description,
        category: categoryId._id,
        publisher: products.publisher,
        author: products.author,
        regularPrice: regularPrice,
        salePrice: regularPrice,
        createdOn: new Date(),
        quantity: products.quantity,
        productImage: images,
        status: "Available",
      });

      await newProduct.save();
      return res.redirect("/admin/productManagement");
    } else {
      return res.status(400).json({ message: "Product already exists, please try with another name." });
    }
  } catch (error) {
    return res.redirect("/admin/page-not-found");
  }
};




const getProductManagementPage = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 6;

    const productData = await Product.find({
      $and: [
        { isDeleted: false },
        {
          $or: [
            { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
          ],
        },
      ],
    })
      .limit(limit)
      .skip((page - 1) * limit)
      .populate("category")
      .exec();

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

    const category = await Category.find({ isListed: true });

    if (category) {
      res.render("productManagement", {
        data: productData,
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        cat: category,
      });
    } else {
      res.render("page-not-found");
    }
  } catch (error) {
    res.redirect("page-not-found");
  }
};



const addProductOffer = async (req, res) => {
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
      return res.json({ status: false, message: "This product's category already has a higher category offer." });
    }

    const discountAmount = (findProduct.regularPrice * percentage) / 100;
    findProduct.salePrice = findProduct.regularPrice - discountAmount;
    findProduct.productOffer = parseInt(percentage);

    await findProduct.save();

    findCategory.categoryOffer = 0;
    await findCategory.save();

    return res.json({ status: true });
  } catch (error) {
    return res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};




const removeProductOffer = async (req, res) => {
  try {
    const { productId } = req.body;

    const findProduct = await Product.findOne({ _id: productId });
    if (!findProduct) {
      return res.status(404).json({ message: "Product not found." });
    }

    findProduct.salePrice = findProduct.regularPrice;
    findProduct.productOffer = 0;

    await findProduct.save();
    res.json({ status: true });
  } catch (error) {
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};



const blockProduct = async (req, res) => {
  try {
    let id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.redirect("/admin/productManagement")
  } catch (error) {
    res.redirect("/page-not-found");
  }
}


const unblockProduct = async (req, res) => {
  try {
    let id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.redirect("/admin/productManagement");
  } catch (error) {
    res.redirect("/page-not-found");
  }
}





const deleteProduct = async (req, res) => {
  try {
    const id = req.query.id;
    await Product.findByIdAndUpdate(id, {
      isDeleted: true
    })
    res.redirect("/admin/productManagement");
    req.flash('success', 'Product deleted successfully');
  } catch (error) {
    req.flash('error', 'An error occurred while deleting the product');
    res.redirect("/page-not-found");
  }
}



const getEditProduct = async (req, res) => {
  try {
    const id = req.query.id;
    const product = await Product.findOne({ _id: id });
    const category = await Category.find({});

    res.render("edit-product", {
      product: product,
      cat: category,
    })
  } catch (error) {
    res.redirect("/page-not-found");
  }
}

const editProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const product = await Product.findById(id).populate('category');
    const data = req.body;

    const existingProduct = await Product.findOne({
      productName: data.productName,
      _id: { $ne: id },
    });

    if (existingProduct) {
      return res.status(400).json({ error: "Product with this name already exists. Please try another name." });
    }

    const images = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const originalImagePath = file.path;
        const resizedImagePath = path.join(
          "public",
          "uploads",
          "product-images",
          `resized-${file.filename}`
        );

        await sharp(originalImagePath)
          .resize({ width: 440, height: 440 })
          .toFile(resizedImagePath);

        images.push(`resized-${file.filename}`);
      }
    }

    const updatedImages = [...product.productImage, ...images];

    const updateFields = {
      productName: data.productName || product.productName,
      description: data.description || product.description,
      author: data.author || product.author,
      publisher: data.publisher || product.publisher,
      category: data.cat || product.category,
      regularPrice: data.regularPrice || product.regularPrice,
      salePrice: data.regularPrice || product.regularPrice,
      quantity: data.quantity || product.quantity,
      productImage: updatedImages,
    };

    const updatedProduct = await Product.findByIdAndUpdate(id, updateFields, { new: true });

    res.redirect("/admin/productManagement");
  } catch (error) {
    res.redirect("/page-not-found");
  }
};



const deleteSingleImage = async (req, res) => {
  try {

    const { imageNameToServer, productIdToServer } = req.body;


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

    const imagePath = path.join(
      process.cwd(),
      "public",
      "uploads",
      "product-images",
      imageNameToServer
    );


    if (fs.existsSync(imagePath)) {
      await fs.promises.unlink(imagePath);

      res.json({
        success: true,
        message: "Image deleted successfully"
      });
    } else {
      res.json({
        success: true,
        message: "Image reference removed from database successfully"
      });
    }

  } catch (error) {
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