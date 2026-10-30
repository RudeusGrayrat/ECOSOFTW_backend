const Comercial_Clientes = require("../../../Models/Comercial/Clientes");

const upper = (value) => typeof value === "string" ? value.trim().toUpperCase() : value;

const patchCliente = async (req, res) => {
    const { id } = req.params;
    const {
        tipoCliente,
        cliente,
        numeroDocumento,
        nombreContacto,
        telefono,
        correoElectronico,
        direccionLegal,
        estado,
    } = req.body;

    try {
        const findCliente = await Comercial_Clientes.findById(id)
        if (!findCliente) {
            return res.status(404).json({ message: "Cliente no encontrado", type: "Error" });
        }

        if (tipoCliente) findCliente.tipoCliente = tipoCliente;
        if (cliente) findCliente.cliente = upper(cliente);
        if (numeroDocumento) findCliente.numeroDocumento = upper(numeroDocumento);
        if (nombreContacto) findCliente.nombreContacto = upper(nombreContacto);
        if (telefono) findCliente.telefono = telefono;
        if (correoElectronico) findCliente.correoElectronico = correoElectronico;
        if (direccionLegal) findCliente.direccionLegal = direccionLegal;
        if (estado) findCliente.estado = estado;

        const updatedCliente = await findCliente.save();

        res.status(200).json({
            message: "Cliente actualizado exitosamente", data: updatedCliente,
            type: "Correcto"
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = patchCliente;
