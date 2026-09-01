const UserEcosoft = require("../../../Models/Herramientas/User");
const escapeRegExp = require("../../../utils/escapeRegex");

const getUsuariosPaginacion = async (req, res) => {
  const { limit = 10, page = 0, search = "" } = req.query;
  try {
    const query = {};
    if (search) {
      const safeSearch = escapeRegExp(search);
      const regex = new RegExp(safeSearch, "i");
      query.$or = [
        { userName: regex },
        { colaborador: regex },
        { correoElectronico: regex },
        { puesto: regex },
        { estado: regex },
      ];
    }

    const [data, total] = await Promise.all([
      UserEcosoft.find(query)
        .select("-password")
        .skip(Number(page) * Number(limit))
        .limit(Number(limit))
        .lean()
        .sort({ createdAt: -1 }),
      UserEcosoft.countDocuments(query),
    ]);

    return res.status(200).json({ data, total });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = getUsuariosPaginacion;
