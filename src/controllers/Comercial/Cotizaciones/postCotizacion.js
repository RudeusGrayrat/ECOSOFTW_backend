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
    creadoPor,
  } = req.body;
  try {
    console.log(req.body);
    if (!proyecto_id || !totalSinIgv || !totalConIgv || !igv || !creadoPor) {
      return res
        .status(400)
        .json({ message: "Faltan campos obligatorios en la solicitud.", type: "Aviso" });
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
      creadoPor
    });
    await nuevaCotizacion.save();
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
