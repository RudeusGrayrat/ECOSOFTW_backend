const ComercialClientes = require("../../../Models/Comercial/Clientes");
const ComercialProyectos = require("../../../Models/Comercial/Proyectos");
const SolicitudCotizacion = require("../../../Models/Comercial/SolicitudesCotizacion");

const clean = (value) => (typeof value === "string" ? value.trim() : value);

const postSolicitudCotizacion = async (req, res) => {
  const {
    tipoCliente = "EMPRESA",
    cliente,
    numeroDocumento,
    direccionLegal,
    proyecto,
    servicios,
    fechaServicio,
    contacto = {},
  } = req.body;

  if (!cliente || !numeroDocumento || !proyecto || !Array.isArray(servicios) || !servicios.length || !fechaServicio) {
    return res.status(400).json({ message: "Completa los datos obligatorios de identificación, proyecto, servicio y fecha.", type: "Advertencia" });
  }

  try {
    let clienteDb = await ComercialClientes.findOne({ numeroDocumento: clean(numeroDocumento) });
    if (!clienteDb) {
      clienteDb = await ComercialClientes.create({
        tipoCliente,
        cliente: clean(cliente),
        numeroDocumento: clean(numeroDocumento),
        nombreContacto: clean(contacto.nombreCompleto),
        telefono: clean(contacto.telefono),
        correoElectronico: clean(contacto.correo),
        direccionLegal: clean(direccionLegal),
        estado: "ACTIVO",
      });
    }

    let proyectoDb = await ComercialProyectos.findOne({
      cliente_id: clienteDb._id,
      nombre: clean(proyecto),
    }).sort({ createdAt: -1 });

    if (!proyectoDb) {
      proyectoDb = await ComercialProyectos.create({
        cliente_id: clienteDb._id,
        nombre: clean(proyecto),
        servicio: servicios.join(", "),
        fechaServicio,
        lugarMuestreo: clean(req.body.lugarEjecucion),
        cantidadPuntosParametros: clean(req.body.cantidadPuntosParametros),
        estado: "ACTIVO",
      });
    } else if (req.body.cantidadPuntosParametros !== undefined) {
      // La solicitud es el historial; el Proyecto conserva el último resumen
      // visible solicitado por el cliente para que no aparezca vacío al verlo.
      proyectoDb.cantidadPuntosParametros = clean(req.body.cantidadPuntosParametros);
      await proyectoDb.save();
    }

    const solicitud = await SolicitudCotizacion.create({
      cliente_id: clienteDb._id,
      proyecto_id: proyectoDb._id,
      servicios,
      frecuenciaAire: clean(req.body.frecuenciaAire),
      cantidadPuntosParametros: clean(req.body.cantidadPuntosParametros),
      metodologiaParametros: clean(req.body.metodologiaParametros),
      fechaServicio,
      tipoDocumento: req.body.tipoDocumento || [],
      nombrePlanta: clean(req.body.nombrePlanta),
      lugarEjecucion: clean(req.body.lugarEjecucion),
      condicionesIngreso: clean(req.body.condicionesIngreso),
      trabajoAltoRiesgo: clean(req.body.trabajoAltoRiesgo),
      accesibilidadPuntos: clean(req.body.accesibilidadPuntos),
      estaciones: req.body.estaciones || [],
      destinatarioInforme: req.body.destinatarioInforme || {},
      contacto,
    });

    return res.status(201).json({
      message: "Recibimos tu solicitud. El equipo comercial revisará la información para preparar la cotización.",
      type: "Correcto",
      data: solicitud,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message, type: "Error" });
  }
};

module.exports = postSolicitudCotizacion;
