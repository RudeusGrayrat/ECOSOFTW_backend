const Comercial_Clientess = require("../../../models/Comercial/Clientes");

const postCliente = async (req, res) => {
  const {
    tipoCliente,
    cliente,
    numeroDocumento,
    nombreContacto,
    telefono,
    correoElectronico,
    direccionLegal,
  } = req.body;
  try {
    if (!tipoCliente || !cliente || !numeroDocumento || !telefono) {
      return res.status(400).json({ message: "Faltan datos obligatorios para crear el cliente" });
    }
    const findCliente = await Comercial_Clientess.findOne({
      cliente: cliente,
      numeroDocumento: numeroDocumento,
    });
    if (findCliente) {
      return res.status(409).json({ message: "El cliente con ese número de documento ya existe" });
    }
    const nuevoCliente = new Comercial_Clientess({
      tipoCliente,
      cliente,
      numeroDocumento,
      nombreContacto,
      telefono,
      correoElectronico,
      direccionLegal,
    })
    await nuevoCliente.save();
    res.status(201).json({ message: "Cliente creado exitosamente", data: nuevoCliente });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = postCliente;
