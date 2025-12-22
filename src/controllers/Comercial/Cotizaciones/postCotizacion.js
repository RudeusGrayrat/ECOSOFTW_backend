const Comercial_Cotizaciones = require("../../../models/Comercial/Cotizaciones");
const generarCorrelativa = require("./correlativa");

const postCotizacion = async (req, res) => {
  const {
    proyecto_id,
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
  } = req.body;
  try {
    if (!proyecto_id || !totalSinIgv || !totalConIgv || !igv) {
      return res
        .status(400)
        .json({ message: "Faltan campos obligatorios en la solicitud." });
    }
    const fechaOperacion = new Date();
    const { correlativa, correlativaVisible } = await generarCorrelativa(
      fechaOperacion
    );
    const nuevaCotizacion = new Comercial_Cotizaciones({
      correlativa,
      correlativaVisible,
      proyecto_id,
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
    });
    await nuevaCotizacion.save();
    return res.status(201).json({
      message: `Cotización ${correlativa} creada exitosamente.`,
      data: nuevaCotizacion,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = postCotizacion;
