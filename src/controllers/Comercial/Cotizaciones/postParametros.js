const Comercial_Parametros = require("../../../Models/Comercial/Parametros");

const postParametro = async (req, res) => {
  const {
    tipoDeAnalisis,
    nombreCorto,
    parametro,
    componentes,
    tipoItem,
    unidadCobro,
    categoria,
    metodo,
    acreditadoPor,
    tipoDeAcreditacion,
    limiteDeCuantificacionDelMetodo,
    limiteDeDeteccionDelMetodo,
    unidadDeMedida,
    precio,
    vigenciaDesde,
    vigenciaHasta,
  } = req.body;
  try {
    if (!String(nombreCorto || "").trim()) {
      return res.status(400).json({ message: "El nombre corto para cotizar es obligatorio", type: "Advertencia" });
    }
    if (!["INDIVIDUAL", "PAQUETE", "CAMPO"].includes(tipoItem)) {
      return res.status(400).json({ message: "Selecciona el tipo de ítem cotizable", type: "Advertencia" });
    }
    if (!["POR_UNIDAD", "POR_PUNTO", "POR_MUESTRA", "POR_DIA", "POR_CAMPANA", "POR_EQUIPO"].includes(unidadCobro)) {
      return res.status(400).json({ message: "Selecciona la unidad de cobro", type: "Advertencia" });
    }
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
      nombreCorto,
      parametro,
      componentes: Array.isArray(componentes) ? componentes.map((item) => String(item).trim()).filter(Boolean) : [],
      tipoItem,
      unidadCobro,
      categoria,
      metodo,
      acreditadoPor,
      tipoDeAcreditacion,
      limiteDeCuantificacionDelMetodo,
      limiteDeDeteccionDelMetodo,
      unidadDeMedida,
      precio,
      vigenciaDesde: vigenciaDesde || undefined,
      vigenciaHasta: vigenciaHasta || undefined,
    });
    await newParametro.save();
    res
      .status(201)
      .json({ message: "Parámetro creado exitosamente", newParametro });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al crear el parámetro", error: error.message });
  }
};

module.exports = postParametro;
