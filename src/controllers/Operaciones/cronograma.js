const Plan = require("../../Models/Operaciones/PlanesTrabajo");
const Bloque = require("../../Models/Operaciones/BloquesOperativos");
const Recurso = require("../../Models/Operaciones/RecursosOperativos");
const escapeRegExp = require("../../utils/escapeRegex");

const dateAtStart = (value) => { const date = new Date(value); date.setHours(0, 0, 0, 0); return date; };
const dateAtEnd = (value) => { const date = new Date(value); date.setHours(23, 59, 59, 999); return date; };
const ids = (items = []) => items.map((item) => String(item?._id || item)).filter(Boolean);
const overlaps = (first, second) => new Date(first.inicio) <= new Date(second.fin) && new Date(second.inicio) <= new Date(first.fin);
const shared = (first = [], second = []) => first.some((id) => second.includes(id));

const eventFromPlan = (plan) => {
  const schedule = plan.programacion || {};
  const inicio = schedule.fechaInicio || plan.proyecto?.fechaServicio;
  const fin = schedule.fechaFin || inicio;
  const personal = ids(schedule.personal?.length ? schedule.personal : [plan.analistaOperaciones]).concat((schedule.personalExterno || []).map((name) => `externo:${name}`));
  const equipos = ids([...(schedule.equipos || []), schedule.vehiculo].filter(Boolean));
  return {
    id: String(plan._id), origen: "PLAN", codigo: plan.codigo, titulo: plan.proyecto?.nombre || plan.codigo,
    cliente: plan.cliente?.razonSocial || "", proyecto: plan.proyecto?.nombre || "", matrices: [...new Set((plan.items || []).map((item) => item.matriz).filter(Boolean))],
    inicio, fin, horaInicio: schedule.horaInicio || "", horaFin: schedule.horaFin || "", estado: schedule.estadoOperacion || "PROGRAMADO",
    estadoDocumento: plan.estado, personal, personalNombres: [plan.analistaOperaciones?.colaborador, ...(schedule.personal || []).map((person) => person?.colaborador), ...(schedule.personalExterno || [])].filter((value, index, values) => value && values.indexOf(value) === index),
    equipos, equipoNombres: [...(schedule.equipos || []), schedule.vehiculo].filter(Boolean).map((item) => item.nombre || item.codigo),
    observaciones: schedule.observaciones || "", planId: String(plan._id),
  };
};

const eventFromBlock = (block) => ({
  id: String(block._id), origen: "BLOQUE", codigo: block.tipo, titulo: block.titulo, cliente: "", proyecto: "", matrices: [],
  inicio: block.fechaInicio, fin: block.fechaFin, horaInicio: block.horaInicio || "", horaFin: block.horaFin || "", estado: block.estado,
  personal: ids(block.personal), personalNombres: (block.personal || []).map((person) => person.colaborador || person.userName).filter(Boolean),
  equipos: ids(block.equipos), equipoNombres: (block.equipos || []).map((item) => item.nombre || item.codigo), observaciones: block.observaciones || "", bloqueId: String(block._id),
});

const addConflicts = (events) => events.map((event) => {
  const conflicts = events.filter((other) => other.id !== event.id && overlaps(event, other) && (shared(event.personal, other.personal) || shared(event.equipos, other.equipos))).map((other) => ({ id: other.id, codigo: other.codigo, personal: shared(event.personal, other.personal), equipo: shared(event.equipos, other.equipos) }));
  return { ...event, conflictos: conflicts };
});

exports.listarCronograma = async (req, res) => {
  try {
    const inicio = dateAtStart(req.query.desde || new Date());
    const fin = dateAtEnd(req.query.hasta || new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0));
    const planFilter = { estado: { $ne: "ANULADO" }, $or: [
      { "programacion.fechaInicio": { $lte: fin }, "programacion.fechaFin": { $gte: inicio } },
      { "programacion.fechaInicio": { $gte: inicio, $lte: fin }, "programacion.fechaFin": { $exists: false } },
      { "proyecto.fechaServicio": { $gte: inicio, $lte: fin } },
    ] };
    const [plans, blocks] = await Promise.all([
      Plan.find(planFilter).populate("analistaOperaciones programacion.personal programacion.equipos programacion.vehiculo").lean(),
      Bloque.find({ estado: { $ne: "ANULADO" }, fechaInicio: { $lte: fin }, fechaFin: { $gte: inicio } }).populate("personal equipos").lean(),
    ]);
    const events = addConflicts([...plans.map(eventFromPlan), ...blocks.map(eventFromBlock)]).sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
    return res.json({ data: events, total: events.length });
  } catch (error) { return res.status(500).json({ message: error.message, type: "Error" }); }
};

exports.listarBloques = async (req, res) => {
  try { const data = await Bloque.find().sort({ fechaInicio: -1 }).populate("personal equipos"); return res.json({ data, total: data.length }); }
  catch (error) { return res.status(500).json({ message: error.message, type: "Error" }); }
};

exports.crearBloque = async (req, res) => {
  try {
    const block = await Bloque.create({ ...req.body, creadoPor: req.body.creadoPor, actualizadoPor: req.body.creadoPor });
    return res.status(201).json({ data: block, message: "Bloque operativo creado", type: "Correcto" });
  } catch (error) { return res.status(400).json({ message: error.message, type: "Error" }); }
};
exports.actualizarBloque = async (req, res) => {
  try { const data = await Bloque.findByIdAndUpdate(req.params.id, { ...req.body, actualizadoPor: req.body.actualizadoPor }, { new: true }); return data ? res.json({ data, message: "Bloque operativo actualizado", type: "Correcto" }) : res.status(404).json({ message: "Bloque no encontrado", type: "Error" }); }
  catch (error) { return res.status(400).json({ message: error.message, type: "Error" }); }
};
exports.eliminarBloque = async (req, res) => {
  try { const data = await Bloque.findByIdAndUpdate(req.params.id, { estado: "ANULADO", actualizadoPor: req.body.actualizadoPor }, { new: true }); return data ? res.json({ data, message: "Bloque operativo anulado", type: "Correcto" }) : res.status(404).json({ message: "Bloque no encontrado", type: "Error" }); }
  catch (error) { return res.status(400).json({ message: error.message, type: "Error" }); }
};

exports.listarRecursos = async (req, res) => {
  try {
    const { page, limit, search = "" } = req.query; const filter = search ? { $or: ["codigo", "nombre", "categoria", "tipo", "estado"].map((field) => ({ [field]: { $regex: escapeRegExp(search), $options: "i" } })) } : {};
    const safePage = Math.max(0, Number(page) || 0), safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));
    const [data, total] = await Promise.all([Recurso.find(filter).sort({ nombre: 1 }).skip(safePage * safeLimit).limit(safeLimit), Recurso.countDocuments(filter)]);
    return res.json({ data, total });
  } catch (error) { return res.status(500).json({ message: error.message, type: "Error" }); }
};
exports.crearRecurso = async (req, res) => { try { const data = await Recurso.create(req.body); return res.status(201).json({ data, message: "Recurso operativo creado", type: "Correcto" }); } catch (error) { return res.status(400).json({ message: error.message, type: "Error" }); } };
exports.actualizarRecurso = async (req, res) => { try { const data = await Recurso.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }); return data ? res.json({ data, message: "Recurso operativo actualizado", type: "Correcto" }) : res.status(404).json({ message: "Recurso no encontrado", type: "Error" }); } catch (error) { return res.status(400).json({ message: error.message, type: "Error" }); } };
