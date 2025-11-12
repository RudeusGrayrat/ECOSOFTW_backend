const Comercial_Clientes = require("../../../Models/Comercial/Clientes");

const getClientesPaginacion = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const clientes = await Cliente.find({
      nombre: { $regex: search, $options: "i" },
    })
      .skip((page - 1) * limit)
      .limit(limit);
    const total = await Comercial_Clientes.countDocuments({
      nombre: { $regex: search, $options: "i" },
    });
    res.json({ clientes, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
module.exports = getClientesPaginacion;
