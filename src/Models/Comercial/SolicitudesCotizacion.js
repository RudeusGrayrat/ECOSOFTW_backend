const mongoose = require("mongoose");

const stationSchema = new mongoose.Schema(
  {
    codigo: { type: String, trim: true },
    este: { type: String, trim: true },
    norte: { type: String, trim: true },
    descripcion: { type: String, trim: true },
  },
  { _id: false }
);

const parameterRequestSchema = new mongoose.Schema(
  {
    parametro_id: { type: mongoose.Schema.Types.ObjectId, ref: "comercial_parametros" },
    cantidadPuntos: { type: Number, min: 1, default: 1 },
  },
  { _id: false }
);

const attachmentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    nombre: { type: String, required: true },
    archivo: { type: String, required: true },
    mimetype: { type: String },
    bytes: { type: Number },
  },
  { _id: false }
);

const comercialSolicitudCotizacionSchema = new mongoose.Schema(
  {
    cliente_id: { type: mongoose.Schema.Types.ObjectId, ref: "comercial_clientes", required: true },
    proyecto_id: { type: mongoose.Schema.Types.ObjectId, ref: "comercial_proyectos", required: true },
    servicios: [{ type: String, trim: true }],
    frecuenciaAire: { type: String, trim: true },
    cantidadPuntosParametros: { type: String, trim: true },
    metodologiaParametros: { type: String, trim: true },
    fechaServicio: { type: Date },
    tipoDocumento: [{ type: String, trim: true }],
    nombrePlanta: { type: String, trim: true },
    lugarEjecucion: { type: String, trim: true },
    ubicacion: {
      departamento: { type: String, trim: true },
      provincia: { type: String, trim: true },
      distrito: { type: String, trim: true },
      referencia: { type: String, trim: true },
    },
    parametrosSolicitados: [parameterRequestSchema],
    requisitosIngreso: [{ type: String, trim: true }],
    induccionHoras: { type: Number, min: 0 },
    peligrosEspecificos: [{ type: String, trim: true }],
    zonaUtm: { type: String, trim: true },
    datum: { type: String, trim: true },
    condicionesIngreso: { type: String, trim: true },
    trabajoAltoRiesgo: { type: String, trim: true },
    accesibilidadPuntos: { type: String, trim: true },
    estaciones: [stationSchema],
    adjuntos: [attachmentSchema],
    destinatarioInforme: {
      razonSocial: { type: String, trim: true },
      ruc: { type: String, trim: true },
    },
    contacto: {
      nombreCompleto: { type: String, trim: true },
      cargo: { type: String, trim: true },
      telefono: { type: String, trim: true },
      correo: { type: String, trim: true, lowercase: true },
    },
    estado: {
      type: String,
      enum: ["RECIBIDA", "EN_REVISION", "COTIZADA", "DESCARTADA"],
      default: "RECIBIDA",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("comercial_solicitudes_cotizacion", comercialSolicitudCotizacionSchema);
