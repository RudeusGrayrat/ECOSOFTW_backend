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
    condicionesIngreso: { type: String, trim: true },
    trabajoAltoRiesgo: { type: String, trim: true },
    accesibilidadPuntos: { type: String, trim: true },
    estaciones: [stationSchema],
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
