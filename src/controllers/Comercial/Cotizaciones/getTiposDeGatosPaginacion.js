const Comercial_TiposDeGastos = require("../../../Models/Comercial/TipoDeGastos");
const escapeRegExp = require("../../../utils/escapeRegex");

const getTiposDeGastosPaginacion = async (req, res) => {
  const { limit = 10, page = 0, search = "" } = req.query;
  try {
    const query = {};
    if (search) {
      const safeSearch = escapeRegExp(search);
      const regex = new RegExp(safeSearch, "i");
      query.$or = [
        { tipoDeGasto: regex },
        { descripcion: regex },
        { precio: regex },
        { estado: regex },
      ];
    }
    const [data, total] = await Promise.all([
      Comercial_TiposDeGastos.find(query)
        .skip(Number(page) * Number(limit))
        .limit(Number(limit))
        .lean()
        .sort({ createdAt: -1 }),
      Comercial_TiposDeGastos.countDocuments(query),
    ]);
    return res.status(200).json({ data, total });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
module.exports = getTiposDeGastosPaginacion;
