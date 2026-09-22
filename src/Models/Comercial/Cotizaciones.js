const mongoose = require("mongoose");

const comercial_cotizacionesSchema = mongoose.Schema(
  {
    correlativa: { type: Number, required: true },
    correlativaVisible: { type: String, required: true },
    version: { type: Number, default: 0, required: true },
    proyecto_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "comercial_proyectos",
      required: true,
    },
    solicitud_id: { type: mongoose.Schema.Types.ObjectId, ref: "comercial_solicitudes_cotizacion" },
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
        modalidad: { type: String, enum: ["PROPIO", "TERCERIZADO"], default: "PROPIO" },
        proveedor: { type: String, trim: true },
        // Copia inmutable de la ficha usada al cotizar. Evita que un cambio o
        // desactivación posterior del catálogo altere documentos históricos.
        parametroSnapshot: {
          tipoDeAnalisis: String,
          categoria: String,
          parametro: String,
          metodo: String,
          acreditadoPor: String,
          tipoDeAcreditacion: String,
          limiteDeCuantificacionDelMetodo: String,
          limiteDeDeteccionDelMetodo: String,
          unidadDeMedida: String,
          precio: Number,
        },
      },
    ],
    gastosOperativos: [
      {
        tipoDeGasto_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "comercial_tipos_de_gastos",
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
          ref: "comercial_tipos_de_gastos",
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
    facturacion: {
      razonSocial: { type: String, trim: true },
      ruc: { type: String, trim: true },
      direccion: { type: String, trim: true },
      formaPago: { type: String, trim: true },
    },
    estado: {
      type: String,
      enum: ["PENDIENTE", "APROBADO", "ANULADO"],
      required: true,
      default: "PENDIENTE"
    },
    creadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserEcosoft",
      required: true,
    },
    actualizadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserEcosoft",
    },
    aprobadoPor: { type: mongoose.Schema.Types.ObjectId, ref: "UserEcosoft" },
    firmaAprobador: { type: String },
  },
  { timestamps: true }
);

const Comercial_Cotizaciones = mongoose.model(
  "comercial_cotizaciones",
  comercial_cotizacionesSchema
);

module.exports = Comercial_Cotizaciones;
