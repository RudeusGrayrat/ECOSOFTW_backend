const mongoose = require("mongoose");

const submoduleSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  module: {
    type: String,
    ref: "Module",
    required: true,
  },
  moduleId: { type: mongoose.Schema.Types.ObjectId, ref: "Module" },
  slug: { type: String },
  order: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
});

const Submodule = mongoose.model("Submodule", submoduleSchema);
module.exports = Submodule;
