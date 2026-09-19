const mongoose = require("mongoose");
const itemSchema = new mongoose.Schema({ matriz: String, parametro: String, metodologia: String, cantidad: Number, acreditacion: String, laboratorio: String }, { _id: false });
const stationSchema = new mongoose.Schema({ codigo: String, este: String, norte: String, descripcion: String }, { _id: false });
const ordenServicioSchema = new mongoose.Schema({
  plan_id: { type: mongoose.Schema.Types.ObjectId, ref: "operaciones_planes_trabajo", unique: true, required: true },
  cotizacion_id: { type: mongoose.Schema.Types.ObjectId, ref: "comercial_cotizaciones", required: true },
  correlativoPlan: { type: Number, required: true },
  codigo: { type: String, required: true, unique: true },
  // La orden es una vista operativa del plan: conserva el contexto que el laboratorio necesita.
  cliente: { razonSocial: String, ruc: String, direccion: String, contacto: String, telefono: String, correo: String },
  proyecto: { nombre: String, planta: String, lugarEjecucion: String, fechaServicio: Date },
  condicionesIngreso: String,
  trabajoAltoRiesgo: String,
  accesibilidadPuntos: String,
  estaciones: [stationSchema],
  items: [itemSchema],
  estado: { type: String, enum: ["BORRADOR", "APROBADO", "ANULADO"], default: "BORRADOR" },
  creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: "UserEcosoft" },
}, { timestamps: true });
module.exports = mongoose.model("operaciones_ordenes_servicio", ordenServicioSchema);
