const express = require("express");
const app = express();
const path = require("path");
const env = require("dotenv").config(); //here something wrong
const db = require("./config/db");
const userRouter = require("./routes/userRouter");
const adminRouter = require("./routes/adminRouter");
db();

app.use(express.json()); //parse incoming requests 
app.use(express.urlencoded({extended:true})); //parse url queries

app.set("view engine","ejs");
app.set("views",[path.join(__dirname,"views/user"),path.join(__dirname,"views/admin")])
app.use(express.static(path.join(__dirname,"public"))); //fetch the data in the public folder


app.use("/", userRouter);

PORT = 7000 || process.env.PORT
app.listen(PORT,() => {
  console.log("server running");
})

module.exports = app;