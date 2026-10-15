const ComercialClientes = require("../../../Models/Comercial/Clientes");
const ComercialProyectos = require("../../../Models/Comercial/Proyectos");
const SolicitudCotizacion = require("../../../Models/Comercial/SolicitudesCotizacion");
const { saveIncoming, removeSaved } = require("./solicitudAdjuntos");

const clean = (value) => (typeof value === "string" ? value.trim() : value);
const parseJson = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return fallback; }
};
const cleanList = (value) => parseJson(value, Array.isArray(value) ? value : []).filter(Boolean).map(clean);
const cleanParameterRequests = (value) => parseJson(value, [])
  .map((item) => ({ parametro_id: item?.parametro_id, cantidadPuntos: Math.max(1, Number(item?.cantidadPuntos) || 1) }))
  .filter((item) => item.parametro_id);

const postSolicitudCotizacion = async (req, res) => {
  const { tipoCliente = "EMPRESA", cliente, numeroDocumento, direccionLegal, proyecto, fechaServicio } = req.body;
  const servicios = cleanList(req.body.servicios);
  const contacto = parseJson(req.body.contacto, {});
  // El proyecto es opcional para solicitudes que llegan desde cadena de custodia.
  const nombreProyecto = clean(proyecto) || "según cadena de custodia";

  if (!cliente || !numeroDocumento || !servicios.length || !fechaServicio) {
    return res.status(400).json({ message: "Completa los datos obligatorios de identificación, servicio y fecha.", type: "Advertencia" });
  }

  try {
    let clienteDb = await ComercialClientes.findOne({ numeroDocumento: clean(numeroDocumento) });
    if (!clienteDb) {
      clienteDb = await ComercialClientes.create({
        tipoCliente, cliente: clean(cliente), numeroDocumento: clean(numeroDocumento), nombreContacto: clean(contacto.nombreCompleto),
        telefono: clean(contacto.telefono), correoElectronico: clean(contacto.correo), direccionLegal: clean(direccionLegal), estado: "ACTIVO",
      });
    }

    let proyectoDb = await ComercialProyectos.findOne({ cliente_id: clienteDb._id, nombre: new RegExp(`^${nombreProyecto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }).sort({ createdAt: -1 });
    if (!proyectoDb) {
      proyectoDb = await ComercialProyectos.create({
        cliente_id: clienteDb._id, nombre: nombreProyecto, servicio: servicios.join(", "), fechaServicio,
        lugarMuestreo: clean(req.body.lugarEjecucion), cantidadPuntosParametros: clean(req.body.cantidadPuntosParametros), estado: "ACTIVO",
      });
    } else if (req.body.cantidadPuntosParametros !== undefined) {
      proyectoDb.cantidadPuntosParametros = clean(req.body.cantidadPuntosParametros);
      await proyectoDb.save();
    }

    const attachmentFiles = req.files || [];
    let savedAttachments = [];
    try {
      savedAttachments = await saveIncoming(attachmentFiles);
      const solicitud = await SolicitudCotizacion.create({
        cliente_id: clienteDb._id, proyecto_id: proyectoDb._id, servicios, frecuenciaAire: clean(req.body.frecuenciaAire),
        cantidadPuntosParametros: clean(req.body.cantidadPuntosParametros), metodologiaParametros: clean(req.body.metodologiaParametros), fechaServicio,
        tipoDocumento: cleanList(req.body.tipoDocumento), nombrePlanta: clean(req.body.nombrePlanta), lugarEjecucion: clean(req.body.lugarEjecucion),
        ubicacion: parseJson(req.body.ubicacion, {}), parametrosSolicitados: cleanParameterRequests(req.body.parametrosSolicitados),
        requisitosIngreso: cleanList(req.body.requisitosIngreso), induccionHoras: req.body.induccionHoras === "" || req.body.induccionHoras === undefined ? undefined : Number(req.body.induccionHoras),
        peligrosEspecificos: cleanList(req.body.peligrosEspecificos), zonaUtm: clean(req.body.zonaUtm), datum: clean(req.body.datum),
        condicionesIngreso: clean(req.body.condicionesIngreso), trabajoAltoRiesgo: clean(req.body.trabajoAltoRiesgo), accesibilidadPuntos: clean(req.body.accesibilidadPuntos),
        estaciones: parseJson(req.body.estaciones, []), adjuntos: savedAttachments.map(({ path, ...file }) => file),
        destinatarioInforme: parseJson(req.body.destinatarioInforme, {}), contacto,
      });
      return res.status(201).json({ message: "Recibimos tu solicitud. El equipo comercial revisará la información para preparar la cotización.", type: "Correcto", data: solicitud });
    } catch (error) {
      await removeSaved(savedAttachments);
      throw error;
    }
  } catch (error) {
    console.error("[SOLICITUD] Error al registrar", { message: error.message });
    return res.status(500).json({ message: "No pudimos registrar la solicitud. Inténtalo nuevamente.", type: "Error" });
  }
};

module.exports = postSolicitudCotizacion;
