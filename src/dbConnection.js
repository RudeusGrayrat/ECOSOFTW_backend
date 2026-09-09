const mongoose = require("mongoose");
const runDbMaintenance = require("./dbMaintenance");

const connectDB = async (req, res) => {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    await runDbMaintenance(mongoose);
  } catch (error) {
    throw new Error("Error connecting to the database: " + error.message);
  }
};
module.exports = connectDB;
