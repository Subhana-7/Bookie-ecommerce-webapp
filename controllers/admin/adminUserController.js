const User = require("../../models/userSchema");

const userInfo = async (req, res) => {
  try {
    let search = "";
    if (req.query.search) {
      search = req.query.search;
    }

    let page = 1;
    if (req.query.page) {
      page = req.query.page;
    }

    const limit = 5;
    const userData = await User.find({
      isAdmin: false,
      $or: [
        { name: { $regex: ".*" + search + ".*", $options: 'i' } },
        { email: { $regex: ".*" + search + ".*", $options: 'i' } }
      ],
    })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();


    const count = await User.find({
      isAdmin: false,
      $or: [
        { name: { $regex: ".*" + search + ".*", $options: 'i' } },
        { email: { $regex: ".*" + search + ".*", $options: 'i' } },
      ],
    }).countDocuments();


    res.render("userManagement", {
      data: userData,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      search: search
    });

  } catch (error) {
    res.redirect("/pageError");
  }
};


const userBlocked = async (req, res) => {
  try {
    let id = req.query.id;
    await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.redirect("/admin/users?status=blocked");
  } catch (error) {
    res.redirect("/pageError", error);
  }
};

const userUnBlocked = async (req, res) => {
  try {
    let id = req.query.id;
    await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.redirect("/admin/users?status=unblocked");
  } catch (error) {
    res.redirect("/pageError", error);
  }
}

module.exports = {
  userInfo,
  userBlocked,
  userUnBlocked
};
