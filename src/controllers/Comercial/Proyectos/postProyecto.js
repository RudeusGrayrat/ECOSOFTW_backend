const Comercial_Proyectos = require("../../../Models/Comercial/Proyectos");

const postProyectos = async (req, res) => {
  const {
    cliente_id,
    nombre,
    servicio,
    fechaServicio,
    cantidadPuntosParametros,
    lugarMuestreo,
    estado,
  } = req.body;
  try {
    if (!cliente_id || !nombre || !servicio) {
      return res
        .status(400)
        .json({ message: "Faltan campos obligatorios en la solicitud." });
    }
    const nuevoProyecto = new Comercial_Proyectos({
      cliente_id,
      nombre,
      servicio,
      fechaServicio,
      cantidadPuntosParametros,
      lugarMuestreo,
      estado: "PENDIENTE",
    });
    await nuevoProyecto.save();

    res.status(201).json({ message: "Proyecto creado exitosamente." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = postProyectos;
