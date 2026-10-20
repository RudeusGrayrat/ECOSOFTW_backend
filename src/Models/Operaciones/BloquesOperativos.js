const mongoose = require("mongoose");

const bloqueOperativoSchema = new mongoose.Schema({
  tipo: { type: String, enum: ["CAPACITACION", "VISITA_TECNICA", "RECEPCION_MUESTRAS", "MANTENIMIENTO", "AUDITORIA", "OTRO"], required: true },
  titulo: { type: String, required: true, trim: true },
  fechaInicio: { type: Date, required: true },
  fechaFin: { type: Date, required: true },
  horaInicio: String,
  horaFin: String,
  estado: { type: String, enum: ["PROGRAMADO", "EN_CAMPO", "FINALIZADO", "REPROGRAMADO", "ANULADO"], default: "PROGRAMADO" },
  personal: [{ type: mongoose.Schema.Types.ObjectId, ref: "UserEcosoft" }],
  equipos: [{ type: mongoose.Schema.Types.ObjectId, ref: "operaciones_recursos" }],
  observaciones: String,
  creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: "UserEcosoft" },
  actualizadoPor: { type: mongoose.Schema.Types.ObjectId, ref: "UserEcosoft" },
}, { timestamps: true });

module.exports = mongoose.model("operaciones_bloques_operativos", bloqueOperativoSchema);
