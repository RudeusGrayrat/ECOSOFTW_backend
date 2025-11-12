const Comercial_Clientes = require("../../../Models/Comercial/Clientes");

const postCliente = async (req, res) => {
  const {
    tipoDocumento,
    numeroDocumento,
    nombreContacto,
    proyecto,
    telefono,
    correo,
    servicio,
    cantidadPuntosParametros,
    lugarMuestreo,
    fechaServicio,
    direccionLegal,
  } = req.body;
  try {
    const cliente = new Comercial_Clientes(req.body);
    await cliente.save();
    res.status(201).json(cliente);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = postCliente;
