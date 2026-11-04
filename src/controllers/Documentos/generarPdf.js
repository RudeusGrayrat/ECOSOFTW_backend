const fs = require("fs");
const { randomUUID } = require("crypto");
const Plantilla = require("../../Models/Herramientas/PlantillaDocumental");
const Cotizacion = require("../../Models/Comercial/Cotizaciones");
const TipoDeGasto = require("../../Models/Comercial/TipoDeGastos");
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
  return { file, metadata: template };
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
  const docx = await renderDocx({
    // Datos de control del formato. Son independientes del documento generado
    // y se actualizan al reemplazar o editar la plantilla activa.
    correlativa: template.metadata.nombre || "",
    version: template.metadata.version || "",
    fecha_vigencia: date(template.metadata.vigenciaDesde),
    ...data,
  }, template.file);
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
const item = (row) => { const parameter = row.parametroSnapshot || row.parametro_id || {}; const parametro = row.parametro || parameter.parametro || ""; return { matriz: row.matriz || parameter.tipoDeAnalisis || "", parametro, parametros: parametro, metodologia: row.metodologia || parameter.metodo || "", cantidad: row.cantidad || "", acreditacion: row.acreditacion || parameter.acreditadoPor || "", laboratorio: row.laboratorio || row.proveedor || "" }; };
const money = (value) => `S/. ${Number(value || 0).toFixed(2)}`;
const sum = (rows = []) => rows.reduce((total, row) => total + Number(row.monto ?? row.subtotal ?? 0), 0);
const analyst = (row) => {
  const parameter = row.parametroSnapshot || row.parametro_id || {};
  const precioUnitario = row.precioUnitario ?? row.precio ?? parameter.precio;
  return { categoria: parameter.categoria || "", parametro: parameter.parametro || "", nombre_corto: parameter.nombreCorto || parameter.parametro || "", tipo_item: parameter.tipoItem || "", unidad_cobro: parameter.unidadCobro || "POR_UNIDAD", metodologia: parameter.metodo || "", acreditacion: parameter.acreditadoPor || "", unidad_de_medida: parameter.unidadDeMedida || "", ldm: parameter.limiteDeDeteccionDelMetodo || "", lcm: parameter.limiteDeCuantificacionDelMetodo || "", precio_unitario: money(precioUnitario), cantidad: row.cantidad || "", subtotal: money(row.subtotal), monto: Number(row.subtotal || 0) };
};
const gasto = (row, operational = false) => { const source = row.gastoSnapshot || row.tipoDeGasto_id || {}; return { descripcion: source.descripcion || row.descripcion || "", codigo_gasto: source.codigo || "", cantidad: row.cantidad || "", ...(operational ? { dias: row.dias || "" } : {}), precio: money(row.precioUnitario ?? row.precio ?? source.precio), subtotal: money(row.subtotal), monto: Number(row.subtotal || 0) }; };
const matrixSummaryLabel = (matriz) => matriz === "MONITOREO OCUPACIONAL" ? "MONITOREO OCUPACIONAL" : `MONITOREO AMBIENTAL DE ${matriz}`;
const signaturePath = (user) => user?.firmaArchivo?.path || user?.firma || "";

