const mongoose = require("mongoose");

const comercial_tipos_de_gastosSchema = mongoose.Schema(
  {
    tipoDeGasto: {
      type: String,
      required: true,
    },
    // Identificador estable para reglas de negocio (p. ej. calculadora logística).
    // El texto visible puede editarse sin romper las referencias técnicas.
    codigo: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true,
    },
    // Define en qué bloque de la cotización puede usarse el concepto.
    // SIN_CLASIFICAR preserva registros históricos hasta que Comercial los clasifique.
    categoria: {
      type: String,
      enum: ["OPERATIVO", "ADMINISTRATIVO", "SIN_CLASIFICAR"],
      default: "SIN_CLASIFICAR",
      required: true,
      index: true,
    },
    descripcion: {
      type: String,
      required: true,
    },
    precio: {
      type: Number,
      required: true,
    },
    origen: {
      type: String,
      enum: ["MANUAL", "CALCULADORA_LOGISTICA"],
      default: "MANUAL",
      required: true,
    },
    unidadReferencia: {
      type: String,
      enum: ["FIJO", "POR_UNIDAD", "POR_DIA", "POR_PERSONA_DIA", "POR_KM", "POR_GALON"],
      default: "FIJO",
      required: true,
    },
    vigenciaDesde: { type: Date, default: Date.now },
    vigenciaHasta: { type: Date },
    estado: {
      type: String,
      enum: ["ACTIVO", "INACTIVO"],
      default: "ACTIVO",
      required: true,
    },
  },
  { timestamps: true }
);

const Comercial_TiposDeGastos = mongoose.model(
  "comercial_tipos_de_gastos",
  comercial_tipos_de_gastosSchema
);
module.exports = Comercial_TiposDeGastos;
