const Proveedor = require("../../../Models/Comercial/Proveedores");
exports.listar = async (req, res) => {
  const filter = req.query.todos === "true" ? {} : { estado: "ACTIVO" };
  return res.json({ data: await Proveedor.find(filter).sort({ nombre: 1 }) });
};
exports.crear = async (req, res) => { try { const data = await Proveedor.create({ nombre: req.body.nombre }); return res.status(201).json({ data, message: "Proveedor creado", type: "Correcto" }); } catch (error) { return res.status(400).json({ message: error.message, type: "Error" }); } };
exports.actualizar = async (req, res) => {
  const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => ["nombre", "estado"].includes(key)));
  const data = await Proveedor.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true });
  return data ? res.json({ data, message: "Proveedor actualizado", type: "Correcto" }) : res.status(404).json({ message: "Proveedor no encontrado", type: "Error" });
};