exports.cotizacion = async (req, res) => {
  const traceId = randomUUID();
  try {
    pdfTrace(traceId, "quote.load.start", { quoteId: req.params.id });
    const quote = await Cotizacion.findById(req.params.id).populate([{ path: "proyecto_id", populate: { path: "cliente_id" } }, { path: "analisis.parametro_id" }, { path: "gastosOperativos.tipoDeGasto_id", model: TipoDeGasto }, { path: "gastosAdministrativos.tipoDeGasto_id", model: TipoDeGasto }, "creadoPor actualizadoPor aprobadoPor"]);
    if (!quote) return res.status(404).json({ message: "Cotización no encontrada", type: "Error" });
    pdfTrace(traceId, "quote.load.done", { quoteId: quote._id.toString(), code: quote.correlativaVisible, analyses: quote.analisis?.length || 0 });
    const client = quote.proyecto_id?.cliente_id || {};
    const project = quote.proyectoSnapshot?.nombre ? quote.proyectoSnapshot : (quote.proyecto_id || {});
    const byType = (type) => (quote.analisis || []).filter((row) => (row.parametroSnapshot?.tipoDeAnalisis || row.parametro_id?.tipoDeAnalisis) === type).map(analyst);
    const agua = byType("AGUA"); const aire = byType("AIRE"); const suelo = byType("SUELO"); const ruido = byType("RUIDO"); const emisiones = byType("EMISIONES");
    const analisisPorMatriz = (quote.analisis || []).reduce((groups, row) => {
      const matriz = row.parametroSnapshot?.tipoDeAnalisis || row.parametro_id?.tipoDeAnalisis || "";
      if (!matriz) return groups;
      groups[matriz] = [...(groups[matriz] || []), row];
      return groups;
    }, {});
    const matrices = Object.keys(analisisPorMatriz);
    const tiempo = { x1: "", x2: "", x3: "", x4: "", x5: "" };
    const timeKeys = { "INFORME DE ENSAYO": "x1", TRANSPORTE: "x2", "EQUIPOS DE CAMPO": "x3", "PERSONAL DE CAMPO": "x4", "INFORME DE MONITOREO": "x5" };
    (quote.tiempoDeEntrega || []).forEach((entry) => { if (timeKeys[entry]) tiempo[timeKeys[entry]] = "X"; });
    const gastosOperativos = (quote.gastosOperativos || []).map((row) => gasto(row, true));
    const gastosAdministrativos = (quote.gastosAdministrativos || []).map((row) => gasto(row));
    // Fuente única del bloque financiero: líneas cotizadas y sus gastos.
    // Los gastosGenerales históricos eran un resumen derivado y no se vuelven
    // a mezclar aquí, porque duplicaban matrices y gastos en el PDF.
    const resumenMatrices = matrices.map((matriz) => ({
      descripcion: matrixSummaryLabel(matriz),
      subtotal: money(sum(analisisPorMatriz[matriz])),
      monto: sum(analisisPorMatriz[matriz]),
    }));
    const gastosGenerales = [
      ...resumenMatrices,
      ...(sum(gastosOperativos) ? [{ descripcion: "GASTOS OPERATIVOS", subtotal: money(sum(gastosOperativos)), monto: sum(gastosOperativos) }] : []),
      ...(sum(gastosAdministrativos) ? [{ descripcion: "GASTOS ADMINISTRATIVOS", subtotal: money(sum(gastosAdministrativos)), monto: sum(gastosAdministrativos) }] : []),
    ];
    const asesor = quote.creadoPor || quote.actualizadoPor || {};
    const approvedSignature = quote.firmaAprobador || signaturePath(quote.aprobadoPor);
    return sendPdf(res, {
      correlativa_doc: quote.correlativaVisible || "", codigo: quote.correlativaVisible || "", tipo_de_servicio: quote.tipoDeServicio || "", cliente: client.cliente || quote.facturacion?.razonSocial || "", nombre_proyecto: project.nombre || "según cadena de custodia", numero_documento: client.numeroDocumento || quote.facturacion?.ruc || "", contacto: client.nombreContacto || "", telefono: client.telefono || "", correo: client.correoElectronico || "", fecha_emision: date(quote.fechaElaboracion || quote.createdAt), fecha_vigencia: date(new Date(new Date(quote.fechaElaboracion || quote.createdAt).getTime() + (30 * 24 * 60 * 60 * 1000))), direccion_legal: quote.facturacion?.direccion || client.direccionLegal || "", lugar_muestreo: project.lugarMuestreo || "", forma_pago: quote.facturacion?.formaPago || "", razon_social: quote.facturacion?.razonSocial || client.cliente || "", ruc: quote.facturacion?.ruc || client.numeroDocumento || "", matriz: matrices.join(", "),
      ...tiempo, show_agua: agua.length > 0, agua, total_agua: money(sum(agua)), show_aire: aire.length > 0, aire, total_aire: money(sum(aire)), show_suelo: suelo.length > 0, suelo, total_suelo: money(sum(suelo)), show_ruido: ruido.length > 0, ruido, total_ruido: money(sum(ruido)), show_emisiones: emisiones.length > 0, emisiones, total_emisiones: money(sum(emisiones)), gastos_operativos: gastosOperativos, total_gastos_op: money(sum(gastosOperativos)), gastos_administrativos: gastosAdministrativos, total_gastos_ad: money(sum(gastosAdministrativos)), gastos_generales: gastosGenerales, resumen_financiero: gastosGenerales, total_gastos_generales: money(sum(gastosGenerales)), subtotal: money(quote.totalSinIgv), total_sin_igv: money(quote.totalSinIgv), igv_18: money(quote.igv), igv: money(quote.igv), total_con_igv: money(quote.totalConIgv),
      colaboradorAsesor: asesor.colaborador || "", correoAsesor: asesor.correoElectronico || "", numeroAsesor: asesor.telefono || "", puestoAsesor: asesor.puesto || "", elaborador_por: asesor.colaborador || "", aprobador: quote.aprobadoPor?.colaborador || "", correoAprobador: quote.aprobadoPor?.correoElectronico || "", firmaAprobador: approvedSignature, firma_aprobador: approvedSignature, items: (quote.analisis || []).map(item), elaborado_por: asesor.colaborador || ""
    }, "COTIZACION", quote.correlativaVisible, traceId);
  } catch (error) { return pdfError(res, error, traceId, req.params.id, "COTIZACION"); }
};

