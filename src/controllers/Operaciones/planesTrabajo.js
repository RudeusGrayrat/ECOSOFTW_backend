const Cotizacion = require("../../Models/Comercial/Cotizaciones");
const Solicitud = require("../../Models/Comercial/SolicitudesCotizacion");
const Plan = require("../../Models/Operaciones/PlanesTrabajo");
const Orden = require("../../Models/Operaciones/OrdenesServicio");
const escapeRegExp = require("../../utils/escapeRegex");

const mapItem = (item) => { const parameter = item.parametroSnapshot || item.parametro_id || {}; return { matriz: parameter.tipoDeAnalisis || "", parametro: parameter.parametro || "", metodologia: parameter.metodo || "", cantidad: item.cantidad || 0, acreditacion: parameter.acreditadoPor || "", laboratorio: item.proveedor || "" }; };

exports.crearPlan = async (req, res) => {
  try {
    const quote = await Cotizacion.findById(req.params.cotizacionId).populate([{ path: "proyecto_id", populate: { path: "cliente_id" } }, { path: "analisis.parametro_id" }]);
    if (!quote) return res.status(404).json({ message: "Cotización no encontrada", type: "Error" });
    if (quote.estado !== "APROBADO") return res.status(400).json({ message: "Solo se puede generar un plan desde una cotización aprobada", type: "Advertencia" });
    const existing = await Plan.findOne({ cotizacion_id: quote._id });
    if (existing) return res.json({ message: "El Plan de Trabajo ya existe", type: "Correcto", data: existing });
    const request = quote.solicitud_id ? await Solicitud.findById(quote.solicitud_id) : null;
    const now = new Date(); const suffix = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const last = await Plan.findOne({ codigo: new RegExp(`-${suffix}$`) }).sort({ correlativo: -1 }).lean();
    const correlativo = (last?.correlativo || 0) + 1;
    const client = quote.proyecto_id?.cliente_id || {};
    const fechaServicio = request?.fechaServicio || quote.proyecto_id?.fechaServicio;
    const plan = await Plan.create({ cotizacion_id: quote._id, correlativo, codigo: `PM ${String(correlativo).padStart(3, "0")}-${suffix}`, cliente: { razonSocial: quote.facturacion?.razonSocial || client.cliente, ruc: quote.facturacion?.ruc || client.numeroDocumento, direccion: quote.facturacion?.direccion || client.direccionLegal, contacto: request?.contacto?.nombreCompleto || client.nombreContacto, telefono: request?.contacto?.telefono || client.telefono, correo: request?.contacto?.correo || client.correoElectronico }, proyecto: { nombre: quote.proyecto_id?.nombre, planta: request?.nombrePlanta, lugarEjecucion: request?.lugarEjecucion || quote.proyecto_id?.lugarMuestreo, fechaServicio }, programacion: fechaServicio ? { fechaInicio: fechaServicio, fechaFin: fechaServicio, estadoOperacion: "PROGRAMADO" } : {}, condicionesIngreso: request?.condicionesIngreso, trabajoAltoRiesgo: request?.trabajoAltoRiesgo, accesibilidadPuntos: request?.accesibilidadPuntos, estaciones: request?.estaciones || [], items: quote.analisis.map(mapItem), creadoPor: req.body.creadoPor });
    return res.status(201).json({ message: "Plan de Trabajo creado", type: "Correcto", data: plan });
  } catch (error) { return res.status(500).json({ message: error.message, type: "Error" }); }
};

