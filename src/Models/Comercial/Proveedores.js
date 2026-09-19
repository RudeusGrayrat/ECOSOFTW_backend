const mongoose = require("mongoose");
const schema = new mongoose.Schema({ nombre: { type: String, required: true, trim: true, uppercase: true, unique: true }, estado: { type: String, enum: ["ACTIVO", "INACTIVO"], default: "ACTIVO" } }, { timestamps: true });
module.exports = mongoose.model("comercial_proveedores", schema);
