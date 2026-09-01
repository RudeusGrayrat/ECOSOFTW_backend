const Permissions = require("../../../Models/Herramientas/Permission");
const escapeRegExp = require("../../../utils/escapeRegex");

const getPermissionsPaginacion = async (req, res) => {
  const { limit = 10, page = 0, search = "" } = req.query;
  try {
    const query = {};
    if (search) {
      const safeSearch = escapeRegExp(search);
      const regex = new RegExp(safeSearch, "i");
      query.$or = [
        { name: regex },
        { description: regex },
      ];

      if (/^activo$/i.test(search)) query.$or.push({ active: true });
      if (/^inactivo$/i.test(search)) query.$or.push({ active: false });
    }

    const [permissions, total] = await Promise.all([
      Permissions.find(query)
        .skip(Number(page) * Number(limit))
        .limit(Number(limit))
        .lean()
        .sort({ createdAt: -1 }),
      Permissions.countDocuments(query),
    ]);

    const data = permissions.map((permission) => ({
      ...permission,
      estado: permission.active ? "ACTIVO" : "INACTIVO",
    }));

    return res.status(200).json({ data, total });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = getPermissionsPaginacion;
