const Comercial_Parametros = require("../../../models/Comercial/Parametros");
const escapeRegExp = require("../../../utils/escapeRegex");

const getParametrosPagination = async (req, res) => {
  try {
    const { limit = 10, page = 0, search = "" } = req.query;
    const query = {};
    if (search) {
      const safeSearch = escapeRegExp(search);
      const regex = new RegExp(safeSearch, "i");
      query.$or = [
        { tipoDeAnalisis: regex },
        { parametro: regex },
        { metodo: regex },
        { categoria: regex },
      ];
    }
    const [data, total] = await Promise.all([
      Comercial_Parametros.find(query)
        .skip(Number(page) * Number(limit))
        .limit(Number(limit))
        .lean()
        .sort({ createdAt: -1 }),
      Comercial_Parametros.countDocuments(query),
    ]);
    return res.status(200).json({ data, total });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = getParametrosPagination;
