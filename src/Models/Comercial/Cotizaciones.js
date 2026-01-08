const mongoose = require("mongoose");

const comercial_cotizacionesSchema = mongoose.Schema(
  {
    correlativa: { type: Number, required: true },
    correlativaVisible: { type: String, required: true },
    proyecto_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "proyectos",
      required: true,
    },
    tipoDeServicio: { type: String, required: true },
    tiempoDeEntrega: { type: Array, required: true },
    analisis: [
      {
        parametro_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "comercial_parametros",
        },
        cantidad: { type: Number },
        subtotal: { type: Number },
      },
    ],
    gastosOperativos: [
      {
        tipoDeGasto_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "comercial_tipo_de_gastos",
        },
        cantidad: { type: Number },
        dias: { type: Number },
        subtotal: { type: Number },
      },
    ],
    gastosAdministrativos: [
      {
        tipoDeGasto_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "comercial_tipo_de_gastos",
        },
        cantidad: { type: Number },
        subtotal: { type: Number },
      },
    ],
    gastosGenerales: [
      {
        descripcion: {
          type: String,
        },
        name: { type: String },
        subtotal: { type: Number },
      },
    ],

    totalSinIgv: { type: Number },
    totalConIgv: { type: Number },
    igv: { type: Number },
    estado: {
      type: String,
      enum: ["PENDIENTE", "APROBADO", "ANULADO"],
      default: "PENDIENTE",
    },
    creadorPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserEcosoft",
      required: true,
    },
    actualizadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserEcosoft",
    },
  },
  { timestamps: true }
);

const Comercial_Cotizaciones = mongoose.model(
  "comercial_cotizaciones",
  comercial_cotizacionesSchema
);

module.exports = Comercial_Cotizaciones;
