const mongoose = require("mongoose");

const assetSchema = new mongoose.Schema({
  path: String,
  filename: String,
  mimetype: String,
  bytes: Number,
  updatedAt: Date,
}, { _id: false });

const informeEnsayoConfigSchema = new mongoose.Schema({
  key: { type: String, default: "default", unique: true },
  firma: assetSchema,
  marcasAgua: {
    INACAL: assetSchema,
    NAC: assetSchema,
    SIN_ACREDITACION: assetSchema,
    default: {},
  },
}, { timestamps: true });

module.exports = mongoose.model("operaciones_informes_ensayo_config", informeEnsayoConfigSchema);
