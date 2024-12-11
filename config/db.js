const mongoose = require("mongoose");
const env = require("dotenv").config();


const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Database connected successfully");
  } catch (error) {
    console.error("Database connection error:");
    process.exit(1);
  }
};

module.exports = connectDB;

