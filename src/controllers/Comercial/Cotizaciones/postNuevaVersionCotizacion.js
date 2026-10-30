const Cotizacion = require("../../../Models/Comercial/Cotizaciones");
const AuditLog = require("../../../Models/Herramientas/AuditLog");

const normalize = (value) => (value || "").toString().trim().toUpperCase();
const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const totalsFromRows = (analisis = [], operativos = [], administrativos = []) => {
  const totalSinIgv = round2([...analisis, ...operativos, ...administrativos].reduce((total, item) => total + Number(item.subtotal || 0), 0));
  const igv = round2(totalSinIgv * 0.18);
  return { totalSinIgv, igv, totalConIgv: round2(totalSinIgv + igv) };
};
const normalizeRows = (rows = [], operational = false) => rows.map((row) => {
  const cantidad = Number(row.cantidad || 0);
  const dias = operational ? Number(row.dias || 0) : undefined;
  const precioUnitario = Number.isFinite(Number(row.precio ?? row.precioUnitario))
    ? Number(row.precio ?? row.precioUnitario)
    : Number(row.parametroSnapshot?.precio ?? row.gastoSnapshot?.precio ?? row.tipoDeGasto_id?.precio ?? 0);
  return { ...row, cantidad, ...(operational ? { dias } : {}), precioUnitario, subtotal: round2(precioUnitario * cantidad * (operational ? dias : 1)) };
});
const nextCode = (code, version) => {
  const label = `VR${String(version).padStart(2, "0")}`;
  return /VR\d{2}/.test(code) ? code.replace(/VR\d{2}/, label) : `${code}-${label}`;
};
const hasQuotationEditPermission = (user) => (user?.modules || []).some((entry) =>
  normalize(entry.name) === "COMERCIAL" &&
  normalize(entry.submodule?.name) === "COTIZACIONES" &&
  (entry.submodule?.permissions || []).map(normalize).includes("EDITAR")
);
const allowedFields = [
  "proyecto_id", "solicitud_id", "proyectoSnapshot", "solicitudSnapshot",
  "tipoDeServicio", "tiempoDeEntrega", "analisis", "gastosOperativos",
  "gastosAdministrativos", "facturacion", "fechaElaboracion"
];

const postNuevaVersionCotizacion = async (req, res) => {
  try {
    const original = await Cotizacion.findById(req.params.id).lean();
    if (!original) return res.status(404).json({ message: "Cotización no encontrada", type: "Error" });
    const version = Number(original.version || 0) + 1;
    const overrides = Object.fromEntries(allowedFields
      .filter((field) => req.body[field] !== undefined)
      .map((field) => [field, req.body[field]]));
    if (overrides.fechaElaboracion && Number.isNaN(new Date(overrides.fechaElaboracion).getTime())) {
      return res.status(400).json({ message: "La fecha de elaboración no es válida", type: "Advertencia" });
    }

    const requestedManualCode = normalize(req.body.codigoManual);
    if (requestedManualCode && !/^[A-Z0-9-]{8,100}$/.test(requestedManualCode)) {
      return res.status(400).json({ message: "El código solo puede incluir letras, números y guiones", type: "Advertencia" });
    }
    if (requestedManualCode && !hasQuotationEditPermission(req.user)) {
      return res.status(403).json({ message: "No tienes permiso para personalizar el código de cotización", type: "Error" });
    }

    const correlativaVisible = nextCode(requestedManualCode || original.correlativaVisible, version);
    const codeChanged = correlativaVisible !== nextCode(original.correlativaVisible, version);
    const motivo = (req.body.motivoCambioCodigo || "").toString().trim();
    if (codeChanged && !motivo) {
      return res.status(400).json({ message: "Indica el motivo de la personalización del código", type: "Advertencia" });
    }
    const historialCodigos = [...(original.historialCodigos || [])];
    if (codeChanged) historialCodigos.push({
      codigoAnterior: original.correlativaVisible,
      codigoNuevo: correlativaVisible,
      motivo,
      usuario: req.user?._id || req.body.actualizadoPor,
      fecha: new Date(),
    });

    const { _id, createdAt, updatedAt, __v, estado, aprobadoPor, firmaAprobador, actualizadoPor, ...base } = original;
    const analisis = normalizeRows(overrides.analisis ?? base.analisis);
    const gastosOperativos = normalizeRows(overrides.gastosOperativos ?? base.gastosOperativos, true);
    const gastosAdministrativos = normalizeRows(overrides.gastosAdministrativos ?? base.gastosAdministrativos);
    const totals = totalsFromRows(analisis, gastosOperativos, gastosAdministrativos);
    const nueva = await Cotizacion.create({
      ...base,
      ...overrides,
      analisis,
      gastosOperativos,
      gastosAdministrativos,
      gastosGenerales: [],
      ...totals,
      version,
      correlativaVisible,
      codigoPersonalizado: requestedManualCode || original.codigoPersonalizado || undefined,
      historialCodigos,
      estado: "PENDIENTE",
      creadoPor: req.user?._id || req.body.creadoPor || req.body.actualizadoPor || original.creadoPor,
      actualizadoPor: undefined,
      aprobadoPor: undefined,
      firmaAprobador: undefined,
    });
    if (codeChanged) await AuditLog.create({
      entidad: "COTIZACION",
      entidadId: nueva._id.toString(),
      accion: "CODIGO_PERSONALIZADO",
      usuarioId: req.user?._id || req.body.actualizadoPor,
      detalle: `${original.correlativaVisible} → ${correlativaVisible}. Motivo: ${motivo}`,
    });
    return res.status(201).json({ message: `Nueva versión ${nueva.correlativaVisible} creada`, type: "Correcto", data: nueva });
  } catch (error) { return res.status(500).json({ message: error.message, type: "Error" }); }
};

module.exports = postNuevaVersionCotizacion;
