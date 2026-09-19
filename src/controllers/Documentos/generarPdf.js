const fs = require("fs");
const Plantilla = require("../../Models/Herramientas/PlantillaDocumental");
const Cotizacion = require("../../Models/Comercial/Cotizaciones");
const Plan = require("../../Models/Operaciones/PlanesTrabajo");
const Orden = require("../../Models/Operaciones/OrdenesServicio");
const { templatePath } = require("../../utils/Documentos/paths");
const renderDocx = require("../../utils/Documentos/renderDocx");
const convertToPdf = require("../../utils/Documentos/convertToPdf");

const date = (value) => value ? new Date(value).toLocaleDateString("es-PE") : "";
const templateFor = async (tipo) => {
  const template = await Plantilla.findOne({ tipo, estado: "ACTIVA" });
  if (!template) throw new Error("No hay una plantilla activa configurada para este documento");
  const file = templatePath(template.archivo); if (!fs.existsSync(file)) throw new Error("No se encontró el archivo de la plantilla activa");
  return file;
};
const hydrateImages = async (data) => {
  for (const key of Object.keys(data)) {
    if (!key.startsWith("firma_") || typeof data[key] !== "string" || !data[key].startsWith("http")) continue;
    const response = await fetch(data[key]);
    if (!response.ok) throw new Error("No se pudo descargar la firma configurada del usuario");
    const type = response.headers.get("content-type") || "image/png";
    data[key] = `data:${type};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
  }
  return data;
};
const sendPdf = async (res, data, tipo, name) => {
  await hydrateImages(data);
  const docx = await renderDocx(data, await templateFor(tipo)); const pdf = await convertToPdf(docx);
  res.set({ "Content-Type": "application/pdf", "Content-Disposition": `inline; filename=${name}.pdf`, "Content-Length": pdf.length }); return res.send(pdf);
};
const item = (row) => ({ matriz: row.matriz || row.parametro_id?.tipoDeAnalisis || "", parametro: row.parametro || row.parametro_id?.parametro || "", metodologia: row.metodologia || row.parametro_id?.metodo || "", cantidad: row.cantidad || "", acreditacion: row.acreditacion || row.parametro_id?.acreditadoPor || "", laboratorio: row.laboratorio || row.proveedor || "" });

exports.cotizacion = async (req, res) => {
  try {
    const quote = await Cotizacion.findById(req.params.id).populate([{ path: "proyecto_id", populate: { path: "cliente_id" } }, { path: "analisis.parametro_id" }, "creadoPor aprobadoPor"]);
    if (!quote) return res.status(404).json({ message: "Cotización no encontrada", type: "Error" });
    const client = quote.proyecto_id?.cliente_id || {};
    return sendPdf(res, { codigo: quote.correlativaVisible, cliente: quote.facturacion?.razonSocial || client.cliente || "", ruc: quote.facturacion?.ruc || client.numeroDocumento || "", direccion: quote.facturacion?.direccion || client.direccionLegal || "", proyecto: quote.proyecto_id?.nombre || "", lugar_muestreo: quote.proyecto_id?.lugarMuestreo || "", fecha_emision: date(quote.createdAt), forma_pago: quote.facturacion?.formaPago || "", items: quote.analisis.map(item), elaborado_por: quote.creadoPor?.colaborador || "", aprobador: quote.aprobadoPor?.colaborador || "", firma_aprobador: quote.firmaAprobador || "" }, "COTIZACION", quote.correlativaVisible);
  } catch (error) { return res.status(500).json({ message: error.message, type: "Error" }); }
};

const operationalData = (document, order = false) => {
  const elaboradoPor = document.elaboradoPor || document.creadoPor;
  return { codigo: document.codigo, codigo_cotizacion: document.cotizacion_id?.correlativaVisible || "", fecha_elaboracion: date(document.createdAt), cliente: document.cliente?.razonSocial || "", ruc: document.cliente?.ruc || "", contacto: document.cliente?.contacto || "", telefono: document.cliente?.telefono || "", correo: document.cliente?.correo || "", proyecto: document.proyecto?.nombre || "", planta: document.proyecto?.planta || "", lugar_muestreo: document.proyecto?.lugarEjecucion || "", fecha_servicio: date(document.proyecto?.fechaServicio), condiciones_ingreso: document.condicionesIngreso || "", trabajo_alto_riesgo: document.trabajoAltoRiesgo || "", accesibilidad: document.accesibilidadPuntos || "", estaciones: document.estaciones || [], items: (document.items || []).map(item), analista_operaciones: document.analistaOperaciones?.colaborador || document.analistaOperacionesManual || "", elaborado_por: elaboradoPor?.colaborador || elaboradoPor?.userName || "", firma_elaborado: elaboradoPor?.firma || "", es_orden: order };
};

exports.plan = async (req, res) => {
  try { const plan = await Plan.findById(req.params.id).populate("elaboradoPor analistaOperaciones").populate({ path: "cotizacion_id", select: "correlativaVisible" }); if (!plan) return res.status(404).json({ message: "Plan no encontrado", type: "Error" }); return sendPdf(res, operationalData(plan), "PLAN_TRABAJO", plan.codigo.replace(/\s/g, "_")); } catch (error) { return res.status(500).json({ message: error.message, type: "Error" }); }
};
exports.orden = async (req, res) => {
  try { const order = await Orden.findById(req.params.id).populate("creadoPor").populate({ path: "cotizacion_id", select: "correlativaVisible" }); if (!order) return res.status(404).json({ message: "Orden no encontrada", type: "Error" }); return sendPdf(res, operationalData(order, true), "ORDEN_INTERNA", order.codigo.replace(/\s/g, "_")); } catch (error) { return res.status(500).json({ message: error.message, type: "Error" }); }
};
