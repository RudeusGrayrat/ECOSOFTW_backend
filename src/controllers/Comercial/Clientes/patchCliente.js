const Comercial_Cliente = require("../../../models/Comercial/Clientes");

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
        const findCliente = await Comercial_Cliente.findById(id)
        if (!findCliente) {
            return res.status(404).json({ message: "Cliente no encontrado", type: "Error" });
        }

        if (tipoCliente) findCliente.tipoCliente = tipoCliente;
        if (cliente) findCliente.cliente = cliente;
        if (numeroDocumento) findCliente.numeroDocumento = numeroDocumento;
        if (nombreContacto) findCliente.nombreContacto = nombreContacto;
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