const mongoose = require("mongoose");

const versionSchema = new mongoose.Schema({
  numero: { type: Number, required: true },
  original: { path: String, filename: String, bytes: Number },
  publicado: { path: String, filename: String, bytes: Number },
  procesadoPor: { type: mongoose.Schema.Types.ObjectId, ref: "UserEcosoft" },
  creadoEn: { type: Date, default: Date.now },
  motivo: String,
}, { _id: false });

const auditSchema = new mongoose.Schema({
  accion: { type: String, required: true },
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: "UserEcosoft" },
  detalle: String,
  fecha: { type: Date, default: Date.now },
}, { _id: false });

const informeEnsayoSchema = new mongoose.Schema({
  codigo: { type: String, required: true, unique: true, uppercase: true, trim: true },
  idAcceso: { type: String, required: true, unique: true, uppercase: true, trim: true },
  proyectoId: { type: mongoose.Schema.Types.ObjectId, ref: "comercial_proyectos" },
  clienteId: { type: mongoose.Schema.Types.ObjectId, ref: "comercial_clientes" },
  tokenPublico: { type: String, required: true, unique: true, index: true },
  claveAccesoHash: { type: String, required: true },
  estado: { type: String, enum: ["DISPONIBLE", "NO DISPONIBLE"], default: "DISPONIBLE" },
  plantilla: { tipo: { type: String, default: "SIN_ACREDITACION" }, firmaUrl: String, marcaAguaUrl: String },
  versionActual: { type: Number, default: 0 },
  versiones: [versionSchema],
  auditoria: [auditSchema],
}, { timestamps: true });

module.exports = mongoose.model("operaciones_informes_ensayo", informeEnsayoSchema);
