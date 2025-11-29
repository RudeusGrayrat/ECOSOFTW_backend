const mongoose = require("mongoose");

const comercial_clienteSchema = mongoose.Schema(
  {
    tipoCliente: {
      type: String,
      enum: ["EMPRESA", "PERSONA"],
      required: true,
    },
    rucEmpresa: { type: String },
    razonSocial: { type: String },
    contacto: { type: String },

    dniCliente: { type: String },
    nombreCliente: { type: String },

    telefono: { type: String },
    correo: { type: String },

    direccionLegal: { type: String },
  },
  { timestamps: true }
);

const Comercial_Cliente = mongoose.model(
  "comercial_cliente",
  comercial_clienteSchema
);

module.exports = Comercial_Cliente;
