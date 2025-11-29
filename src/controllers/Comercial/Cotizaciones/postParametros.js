const Comercial_Parametros = require("../../../Models/Comercial/Parametros");

const postParametro = async (req, res) => {
  const {
    tipoDeAnalisis,
    parametro,
    categoria,
    metodo,
    acreditadoPor,
    tipoDeAcreditacion,
    limiteDeCuantificacionDelMetodo,
    limiteDeDeteccionDelMetodo,
    unidadDeMedida,
    precio,
  } = req.body;
  try {
    const findParametro = await Comercial_Parametros.findOne({
      tipoDeAnalisis,
      parametro,
      metodo,
    });
    if (findParametro) {
      return res.status(400).json({ message: "El parámetro ya existe" });
    }
    const newParametro = new Comercial_Parametros({
      tipoDeAnalisis,
      parametro,
      categoria,
      metodo,
      acreditadoPor,
      tipoDeAcreditacion,
      limiteDeCuantificacionDelMetodo,
      limiteDeDeteccionDelMetodo,
      unidadDeMedida,
      precio,
    });
    await newParametro.save();
    res
      .status(201)
      .json({ message: "Parámetro creado exitosamente", newParametro });
  } catch (error) {
    console.error("Error al crear el parámetro:", error);
    res
      .status(500)
      .json({ message: "Error al crear el parámetro", error: error.message });
  }
};

module.exports = postParametro;
