const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");

const categoryInfo = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;
    const filter = {
      isDeleted: false,
      name: { $regex: new RegExp(".*" + search + ".*", "i") },
    };

    const categoryData = await Category.find(filter)
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit);

    const totalCategories = await Category.countDocuments(filter);
    const totalPages = Math.ceil(totalCategories / limit);

    res.render("category-page", {
      cat: categoryData,
      currentPage: page,
      totalPages: totalPages,
      totalCategories: totalCategories,
    });
  } catch (error) {
    res.redirect("/pageError");
  }
};




const addCategory = async (req, res) => {
  const { name, description } = req.body;
  try {
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      return res.status(400).json({ error: "Category Already Exists" })
    }
    const newCategory = new Category({
      name,
      description,
    })
    await newCategory.save();
    return res.json({ message: "Category Added Successfully" })
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" })
  }
}


const addCategoryOffer = async (req, res) => {
  try {
    const percentage = parseInt(req.body.percentage);
    const categoryId = req.body.categoryId;

    if (isNaN(percentage) || percentage <= 0) {
      return res.status(400).json({ status: false, message: "Invalid offer percentage" });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ status: false, message: "Category not found" });
    }

    const products = await Product.find({ category: category._id });

    if (products.length === 0) {
      return res.status(404).json({ status: false, message: "No products found for the selected category" });
    }

    const hasHigherProductOffer = products.some(product => product.productOffer > percentage);
    if (hasHigherProductOffer) {
      return res.status(400).json({
        status: false,
        message: "A product in this category has a higher offer than the category offer"
      });
    }

    category.categoryOffer = percentage;
    await category.save();

    for (const product of products) {
      if (product.productOffer === 0) {
        const discountAmount = (product.regularPrice * percentage) / 100;
        product.salePrice = product.regularPrice - discountAmount;
        await product.save();
      }
    }

    res.json({ status: true, message: "Category offer applied successfully" });
  } catch (error) {
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};


const removeCategoryOffer = async (req, res) => {
  try {
    const categoryId = req.body.categoryId;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ status: false, message: "Category not found" });
    }

    const percentage = category.categoryOffer;
    const products = await Product.find({ category: category._id });

    if (products.length > 0) {
      for (const product of products) {
        if (product.productOffer === 0) {
          product.salePrice = product.regularPrice;
        } else {
          const discountAmount = (product.regularPrice * product.productOffer) / 100;
          product.salePrice = product.regularPrice - discountAmount;
        }
        await product.save();
      }
    }

    category.categoryOffer = 0;
    await category.save();

    res.json({ status: true, message: "Category offer removed successfully" });
  } catch (error) {
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};



const getListCategory = async (req, res) => {
  try {
    let id = req.query.id;
    await Category.updateOne({ _id: id }, { $set: { isListed: true } });
    res.redirect("/admin/category");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
}

const getUnlistCategory = async (req, res) => {
  try {
    let id = req.query.id;
    await Category.updateOne({ _id: id }, { $set: { isListed: false } });

    res.redirect("/admin/category");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
}


const getEditCategory = async (req, res) => {
  try {
    let id = req.query.id;
    const category = await Category.findOne({ _id: id });
    res.render("edit-category", { category: category });

  } catch (error) {
    res.redirect("/pageNotFound");
  }
}


const editCategory = async (req, res) => {
  try {
    const id = req.params.id;
    const { categoryName, description } = req.body;
    const existingCategory = await Category.findOne({ name: categoryName });

    if (existingCategory) {
      return res.status(400).json({ error: "Category exists,Please choose another name" })
    }

    const updateCategory = await Category.findByIdAndUpdate(id, {
      name: categoryName,
      description: description,
    }, { new: true });

    if (updateCategory) {
      res.redirect("/admin/category");
    } else {
      res.status(404).json({ error: "Category not found" })
    }

  } catch (error) {
    res.status(500).json({ error: "Internal Server error" });
  }
}

const deleteCategory = async (req, res) => {
  try {
    const id = req.query.id;
    await Category.findByIdAndUpdate(id, {
      isDeleted: true
    });
    res.redirect("/admin/category");
  } catch (error) {
    res.redirect("pageNotFound");
  }
}

module.exports = {
  categoryInfo,
  addCategory,
  addCategoryOffer,
  removeCategoryOffer,
  getListCategory,
  getUnlistCategory,
  getEditCategory,
  editCategory,
  deleteCategory
}