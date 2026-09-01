const mongoose = require("mongoose");

const moduleSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    slug: { type: String, unique: true, sparse: true },
    icon: { type: String, default: "" },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Module = mongoose.model("Module", moduleSchema);
module.exports = Module;
