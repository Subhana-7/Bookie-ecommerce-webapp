const User = require("../../models/userSchema");
const Wishlist = require("../../models/wishlistSchema");


const loadWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.session.user);

    const wishlistItem = await Wishlist.findOne({ userId: user._id })
      .populate({
        path: 'products.productId',
        match: { isBlocked: false, isDeleted: false },
        populate: {
          path: 'category',
          match: { isListed: true, isDeleted: false },
        },
      });

    if (!wishlistItem || !wishlistItem.products.length) {
      return res.render("wishlist", { Wishlist: [], message: "Your Wishlist is empty." });
    }

    const filteredProducts = wishlistItem.products.filter(
      item => item.productId !== null && item.productId.category !== null
    );

    if (!filteredProducts.length) {
      return res.render("wishlist", { Wishlist: [], message: "Your Wishlist is empty." });
    }

    res.render("wishlist", { Wishlist: filteredProducts, message: null });
  } catch (error) {
    res.redirect("/page-not-found");
  }
};



const addItemToWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const productId = req.body.productId;

    if (!userId) {
      return res.redirect("/login");
    }

    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      wishlist = new Wishlist({ userId, products: [{ productId }] });
    } else {
      const productExists = wishlist.products.some(item => item.productId.equals(productId));
      if (!productExists) {
        wishlist.products.push({ productId });
      }
    }

    await wishlist.save();
    res.redirect("/wishlist");
  } catch (error) {
    res.redirect("/page-not-found");
  }
};


const removeItemFromWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.session.user;

    await Wishlist.findOneAndUpdate(
      { userId: userId },
      { $pull: { products: { productId: productId } } }
    );

    res.redirect("/wishlist");
  } catch (error) {
    res.redirect("/page-not-found");
  }
}


module.exports = {
  loadWishlist,
  addItemToWishlist,
  removeItemFromWishlist
}