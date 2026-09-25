const mongoose = require("mongoose");

const comercial_proyectosSchema = mongoose.Schema(
  {
    cliente_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "comercial_clientes",
      required: true,
    },
    nombre: { type: String, required: true },
    servicio: { type: String, required: true },
    fechaServicio: { type: String },
    // El cliente puede indicar una combinación de cantidad y parámetros
    // (por ejemplo: "3 puntos, PM10 y PM2.5"). No debe convertirse a número.
    cantidadPuntosParametros: { type: String, trim: true },
    lugarMuestreo: { type: String },
    estado: { type: String, enum: ["ACTIVO", "INACTIVO","COTIZADO", "PENDIENTE"], default: "PENDIENTE" , required: true},
  },
  { timestamps: true }
);

const Comercial_Proyectos = mongoose.model(
  "comercial_proyectos",
  comercial_proyectosSchema
);

module.exports = Comercial_Proyectos;
