const Comercial_Cotizaciones = require("../../../Models/Comercial/Cotizaciones");
const Comercial_Proyectos = require("../../../Models/Comercial/Proyectos");
const SolicitudCotizacion = require("../../../Models/Comercial/SolicitudesCotizacion");
const Parametro = require("../../../Models/Comercial/Parametros");
const TipoDeGasto = require("../../../Models/Comercial/TipoDeGastos");
const generarCorrelativa = require("./correlativa");

const snapshotProyecto = (proyecto) => ({
  nombre: proyecto?.nombre || "según cadena de custodia",
  servicio: proyecto?.servicio || "",
  fechaServicio: proyecto?.fechaServicio || undefined,
  lugarMuestreo: proyecto?.lugarMuestreo || "",
  cantidadPuntosParametros: proyecto?.cantidadPuntosParametros || "",
});

const snapshotSolicitud = (solicitud) => {
  if (!solicitud) return undefined;
  return {
    servicios: solicitud.servicios || [],
    fechaServicio: solicitud.fechaServicio || undefined,
    parametrosSolicitados: (solicitud.parametrosSolicitados || []).map((item) => ({
      parametro: item.parametro_id?.parametro || "",
      matriz: item.parametro_id?.tipoDeAnalisis || "",
      cantidadPuntos: Number(item.cantidadPuntos || 0),
    })),
    metodologiaParametros: solicitud.metodologiaParametros || "",
    lugarEjecucion: solicitud.lugarEjecucion || "",
    contacto: solicitud.contacto || {},
  };
};

const gastosCorrespondenACategoria = async (gastos = [], categoria) => {
  const ids = gastos.map((item) => item.tipoDeGasto_id?.toString()).filter(Boolean);
  if (!ids.length) return true;
  const validos = await TipoDeGasto.countDocuments({ _id: { $in: ids }, categoria, estado: "ACTIVO" });
  return validos === new Set(ids).size;
};
const withExpenseSnapshots = async (gastos = [], categoria) => {
  const ids = [...new Set(gastos.map((item) => item.tipoDeGasto_id?.toString()).filter(Boolean))];
  if (!ids.length) return gastos;
  const tipos = await TipoDeGasto.find({ _id: { $in: ids }, categoria, estado: "ACTIVO" }).lean();
  const byId = new Map(tipos.map((tipo) => [tipo._id.toString(), tipo]));
  if (byId.size !== ids.length) throw new Error("Uno o más gastos no pertenecen a la categoría seleccionada o están inactivos");
  return gastos.map((gasto) => {
    const tipo = gasto.tipoDeGasto_id ? byId.get(gasto.tipoDeGasto_id.toString()) : null;
    if (!tipo) return gasto;
    return { ...gasto, gastoSnapshot: { codigo: tipo.codigo || "", tipoDeGasto: tipo.tipoDeGasto, categoria: tipo.categoria, descripcion: tipo.descripcion, precio: tipo.precio, origen: tipo.origen || "MANUAL", unidadReferencia: tipo.unidadReferencia || "FIJO", vigenciaDesde: tipo.vigenciaDesde, vigenciaHasta: tipo.vigenciaHasta } };
  });
};

