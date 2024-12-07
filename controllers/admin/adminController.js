const User = require("../../models/userSchema");
const bcrypt = require("bcrypt");

const pageError = async (req, res) => {
  res.render("pageError");
}

const loadLogin = async (req, res) => {
  if (req.session.admin) {
    return res.redirect("/admin/dashboard");
  }
  res.render("admin-login", { message: null })
}

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email, isAdmin: true });

    if (admin) {
      const passwordMatch = await bcrypt.compare(password, admin.password);

      if (passwordMatch) {
        req.session.admin = true;
        return res.redirect("/admin/dashboard");
      } else {
        return res.render("admin-login", { message: "Incorrect password" });
      }
    } else {
      return res.render("admin-login", { message: "Admin not found" });
    }
  } catch (error) {
    return res.redirect("/page-error");
  }
};


const loadDashboard = async (req, res) => {
  if (req.session.admin) {
    try {
      res.render("dashboard")
    } catch (error) {
      res.redirect("/page-error");
    }
  } else {
    res.redirect("/admin/login");
  }
}

const logout = async (req, res) => {
  try {
    req.session.destroy(err => {
      if (err) {
        return res.redirect("/page-not-found");
      }
      res.redirect("/admin/login")
    })
  } catch (error) {
    res.redirect("/page-error");
  }
}


module.exports = {
  loadLogin,
  login,
  loadDashboard,
  pageError,
  logout
}