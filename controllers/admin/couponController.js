const Coupon = require("../../models/couponSchema");


const loadCoupon = async (req, res) => {
  try {
    const coupons = await Coupon.find({ isDeleted: false });
    res.render("couponManagement", { coupons });
  } catch (error) {
    return res.redirect("/page-not-found");
  }
};

const loadCreateCoupon = async (req, res) => {
  try {
    res.render("createCoupon")
  } catch (error) {
    res.redirect("/page-not-found");
  }
}

const createCoupon = async (req, res) => {
  try {
    const { name, expireOn, offerPrice, minimumPrice, isList } = req.body;
    const newCoupon = new Coupon({
      name,
      expireOn,
      offerPrice,
      minimumPrice,
      isList: isList === 'on'
    });

    await newCoupon.save();
    res.redirect("/admin/coupon-management");
  } catch (error) {
    res.redirect("/page-not-found");
  }
}

const loadEditCoupon = async (req, res) => {
  try {
    let id = req.params.id;
    const coupon = await Coupon.findOne({ _id: id });
    res.render("edit-coupon", { coupon: coupon });
  } catch (error) {
    res.redirect("page-not-found");
  }
}

const editCoupon = async (req, res) => {
  try {
    const id = req.params.id;
    const { expireOn, offerPrice, minimumPrice, isList } = req.body;
    const updateCoupon = await Coupon.findByIdAndUpdate(id, {
      expireOn: expireOn,
      offerPrice: offerPrice,
      minimumPrice: minimumPrice,
      isList: isList === "on"
    }, { new: true });


    if (updateCoupon) {
      res.redirect("/admin/coupon-management");
    } else {
      res.status(404).json({ error: "Coupon Not Found" });
    }
  } catch (error) {
    res.redirect("/page-not-found");
  }
}

const deleteCoupon = async (req, res) => {
  try {
    let id = req.params.id;
    await Coupon.findByIdAndUpdate(id, {
      isDeleted: true
    });
    res.redirect("/admin/coupon-management");
  } catch (error) {
    res.redirect("/page-not-found");
  }
}


module.exports = {
  loadCoupon,
  loadCreateCoupon,
  createCoupon,
  loadEditCoupon,
  editCoupon,
  deleteCoupon,
}