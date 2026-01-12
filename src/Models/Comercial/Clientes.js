const mongoose = require("mongoose");

const comercial_clienteSchema = mongoose.Schema(
  {
    tipoCliente: {
      type: String,
      enum: ["EMPRESA", "PERSONA"],
      required: true,
    },
    cliente: { type: String, required: true },
    numeroDocumento: { type: String, required: true },
    nombreContacto: { type: String },

    telefono: { type: String },
    correoElectronico: { type: String },

    direccionLegal: { type: String },
    estado: {
      type: String,
      enum: ["ACTIVO", "INACTIVO"],
      default: "ACTIVO"
    },
  },
  { timestamps: true }
);

const Comercial_Cliente = mongoose.model(
  "comercial_cliente",
  comercial_clienteSchema
);

module.exports = Comercial_Cliente;
