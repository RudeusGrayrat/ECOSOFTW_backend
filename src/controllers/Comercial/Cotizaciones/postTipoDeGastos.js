const Comercial_TiposDeGastos = require("../../../Models/Comercial/TipoDeGastos");

const postTiposDeGastos = async (req, res) => {
  const { tipoDeGasto, codigo, categoria, descripcion, precio, origen = "MANUAL", unidadReferencia = "FIJO", vigenciaDesde, vigenciaHasta } = req.body;
  try {
    const codigoNormalizado = String(codigo || "").trim().toUpperCase();
    if (!tipoDeGasto || !codigoNormalizado || !categoria || !descripcion || precio == null) {
      return res.status(400).json({
        message: "Faltan datos obligatorios para crear el tipo de gasto",
      });
    }
    if (!/^[A-Z][A-Z0-9_]{2,49}$/.test(codigoNormalizado)) return res.status(400).json({ message: "El código debe usar mayúsculas, números o guiones bajos (ej.: COMBUSTIBLE).", type: "Advertencia" });
    if (!["MANUAL", "CALCULADORA_LOGISTICA"].includes(origen)) return res.status(400).json({ message: "Origen de gasto no válido.", type: "Advertencia" });
    if (!["FIJO", "POR_UNIDAD", "POR_DIA", "POR_PERSONA_DIA", "POR_KM", "POR_GALON"].includes(unidadReferencia)) return res.status(400).json({ message: "Unidad de referencia no válida.", type: "Advertencia" });
    const findTiposDeGasto = await Comercial_TiposDeGastos.findOne({
      codigo: codigoNormalizado,
    });
    if (findTiposDeGasto) {
      return res.status(409).json({
        message: "El tipo de gasto ya existe",
      });
    }
    if (!["OPERATIVO", "ADMINISTRATIVO"].includes(categoria)) {
      return res.status(400).json({ message: "Selecciona si el gasto es operativo o administrativo.", type: "Advertencia" });
    }
    if (origen === "CALCULADORA_LOGISTICA" && categoria !== "OPERATIVO") return res.status(400).json({ message: "Los conceptos de calculadora logística deben ser gastos operativos.", type: "Advertencia" });
    const nuevoTiposDeGasto = new Comercial_TiposDeGastos({
      tipoDeGasto,
      codigo: codigoNormalizado,
      categoria,
      descripcion,
      precio: parseFloat(precio).toFixed(2),
      origen,
      unidadReferencia,
      vigenciaDesde: vigenciaDesde || undefined,
      vigenciaHasta: vigenciaHasta || undefined,
    });
    await nuevoTiposDeGasto.save();
    res.status(201).json({
      message: "Tipo de gasto creado exitosamente",
      data: nuevoTiposDeGasto,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

module.exports = postTiposDeGastos;
