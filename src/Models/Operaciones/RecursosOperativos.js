const mongoose = require("mongoose");

const recursoOperativoSchema = new mongoose.Schema({
  codigo: { type: String, required: true, trim: true, uppercase: true, unique: true },
  nombre: { type: String, required: true, trim: true, uppercase: true },
  tipo: { type: String, enum: ["EQUIPO", "VEHICULO"], required: true },
  categoria: { type: String, trim: true, uppercase: true },
  estado: { type: String, enum: ["DISPONIBLE", "MANTENIMIENTO", "INACTIVO"], default: "DISPONIBLE" },
  observaciones: String,
}, { timestamps: true });

module.exports = mongoose.model("operaciones_recursos", recursoOperativoSchema);
