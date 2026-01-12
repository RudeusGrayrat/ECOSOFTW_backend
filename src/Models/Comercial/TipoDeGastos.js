const mongoose = require("mongoose");

const comercial_tipos_de_gastosSchema = mongoose.Schema(
  {
    tipoDeGasto: {
      type: String,
      required: true,
    },
    descripcion: {
      type: String,
      required: true,
    },
    precio: {
      type: Number,
      required: true,
    },
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