const postCotizacion = async (req, res) => {
  const {
    proyecto_id,
    solicitud_id,
    tipoDeServicio,
    tiempoDeEntrega,
    analisis,
    gastosOperativos,
    gastosAdministrativos,
    gastosGenerales,
    totalSinIgv,
    totalConIgv,
    igv,
    estado,
    facturacion,
    creadoPor,
    fechaElaboracion,
  } = req.body;
  try {
    if (!proyecto_id || !totalSinIgv || !totalConIgv || !igv || !creadoPor) {
      return res
        .status(400)
        .json({ message: "Faltan campos obligatorios en la solicitud.", type: "Aviso" });
    }
    const proyecto = await Comercial_Proyectos.findById(proyecto_id).populate("cliente_id");
    if (!proyecto) return res.status(404).json({ message: "Proyecto no encontrado.", type: "Error" });
    const fechaOperacion = fechaElaboracion ? new Date(fechaElaboracion) : new Date();
    if (Number.isNaN(fechaOperacion.getTime())) return res.status(400).json({ message: "La fecha de elaboración no es válida.", type: "Advertencia" });
    const { correlativa, correlativaVisible } = await generarCorrelativa(
      fechaOperacion,
      proyecto.cliente_id?.cliente
    );
    const solicitudVinculada = solicitud_id || (await SolicitudCotizacion.findOne({ proyecto_id }).sort({ createdAt: -1 }).select("_id"))?._id;
    const solicitud = solicitudVinculada
      ? await SolicitudCotizacion.findById(solicitudVinculada).populate("parametrosSolicitados.parametro_id")
      : null;
    const parameterIds = [...new Set((analisis || []).map((item) => item.parametro_id?.toString()).filter(Boolean))];
    const parameters = await Parametro.find({ _id: { $in: parameterIds }, estado: { $ne: "INACTIVO" } }).lean();
    const parameterMap = new Map(parameters.map((parameter) => [parameter._id.toString(), parameter]));
    if (parameterMap.size !== parameterIds.length) return res.status(400).json({ message: "Uno o más parámetros no existen o están inactivos. Actualiza la cotización.", type: "Advertencia" });
    const analysisWithSnapshot = (analisis || []).map((analysis) => {
      const parameter = parameterMap.get(analysis.parametro_id.toString());
      return { ...analysis, parametroSnapshot: { tipoDeAnalisis: parameter.tipoDeAnalisis, categoria: parameter.categoria, nombreCorto: parameter.nombreCorto, parametro: parameter.parametro, componentes: parameter.componentes, tipoItem: parameter.tipoItem, unidadCobro: parameter.unidadCobro, metodo: parameter.metodo, acreditadoPor: parameter.acreditadoPor, tipoDeAcreditacion: parameter.tipoDeAcreditacion, limiteDeCuantificacionDelMetodo: parameter.limiteDeCuantificacionDelMetodo, limiteDeDeteccionDelMetodo: parameter.limiteDeDeteccionDelMetodo, unidadDeMedida: parameter.unidadDeMedida, precio: parameter.precio, vigenciaDesde: parameter.vigenciaDesde, vigenciaHasta: parameter.vigenciaHasta } };
    });
    const [operativosCorrectos, administrativosCorrectos] = await Promise.all([
      gastosCorrespondenACategoria(gastosOperativos, "OPERATIVO"),
      gastosCorrespondenACategoria(gastosAdministrativos, "ADMINISTRATIVO"),
    ]);
    if (!operativosCorrectos || !administrativosCorrectos) {
      return res.status(400).json({ message: "Cada gasto debe pertenecer a su categoría. Clasifica los gastos históricos antes de utilizarlos.", type: "Advertencia" });
    }
    const [gastosOperativosSnapshot, gastosAdministrativosSnapshot] = await Promise.all([
      withExpenseSnapshots(gastosOperativos || [], "OPERATIVO"),
      withExpenseSnapshots(gastosAdministrativos || [], "ADMINISTRATIVO"),
    ]);
    const nuevaCotizacion = new Comercial_Cotizaciones({
      correlativa,
      correlativaVisible,
      fechaElaboracion: fechaOperacion,
      proyecto_id,
      solicitud_id: solicitudVinculada,
      proyectoSnapshot: snapshotProyecto(proyecto),
      solicitudSnapshot: snapshotSolicitud(solicitud),
      tipoDeServicio,
      tiempoDeEntrega,
      analisis: analysisWithSnapshot,
      gastosOperativos: gastosOperativosSnapshot,
      gastosAdministrativos: gastosAdministrativosSnapshot,
      gastosGenerales,
      totalSinIgv,
      totalConIgv,
      igv,
      estado: estado || "PENDIENTE",
      facturacion,
      creadoPor
    });
    await nuevaCotizacion.save();
    if (solicitudVinculada) await SolicitudCotizacion.findByIdAndUpdate(solicitudVinculada, { estado: "COTIZADA" });
    return res.status(201).json({
      message: `Cotización ${correlativa} creada exitosamente.`,
      data: nuevaCotizacion,
      type: "Correcto",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = postCotizacion;
