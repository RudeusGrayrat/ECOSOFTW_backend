const mongoose = require("mongoose");

const plantillaDocumentalSchema = new mongoose.Schema({
  tipo: { type: String, enum: ["COTIZACION", "PLAN_TRABAJO", "ORDEN_INTERNA"], required: true, unique: true },
  nombre: { type: String, required: true, trim: true },
  version: { type: String, required: true, trim: true },
  vigenciaDesde: { type: Date },
  estado: { type: String, enum: ["ACTIVA", "INACTIVA"], default: "ACTIVA" },
  archivo: { type: String, required: true },
  nombreOriginal: { type: String, required: true },
  actualizadoPor: { type: mongoose.Schema.Types.ObjectId, ref: "UserEcosoft" },
}, { timestamps: true });

module.exports = mongoose.model("herramientas_plantillas_documentales", plantillaDocumentalSchema);
