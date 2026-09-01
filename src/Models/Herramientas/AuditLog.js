const mongoose = require("mongoose");
module.exports = mongoose.model("herramientas_auditoria", new mongoose.Schema({
  entidad: { type: String, required: true }, entidadId: String, accion: { type: String, required: true },
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: "UserEcosoft" }, detalle: String,
}, { timestamps: true }));
