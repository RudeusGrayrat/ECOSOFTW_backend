const mongoose = require("mongoose");

const connectDB = async (req, res) => {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    console.log("Conectado a la base de datos");
  } catch (error) {
    throw new Error("Error connecting to the database: " + error.message);
  }
};
module.exports = connectDB;
