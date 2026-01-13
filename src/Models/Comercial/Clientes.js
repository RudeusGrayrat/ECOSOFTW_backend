const mongoose = require("mongoose");

const comercial_clientesSchema = mongoose.Schema(
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
        estado: {
            type: String,
            enum: ["ACTIVO", "INACTIVO"],
            default: "ACTIVO",
            required: true,
        },

        direccionLegal: { type: String },
    },
    { timestamps: true }
);

const Comercial_Clientes = mongoose.model(
    "comercial_clientes",
    comercial_clientesSchema
);

module.exports = Comercial_Clientes;
