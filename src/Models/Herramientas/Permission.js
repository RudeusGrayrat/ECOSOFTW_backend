const mongoose = require("mongoose");

const permissionsSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    description: { type: String, default: "" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Permissions = mongoose.model("Permissions", permissionsSchema);
module.exports = Permissions;