exports.crearOrden = async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.planId);
    if (!plan) return res.status(404).json({ message: "Plan de Trabajo no encontrado", type: "Error" });
    const existing = await Orden.findOne({ plan_id: plan._id }); if (existing) return res.json({ message: "La Orden Interna ya existe", type: "Correcto", data: existing });
    const quote = await Cotizacion.findById(plan.cotizacion_id).populate("analisis.parametro_id");
    const thirdParty = quote.analisis.filter((item) => item.modalidad === "TERCERIZADO").map(mapItem);
    if (!thirdParty.length) return res.status(400).json({ message: "La cotización no contiene servicios tercerizados", type: "Advertencia" });
    const order = await Orden.create({
      plan_id: plan._id, cotizacion_id: quote._id, correlativoPlan: plan.correlativo,
      codigo: `ORDEN DE SERVICIO ${String(plan.correlativo).padStart(3, "0")}-${new Date(plan.createdAt).getFullYear()}`,
      cliente: plan.cliente, proyecto: plan.proyecto, condicionesIngreso: plan.condicionesIngreso,
      trabajoAltoRiesgo: plan.trabajoAltoRiesgo, accesibilidadPuntos: plan.accesibilidadPuntos,
      estaciones: plan.estaciones, items: thirdParty, creadoPor: req.body.creadoPor
    });
    return res.status(201).json({ message: "Orden Interna creada", type: "Correcto", data: order });
  } catch (error) { return res.status(500).json({ message: error.message, type: "Error" }); }
};

const listDocuments = async (req, res, Model, populate, searchableFields) => {
  try {
    const { page, limit, search = "" } = req.query;
    const filter = search
      ? { $or: searchableFields.map((field) => ({ [field]: { $regex: escapeRegExp(search.trim()), $options: "i" } })) }
      : {};
    const hasPagination = page !== undefined || limit !== undefined;
    if (!hasPagination) {
      const data = await Model.find(filter).sort({ createdAt: -1 }).populate(populate);
      return res.json({ data, total: data.length });
    }
    const safePage = Math.max(0, Number(page) || 0);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));
    const [data, total] = await Promise.all([
      Model.find(filter).sort({ createdAt: -1 }).skip(safePage * safeLimit).limit(safeLimit).populate(populate),
      Model.countDocuments(filter),
    ]);
    return res.json({ data, total });
  } catch (error) {
    return res.status(500).json({ message: error.message, type: "Error" });
  }
};

exports.listarPlanes = async (req, res) => {
  return listDocuments(req, res, Plan, "cotizacion_id analistaOperaciones elaboradoPor", ["codigo", "estado", "proyecto.nombre", "proyecto.planta"]);
};

exports.listarOrdenes = async (req, res) => {
  return listDocuments(req, res, Orden, "plan_id cotizacion_id", ["codigo", "estado", "proyecto.nombre", "proyecto.planta"]);
};

exports.actualizarPlan = async (req, res) => {
  const allowed = ["cliente", "proyecto", "condicionesIngreso", "trabajoAltoRiesgo", "accesibilidadPuntos", "estaciones", "items", "analistaOperaciones", "analistaOperacionesManual", "elaboradoPor", "estado", "programacion"];
  const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  const plan = await Plan.findById(req.params.id);
  if (!plan) return res.status(404).json({ message: "Plan no encontrado", type: "Error" });
  if (changes.programacion) {
    const before = plan.programacion?.toObject?.() || plan.programacion || {};
    const next = { ...before, ...changes.programacion };
    if (next.fechaInicio && !next.fechaFin) next.fechaFin = next.fechaInicio;
    if (next.fechaFin && next.fechaInicio && new Date(next.fechaFin) < new Date(next.fechaInicio)) return res.status(400).json({ message: "La fecha final no puede ser anterior a la fecha inicial", type: "Advertencia" });
    changes.programacion = next;
    if (next.fechaInicio) {
      changes.proyecto = { ...(plan.proyecto?.toObject?.() || plan.proyecto || {}), fechaServicio: next.fechaInicio };
    }
    plan.historialProgramacion.push({ actualizadoPor: req.body.actualizadoPor, motivo: req.body.motivoReprogramacion || "Actualización de programación", antes: before, despues: next });
  }
  Object.assign(plan, changes);
  const data = await plan.save();
  return res.json({ data, message: "Plan de Trabajo actualizado", type: "Correcto" });
};

exports.actualizarOrden = async (req, res) => {
  const allowed = ["cliente", "proyecto", "condicionesIngreso", "trabajoAltoRiesgo", "accesibilidadPuntos", "estaciones", "items", "estado"];
  const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  const data = await Orden.findByIdAndUpdate(req.params.id, changes, { new: true });
  return data ? res.json({ data, message: "Orden Interna actualizada", type: "Correcto" }) : res.status(404).json({ message: "Orden no encontrada", type: "Error" });
};
