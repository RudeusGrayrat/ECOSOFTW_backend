const mongoose = require("mongoose");

const comercial_ParametrosSchema = mongoose.Schema(
  {
    tipoDeAnalisis: { type: String, required: true },
    categoria: { type: String },
    parametro: { type: String, required: true },
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
    estado: { type: String, enum: ["ACTIVO", "INACTIVO"], default: "ACTIVO" },
  },
  { timestamps: true }
);

const Comercial_Parametros = mongoose.model(
  "comercial_parametros",
  comercial_ParametrosSchema
);

module.exports = Comercial_Parametros;
