const Cotizacion = require("../../Models/Comercial/Cotizaciones");
const Solicitud = require("../../Models/Comercial/SolicitudesCotizacion");
const Plan = require("../../Models/Operaciones/PlanesTrabajo");
const Orden = require("../../Models/Operaciones/OrdenesServicio");

const mapItem = (item) => ({ matriz: item.parametro_id?.tipoDeAnalisis || "", parametro: item.parametro_id?.parametro || "", metodologia: item.parametro_id?.metodo || "", cantidad: item.cantidad || 0, acreditacion: item.parametro_id?.acreditadoPor || "", laboratorio: item.proveedor || "" });

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
    const plan = await Plan.create({ cotizacion_id: quote._id, correlativo, codigo: `PM ${String(correlativo).padStart(3, "0")}-${suffix}`, cliente: { razonSocial: quote.facturacion?.razonSocial || client.cliente, ruc: quote.facturacion?.ruc || client.numeroDocumento, direccion: quote.facturacion?.direccion || client.direccionLegal, contacto: request?.contacto?.nombreCompleto || client.nombreContacto, telefono: request?.contacto?.telefono || client.telefono, correo: request?.contacto?.correo || client.correoElectronico }, proyecto: { nombre: quote.proyecto_id?.nombre, planta: request?.nombrePlanta, lugarEjecucion: request?.lugarEjecucion || quote.proyecto_id?.lugarMuestreo, fechaServicio: request?.fechaServicio || quote.proyecto_id?.fechaServicio }, condicionesIngreso: request?.condicionesIngreso, trabajoAltoRiesgo: request?.trabajoAltoRiesgo, accesibilidadPuntos: request?.accesibilidadPuntos, estaciones: request?.estaciones || [], items: quote.analisis.map(mapItem), creadoPor: req.body.creadoPor });
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

exports.listarPlanes = async (_req, res) => {
  const data = await Plan.find().sort({ createdAt: -1 }).populate("cotizacion_id analistaOperaciones elaboradoPor");
  return res.json({ data });
};

exports.listarOrdenes = async (_req, res) => {
  const data = await Orden.find().sort({ createdAt: -1 }).populate("plan_id cotizacion_id");
  return res.json({ data });
};

exports.actualizarPlan = async (req, res) => {
  const allowed = ["cliente", "proyecto", "condicionesIngreso", "trabajoAltoRiesgo", "accesibilidadPuntos", "estaciones", "items", "analistaOperaciones", "analistaOperacionesManual", "elaboradoPor", "estado"];
  const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  const data = await Plan.findByIdAndUpdate(req.params.id, changes, { new: true });
  return data ? res.json({ data, message: "Plan de Trabajo actualizado", type: "Correcto" }) : res.status(404).json({ message: "Plan no encontrado", type: "Error" });
};

exports.actualizarOrden = async (req, res) => {
  const allowed = ["cliente", "proyecto", "condicionesIngreso", "trabajoAltoRiesgo", "accesibilidadPuntos", "estaciones", "items", "estado"];
  const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  const data = await Orden.findByIdAndUpdate(req.params.id, changes, { new: true });
  return data ? res.json({ data, message: "Orden Interna actualizada", type: "Correcto" }) : res.status(404).json({ message: "Orden no encontrada", type: "Error" });
};
