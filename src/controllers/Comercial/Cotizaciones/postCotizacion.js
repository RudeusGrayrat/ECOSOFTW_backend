const Comercial_Cotizaciones = require("../../../Models/Comercial/Cotizaciones");
const Comercial_Proyectos = require("../../../Models/Comercial/Proyectos");
const SolicitudCotizacion = require("../../../Models/Comercial/SolicitudesCotizacion");
const generarCorrelativa = require("./correlativa");

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
  } = req.body;
  try {
    console.log(req.body);
    if (!proyecto_id || !totalSinIgv || !totalConIgv || !igv || !creadoPor) {
      return res
        .status(400)
        .json({ message: "Faltan campos obligatorios en la solicitud.", type: "Aviso" });
    }
    const proyecto = await Comercial_Proyectos.findById(proyecto_id).populate("cliente_id");
    if (!proyecto) return res.status(404).json({ message: "Proyecto no encontrado.", type: "Error" });
    const fechaOperacion = new Date();
    const { correlativa, correlativaVisible } = await generarCorrelativa(
      fechaOperacion,
      proyecto.cliente_id?.cliente
    );
    const solicitudVinculada = solicitud_id || (await SolicitudCotizacion.findOne({ proyecto_id }).sort({ createdAt: -1 }).select("_id"))?._id;
    const nuevaCotizacion = new Comercial_Cotizaciones({
      correlativa,
      correlativaVisible,
      proyecto_id,
      solicitud_id: solicitudVinculada,
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
