const User = require("../../models/userSchema");

const userInfo = async (req, res) => {
  try {
    let search = "";
    if (req.query.search) {
      search = req.query.search;  // Fixed typo: `search` instead of `searAch`
    }

    let page = 1;
    if (req.query.page) {
      page = req.query.page;
    }

    const limit = 5;
    // Fetch user data with search query and pagination
    const userData = await User.find({
      isAdmin: false,  // Only fetch regular users, not admins
      $or: [
        { name: { $regex: ".*" + search + ".*", $options: 'i' } },  // Case-insensitive search
        { email: { $regex: ".*" + search + ".*", $options: 'i' } }
      ],
    })
      .limit(limit * 1)  // Limit the number of results per page
      .skip((page - 1) * limit)  // Skip results according to the page number
      .exec();

    // Get the total number of users for pagination
    const count = await User.find({
      isAdmin: false,
      $or: [
        { name: { $regex: ".*" + search + ".*", $options: 'i' } },
        { email: { $regex: ".*" + search + ".*", $options: 'i' } },
      ],
    }).countDocuments();

    // Render the userManagement view and pass required data
    res.render("userManagement", {
      data: userData,        // Pass the fetched user data
      totalPages: Math.ceil(count / limit),  // Calculate total pages
      currentPage: parseInt(page),  // Current page
      search: search         // The current search query (if any)
    });

  } catch (error) {
    console.log("Error in user management page", error);
    res.redirect("/pageError");  // Redirect to error page in case of any issues
  }
};


const userBlocked = async(req,res) => {
  try {
    let id = req.query.id;
    console.log("Blocking user ID: ", id);
    const result  = await User.updateOne({_id:id},{$set:{isBlocked:true}});
    console.log("Update result:", result);
    res.redirect("/admin/users?status=blocked");
  } catch (error) {
    res.redirect("/pageError",error);
  }
};

const userUnBlocked = async(req,res) => {
  try {
    let id = req.query.id;
    console.log("unBlocking user ID: ", id)
    const result = await User.updateOne({_id:id},{$set:{isBlocked:false}});
    console.log("Update result:", result);
    res.redirect("/admin/users?status=unblocked");
  } catch (error) {
    res.redirect("/pageError",error);
  }
}

module.exports = {
  userInfo,
  userBlocked,
  userUnBlocked
};
