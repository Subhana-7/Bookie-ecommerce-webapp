const express = require("express");
const app = express();
const path = require("path");
const env = require("dotenv").config();
const session = require("express-session");
const flash = require('express-flash');
const passport = require("./config/passport");
const db = require("./config/db");
const userRouter = require("./routes/userRouter");
const adminRouter = require("./routes/adminRouter");
db();

 
app.use(express.urlencoded({extended:true})); //parse url queries
app.use(express.json()); //parse incoming requests

app.use(session({
  secret:process.env.SESSION_SECRET,
  resave:false,
  saveUninitialized:true,
  cookie:{
    secure:false,
    httpOnly:true,
    maxAge:72*60*60*1000
  }
}))

app.use(flash());
app.use((req, res, next) => {
  res.locals.messages = req.flash(); // Make flash messages available in all views
  next();
});



app.use(passport.initialize());
app.use(passport.session());


app.use((req,res,next) => {
  res.set("cache-control","no-store")
  next();
})

app.set("view engine","ejs");
app.set("views",[path.join(__dirname,"views/user"),path.join(__dirname,"views/admin")])
app.use(express.static(path.join(__dirname,"public"))); //fetch the data in the public folder


app.use("/", userRouter);
app.use("/admin",adminRouter);

PORT = 7000 || process.env.PORT
app.listen(PORT,() => {
  console.log("server running");
})

module.exports = app;