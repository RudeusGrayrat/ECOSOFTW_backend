const mongoose = require("mongoose");

const versionSchema = new mongoose.Schema({
  numero: { type: Number, required: true },
  tipo: { type: String, enum: ["BORRADOR", "PRELIMINAR", "OFICIAL"], default: "BORRADOR" },
  original: { path: String, filename: String, bytes: Number },
  publicado: { path: String, filename: String, bytes: Number },
  procesadoPor: { type: mongoose.Schema.Types.ObjectId, ref: "UserEcosoft" },
  creadoEn: { type: Date, default: Date.now },
}, { _id: false });

const auditSchema = new mongoose.Schema({
  accion: { type: String, required: true },
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: "UserEcosoft" },
  detalle: String,
  fecha: { type: Date, default: Date.now },
}, { _id: false });

const migracionSchema = new mongoose.Schema({
  origen: String,
  legacyId: String,
  codigoLegacy: String,
  llaveLegacy: String,
  archivoLegacy: String,
  fechaOperacion: Date,
  registrado: String,
  fechaRegistro: Date,
  modificado: String,
  fechaModificacion: Date,
  estadoLegacy: String,
  eliminacionLogica: String,
}, { _id: false });

const informeEnsayoSchema = new mongoose.Schema({
  codigo: { type: String, required: true, unique: true, uppercase: true, trim: true },
  planMonitoreo: { type: String, uppercase: true, trim: true },
  cliente: { type: String, uppercase: true, trim: true },
  matriz: { type: String, uppercase: true, trim: true },
  acreditacion: { type: String, enum: ["INACAL", "NAC", "SIN_ACREDITACION"], default: "SIN_ACREDITACION" },
  idAcceso: { type: String, required: true, uppercase: true, trim: true },
  proyectoId: { type: mongoose.Schema.Types.ObjectId, ref: "comercial_proyectos" },
  clienteId: { type: mongoose.Schema.Types.ObjectId, ref: "comercial_clientes" },
  tokenPublico: { type: String, required: true, unique: true, index: true },
  claveAccesoHash: { type: String, required: true },
  estado: { type: String, enum: ["BORRADOR", "PRELIMINAR", "LIBERADO", "DISPONIBLE", "NO DISPONIBLE", "ANULADO"], default: "BORRADOR" },
  tipoVersion: { type: String, enum: ["BORRADOR", "PRELIMINAR", "OFICIAL"], default: "BORRADOR" },
  vistoBuenoJefatura: { type: Boolean, default: false },
  papelera: { type: Boolean, default: false },
  eliminadoEn: Date,
  eliminadoPor: { type: mongoose.Schema.Types.ObjectId, ref: "UserEcosoft" },
  plantilla: { tipo: { type: String, default: "SIN_ACREDITACION" }, firmaUrl: String, marcaAguaUrl: String },
  versionActual: { type: Number, default: 0 },
  versiones: [versionSchema],
  auditoria: [auditSchema],
  migracion: migracionSchema,
}, { timestamps: true });

module.exports = mongoose.model("calidad_informes_ensayo", informeEnsayoSchema, "operaciones_informes_ensayos");
