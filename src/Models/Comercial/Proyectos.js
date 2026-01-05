const mongoose = require("mongoose");

const comercial_proyectosSchema = mongoose.Schema(
  {
    cliente_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "comercial_cliente",
      required: true,
    },
    nombre: { type: String, required: true },
    servicio: { type: String, required: true },
    fechaServicio: { type: String },
    cantidadPuntosParametros: { type: Number },
    lugarMuestreo: { type: String },
    estado: { type: String, enum: ["ACTIVO", "INACTIVO"], default: "ACTIVO" },
  },
  { timestamps: true }
);

const Comercial_Proyectos = mongoose.model(
  "comercial_proyectos",
  comercial_proyectosSchema
);

module.exports = Comercial_Proyectos;
