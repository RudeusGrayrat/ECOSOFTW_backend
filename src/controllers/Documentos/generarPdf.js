const fs = require("fs");
const { randomUUID } = require("crypto");
const Plantilla = require("../../Models/Herramientas/PlantillaDocumental");
const Cotizacion = require("../../Models/Comercial/Cotizaciones");
const Plan = require("../../Models/Operaciones/PlanesTrabajo");
const Orden = require("../../Models/Operaciones/OrdenesServicio");
const { templatePath } = require("../../utils/Documentos/paths");
const renderDocx = require("../../utils/Documentos/renderDocx");
const convertToPdf = require("../../utils/Documentos/convertToPdf");

const date = (value) => value ? new Date(value).toLocaleDateString("es-PE") : "";
const pdfTrace = (traceId, stage, details = {}) => console.info("[PDF]", JSON.stringify({ traceId, stage, ...details }));

const templateFor = async (tipo, traceId) => {
  pdfTrace(traceId, "template.lookup.start", {
    tipo,
    database: Plantilla.db?.name,
    collection: Plantilla.collection?.name,
  });
  const template = await Plantilla.findOne({ tipo, estado: "ACTIVA" });
  if (!template) {
    const disponibles = await Plantilla.find({}, "tipo estado archivo").lean();
    pdfTrace(traceId, "template.lookup.missing", { tipo, disponibles });
    throw new Error(`No hay una plantilla activa configurada para ${tipo}`);
  }
  const file = templatePath(template.archivo);
  pdfTrace(traceId, "template.lookup.found", { tipo, templateId: template._id.toString(), archivo: template.archivo, file, exists: fs.existsSync(file) });
  if (!fs.existsSync(file)) throw new Error(`No se encontró el archivo de la plantilla activa: ${file}`);
  return file;
};
const hydrateImages = async (data, traceId) => {
  for (const key of Object.keys(data)) {
    if (!key.startsWith("firma_") || typeof data[key] !== "string" || !data[key].startsWith("http")) continue;
    pdfTrace(traceId, "signature.download.start", { key });
    const response = await fetch(data[key]);
    if (!response.ok) throw new Error("No se pudo descargar la firma configurada del usuario");
    const type = response.headers.get("content-type") || "image/png";
    data[key] = `data:${type};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
    pdfTrace(traceId, "signature.download.done", { key, contentType: type });
  }
  return data;
};
const sendPdf = async (res, data, tipo, name, traceId) => {
  pdfTrace(traceId, "generation.start", { tipo, name, dataKeys: Object.keys(data).length });
  await hydrateImages(data, traceId);
  const template = await templateFor(tipo, traceId);
  pdfTrace(traceId, "docx.render.start", { tipo });
  const docx = await renderDocx(data, template);
  pdfTrace(traceId, "docx.render.done", { bytes: docx.length });
  pdfTrace(traceId, "pdf.convert.start", { binary: process.env.UNOCONVERT_BIN || "unoconvert" });
  const pdf = await convertToPdf(docx);
  pdfTrace(traceId, "pdf.convert.done", { bytes: pdf.length });
  res.set({ "Content-Type": "application/pdf", "Content-Disposition": `inline; filename=${name}.pdf`, "Content-Length": pdf.length }); return res.send(pdf);
};
const pdfError = (res, error, traceId, documentId, tipo) => {
  console.error("[PDF]", JSON.stringify({ traceId, stage: "generation.failed", tipo, documentId, message: error.message, stack: error.stack }));
  return res.status(500).json({ message: error.message, type: "Error", traceId });
};
const item = (row) => { const parameter = row.parametroSnapshot || row.parametro_id || {}; return { matriz: row.matriz || parameter.tipoDeAnalisis || "", parametro: row.parametro || parameter.parametro || "", metodologia: row.metodologia || parameter.metodo || "", cantidad: row.cantidad || "", acreditacion: row.acreditacion || parameter.acreditadoPor || "", laboratorio: row.laboratorio || row.proveedor || "" }; };
const money = (value) => `S/. ${Number(value || 0).toFixed(2)}`;
const sum = (rows = []) => rows.reduce((total, row) => total + Number(row.monto ?? row.subtotal ?? 0), 0);
const analyst = (row) => {
  const parameter = row.parametroSnapshot || row.parametro_id || {};
  return { categoria: parameter.categoria || "", parametro: parameter.parametro || "", metodologia: parameter.metodo || "", acreditacion: parameter.acreditadoPor || "", unidad_de_medida: parameter.unidadDeMedida || "", ldm: parameter.limiteDeDeteccionDelMetodo || "", lcm: parameter.limiteDeCuantificacionDelMetodo || "", precio_unitario: money(parameter.precio), cantidad: row.cantidad || "", subtotal: money(row.subtotal), monto: Number(row.subtotal || 0) };
};
const gasto = (row, operational = false) => ({ descripcion: row.tipoDeGasto_id?.descripcion || row.descripcion || "", cantidad: row.cantidad || "", ...(operational ? { dias: row.dias || "" } : {}), precio: money(row.tipoDeGasto_id?.precio), subtotal: money(row.subtotal), monto: Number(row.subtotal || 0) });
const signaturePath = (user) => user?.firmaArchivo?.path || user?.firma || "";

exports.cotizacion = async (req, res) => {
  const traceId = randomUUID();
  try {
    pdfTrace(traceId, "quote.load.start", { quoteId: req.params.id });
    const quote = await Cotizacion.findById(req.params.id).populate([{ path: "proyecto_id", populate: { path: "cliente_id" } }, { path: "analisis.parametro_id" }, { path: "gastosOperativos.tipoDeGasto_id" }, { path: "gastosAdministrativos.tipoDeGasto_id" }, "creadoPor actualizadoPor aprobadoPor"]);
    if (!quote) return res.status(404).json({ message: "Cotización no encontrada", type: "Error" });
    pdfTrace(traceId, "quote.load.done", { quoteId: quote._id.toString(), code: quote.correlativaVisible, analyses: quote.analisis?.length || 0 });
    const client = quote.proyecto_id?.cliente_id || {};
    const byType = (type) => (quote.analisis || []).filter((row) => row.parametro_id?.tipoDeAnalisis === type).map(analyst);
    const agua = byType("AGUA"); const aire = byType("AIRE"); const suelo = byType("SUELO"); const ruido = byType("RUIDO"); const emisiones = byType("EMISIONES");
    const tiempo = { x1: "", x2: "", x3: "", x4: "", x5: "" };
    const timeKeys = { "INFORME DE ENSAYO": "x1", TRANSPORTE: "x2", "EQUIPOS DE CAMPO": "x3", "PERSONAL DE CAMPO": "x4", "INFORME DE MONITOREO": "x5" };
    (quote.tiempoDeEntrega || []).forEach((entry) => { if (timeKeys[entry]) tiempo[timeKeys[entry]] = "X"; });
    const gastosOperativos = (quote.gastosOperativos || []).map((row) => gasto(row, true));
    const gastosAdministrativos = (quote.gastosAdministrativos || []).map((row) => gasto(row));
    const gastosGenerales = (quote.gastosGenerales || []).map((row) => ({ descripcion: row.descripcion || row.name || "", subtotal: money(row.subtotal) }));
    const asesor = quote.creadoPor || quote.actualizadoPor || {};
    const approvedSignature = quote.firmaAprobador || signaturePath(quote.aprobadoPor);
    return sendPdf(res, {
      correlativa_doc: quote.correlativaVisible || "", codigo: quote.correlativaVisible || "", tipo_de_servicio: quote.tipoDeServicio || "", cliente: client.cliente || quote.facturacion?.razonSocial || "", nombre_proyecto: quote.proyecto_id?.nombre || "", numero_documento: client.numeroDocumento || quote.facturacion?.ruc || "", contacto: client.nombreContacto || "", telefono: client.telefono || "", correo: client.correoElectronico || "", fecha_emision: date(quote.createdAt), fecha_vigencia: date(new Date(new Date(quote.createdAt).getTime() + (30 * 24 * 60 * 60 * 1000))), direccion_legal: quote.facturacion?.direccion || client.direccionLegal || "", lugar_muestreo: quote.proyecto_id?.lugarMuestreo || "", forma_pago: quote.facturacion?.formaPago || "", razon_social: quote.facturacion?.razonSocial || client.cliente || "", ruc: quote.facturacion?.ruc || client.numeroDocumento || "",
      ...tiempo, show_agua: agua.length > 0, agua, total_agua: money(sum(agua)), show_aire: aire.length > 0, aire, total_aire: money(sum(aire)), show_suelo: suelo.length > 0, suelo, total_suelo: money(sum(suelo)), show_ruido: ruido.length > 0, ruido, total_ruido: money(sum(ruido)), show_emisiones: emisiones.length > 0, emisiones, total_emisiones: money(sum(emisiones)), gastos_operativos: gastosOperativos, total_gastos_op: money(sum(gastosOperativos)), gastos_administrativos: gastosAdministrativos, total_gastos_ad: money(sum(gastosAdministrativos)), gastos_generales: gastosGenerales, total_gastos_generales: money(sum(gastosGenerales)), total_sin_igv: money(quote.totalSinIgv),
      colaboradorAsesor: asesor.colaborador || "", correoAsesor: asesor.correoElectronico || "", numeroAsesor: asesor.telefono || "", puestoAsesor: asesor.puesto || "", elaborador_por: asesor.colaborador || "", aprobador: quote.aprobadoPor?.colaborador || "", correoAprobador: quote.aprobadoPor?.correoElectronico || "", firmaAprobador: approvedSignature, firma_aprobador: approvedSignature, items: (quote.analisis || []).map(item), elaborado_por: asesor.colaborador || ""
    }, "COTIZACION", quote.correlativaVisible, traceId);
  } catch (error) { return pdfError(res, error, traceId, req.params.id, "COTIZACION"); }
};

const operationalData = (document, order = false) => {
  const elaboradoPor = document.elaboradoPor || document.creadoPor;
  return { codigo: document.codigo, codigo_cotizacion: document.cotizacion_id?.correlativaVisible || "", fecha_elaboracion: date(document.createdAt), cliente: document.cliente?.razonSocial || "", ruc: document.cliente?.ruc || "", contacto: document.cliente?.contacto || "", telefono: document.cliente?.telefono || "", correo: document.cliente?.correo || "", proyecto: document.proyecto?.nombre || "", planta: document.proyecto?.planta || "", lugar_muestreo: document.proyecto?.lugarEjecucion || "", fecha_servicio: date(document.proyecto?.fechaServicio), condiciones_ingreso: document.condicionesIngreso || "", trabajo_alto_riesgo: document.trabajoAltoRiesgo || "", accesibilidad: document.accesibilidadPuntos || "", estaciones: document.estaciones || [], items: (document.items || []).map(item), analista_operaciones: document.analistaOperaciones?.colaborador || document.analistaOperacionesManual || "", elaborado_por: elaboradoPor?.colaborador || elaboradoPor?.userName || "", firma_elaborado: elaboradoPor?.firma || "", es_orden: order };
};

exports.plan = async (req, res) => {
  const traceId = randomUUID();
  try { pdfTrace(traceId, "plan.load.start", { planId: req.params.id }); const plan = await Plan.findById(req.params.id).populate("elaboradoPor analistaOperaciones").populate({ path: "cotizacion_id", select: "correlativaVisible" }); if (!plan) return res.status(404).json({ message: "Plan no encontrado", type: "Error" }); return sendPdf(res, operationalData(plan), "PLAN_TRABAJO", plan.codigo.replace(/\s/g, "_"), traceId); } catch (error) { return pdfError(res, error, traceId, req.params.id, "PLAN_TRABAJO"); }
};
exports.orden = async (req, res) => {
  const traceId = randomUUID();
  try { pdfTrace(traceId, "order.load.start", { orderId: req.params.id }); const order = await Orden.findById(req.params.id).populate("creadoPor").populate({ path: "cotizacion_id", select: "correlativaVisible" }); if (!order) return res.status(404).json({ message: "Orden no encontrada", type: "Error" }); return sendPdf(res, operationalData(order, true), "ORDEN_INTERNA", order.codigo.replace(/\s/g, "_"), traceId); } catch (error) { return pdfError(res, error, traceId, req.params.id, "ORDEN_INTERNA"); }
};
