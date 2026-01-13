const Comercial_Clientes = require("../../../models/Comercial/Clientes");
const Comercial_Proyectos = require("../../../models/Comercial/Proyectos");

const postFormularioCotizacion = async (req, res) => {
    const {
        tipoCliente,
        cliente,
        numeroDocumento,
        nombreContacto,
        telefono,
        correoElectronico,
        direccionLegal,

        servicio,
        proyecto,
        cantidadPuntosParametros,
        lugarMuestreo,
        fechaServicio,
    } = req.body;
    try {
        //verificacion de datos
        if (!tipoCliente || !cliente || !numeroDocumento || !servicio || !proyecto) {
            return res.status(400).json({ message: "Faltan datos obligatorios.", type: "Advertencia" });
        }

        //aquí se buscaraá al cliente, si existe se asociará al proyecto, si no, se creará un nuevo cliente
        const findCliente = await Comercial_Clientes.findOne({ numeroDocumento: numeroDocumento });
        let clienteId;
        if (!findCliente) {
            const newCliente = new Comercial_Clientes({
                tipoCliente,
                cliente,
                numeroDocumento,
                nombreContacto,
                telefono,
                correoElectronico,
                direccionLegal,
            });
            await newCliente.save();
            clienteId = newCliente._id;
        } else {
            clienteId = findCliente._id;
        }

        //luego se creará el proyecto asociado al cliente,

        const newProyecto = new Comercial_Proyectos({
            cliente_id: clienteId,
            nombre: proyecto,
            servicio,
            cantidadPuntosParametros,
            lugarMuestreo,
            fechaServicio,
        });
        await newProyecto.save();


        return res.status(201).json({ message: "Recibimos sus datos, nos comunicaremos lo mas pronto posible.", type: "Correcto" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports = postFormularioCotizacion;
