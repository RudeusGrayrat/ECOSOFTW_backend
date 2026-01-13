const Comercial_Clientes = require("../../../models/Comercial/Clientes");

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
      return res.status(400).json({ message: "Faltan datos obligatorios para crear el cliente", type: "Advertencia" });
    }
    const findCliente = await Comercial_Clientes.findOne({
      cliente: cliente,
      numeroDocumento: numeroDocumento,
    });
    if (findCliente) {
      return res.status(409).json({ message: "El cliente con ese número de documento ya existe", type: "Error" });
    }
    const nuevoCliente = new Comercial_Clientes({
      tipoCliente,
      cliente,
      numeroDocumento,
      nombreContacto,
      telefono,
      correoElectronico,
      direccionLegal,
      estado: "ACTIVO",
    })
    await nuevoCliente.save();
    res.status(201).json({ message: "Cliente creado exitosamente", data: nuevoCliente, type: "Correcto" });
  } catch (error) {
    res.status(400).json({ message: error.message, type: "Error" });
  }
};

module.exports = postCliente;
