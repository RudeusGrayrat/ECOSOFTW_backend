const mongoose = require("mongoose");

const comercial_ParametrosSchema = mongoose.Schema(
  {
    tipoDeAnalisis: { type: String, required: true },
    categoria: { type: String },
    // Nombre breve y legible para listas, selectores y documentos comerciales.
    // `parametro` conserva la denominación o alcance técnico completo vigente.
    nombreCorto: { type: String, trim: true },
    parametro: { type: String, required: true },
    // Componentes incluidos por un ensayo agrupado; no crea tarifas separadas.
    componentes: [{ type: String, trim: true }],
    // Define si se cotiza un analito, un conjunto tarifado o una medición de campo.
    tipoItem: {
      type: String,
      enum: ["INDIVIDUAL", "PAQUETE", "CAMPO"],
      default: "INDIVIDUAL",
    },
    // La cantidad de una cotización sólo tiene sentido junto con su unidad.
    unidadCobro: {
      type: String,
      enum: ["POR_UNIDAD", "POR_PUNTO", "POR_MUESTRA", "POR_DIA", "POR_CAMPANA", "POR_EQUIPO"],
      default: "POR_UNIDAD",
    },
    metodo: { type: String, required: true },
    acreditadoPor: { type: String, default: "-" },
    tipoDeAcreditacion: { type: String, default: "-" },
    limiteDeCuantificacionDelMetodo: {
      type: String,
      default: "-",
    },
    limiteDeDeteccionDelMetodo: { type: String, default: "-" },
    unidadDeMedida: { type: String },
    precio: { type: Number },
    vigenciaDesde: { type: Date, default: Date.now },
    vigenciaHasta: { type: Date },
    estado: { type: String, enum: ["ACTIVO", "INACTIVO"], default: "ACTIVO" },
  },
  { timestamps: true }
);

const Comercial_Parametros = mongoose.model(
  "comercial_parametros",
  comercial_ParametrosSchema
);

module.exports = Comercial_Parametros;
