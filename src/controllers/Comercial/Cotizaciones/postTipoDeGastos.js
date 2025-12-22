const Comercial_TiposDeGastos = require("../../../models/Comercial/TipoDeGastos");

const postTiposDeGastos = async (req, res) => {
  const { tipoDeGasto, descripcion, precio } = req.body;
  try {
    if (!tipoDeGasto || !descripcion || precio == null) {
      return res.status(400).json({
        message: "Faltan datos obligatorios para crear el tipo de gasto",
      });
    }
    const findTiposDeGasto = await Comercial_TiposDeGastos.findOne({
      tipoDeGasto: tipoDeGasto,
      descripcion: descripcion,
      precio: precio,
    });
    if (findTiposDeGasto) {
      return res.status(409).json({
        message: "El tipo de gasto ya existe",
      });
    }
    const nuevoTiposDeGasto = new Comercial_TiposDeGastos({
      tipoDeGasto,
      descripcion,
      precio: parseFloat(precio).toFixed(2),
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