const userName = (user) => user?.colaborador || user?.userName || "";
const operationalData = (document, order = false) => {
  const elaboradoPor = document.elaboradoPor || document.cotizacion_id?.creadoPor || document.creadoPor;
  const analista = document.analistaOperaciones?.colaborador || document.analistaOperacionesManual || "";
  const apoyo = [
    ...(document.programacion?.personal || []).map(userName),
    ...(document.programacion?.personalExterno || []),
  ].filter((name) => name && name !== analista);
  const observacionesGenerales = document.trabajoAltoRiesgo && document.trabajoAltoRiesgo !== "NO"
    ? `Trabajo de alto riesgo: ${document.trabajoAltoRiesgo}`
    : "";
  return {
    codigo: document.codigo,
    codigo_cotizacion: document.cotizacion_id?.correlativaVisible || "",
    fecha_elaboracion: date(document.createdAt),
    estado_operacion: document.programacion?.estadoOperacion || document.estado || "",
    cliente: document.cliente?.razonSocial || "",
    ruc: document.cliente?.ruc || "",
    contacto: document.cliente?.contacto || "",
    telefono: document.cliente?.telefono || "",
    correo: document.cliente?.correo || "",
    proyecto: document.proyecto?.nombre || "",
    planta: document.proyecto?.planta || "",
    lugar_muestreo: document.proyecto?.lugarEjecucion || "",
    fecha_servicio: date(document.proyecto?.fechaServicio),
    condiciones_ingreso: document.condicionesIngreso || "",
    trabajo_alto_riesgo: document.trabajoAltoRiesgo || "",
    accesibilidad: document.accesibilidadPuntos || "",
    estaciones: document.estaciones || [],
    items: (document.items || []).map(item),
    analista_operaciones: analista,
    elaborado_por: userName(elaboradoPor),
    elaboradoPor: userName(elaboradoPor),
    elaboradorPor: userName(elaboradoPor),
    revisadoPor: analista,
    aprobadoPor: userName(document.cotizacion_id?.aprobadoPor),
    firma_elaborado: signaturePath(elaboradoPor),
    otros_observaciones: observacionesGenerales,
    // Estos checks requieren selección explícita en la edición del Plan. Se
    // entregan vacíos en lugar de inferir datos técnicos desde texto libre.
    disponibilidad_lugar_si: "", disponibilidad_lugar_no: "", ingreso_camioneta: "",
    grupo_electrogeno: "", seguridadd_cliente: "", seguridad_ecology: "",
    punto_energia: "", personal_caminando: "", observaciones_aspa: document.condicionesIngreso || "",
    observacion_monitoreo: document.accesibilidadPuntos || "",
    personal_apoyo_1: apoyo[0] || "", personal_apoyo_2: apoyo[1] || "", personal_apoyo_3: apoyo[2] || "",
    grupo_trabajo_observaciones: document.programacion?.observaciones || "",
    parametros_observaciones: "",
    es_orden: order,
  };
};

exports.plan = async (req, res) => {
  const traceId = randomUUID();
  try { pdfTrace(traceId, "plan.load.start", { planId: req.params.id }); const plan = await Plan.findById(req.params.id).populate("elaboradoPor analistaOperaciones creadoPor programacion.personal").populate({ path: "cotizacion_id", select: "correlativaVisible creadoPor aprobadoPor", populate: [{ path: "creadoPor", select: "colaborador userName correoElectronico telefono puesto" }, { path: "aprobadoPor", select: "colaborador userName" }] }); if (!plan) return res.status(404).json({ message: "Plan no encontrado", type: "Error" }); return sendPdf(res, operationalData(plan), "PLAN_TRABAJO", plan.codigo.replace(/\s/g, "_"), traceId); } catch (error) { return pdfError(res, error, traceId, req.params.id, "PLAN_TRABAJO"); }
};
exports.orden = async (req, res) => {
  const traceId = randomUUID();
  try { pdfTrace(traceId, "order.load.start", { orderId: req.params.id }); const order = await Orden.findById(req.params.id).populate("creadoPor").populate({ path: "cotizacion_id", select: "correlativaVisible" }); if (!order) return res.status(404).json({ message: "Orden no encontrada", type: "Error" }); return sendPdf(res, operationalData(order, true), "ORDEN_INTERNA", order.codigo.replace(/\s/g, "_"), traceId); } catch (error) { return pdfError(res, error, traceId, req.params.id, "ORDEN_INTERNA"); }
};
