const Comercial_Proyectos = require("../../../Models/Comercial/Proyectos");

const patchProyecto = async (req, res) => {
    const { id } = req.params;
    const {
        nombre,
        servicio,
        cliente_id,
        fechaServicio,
        cantidadPuntosParametros,
        lugarMuestreo,
        estado,
    } = req.body;
    try {
        if (!id) {
            return res.status(400).json({ message: "ID del proyecto es requerido" });
        }
        const findProyecto = await Comercial_Proyectos.findById(id);
        if (!findProyecto) {
            return res.status(404).json({ message: "Proyecto no encontrado" });
        }
        if (nombre) findProyecto.nombre = nombre;
        if (servicio) findProyecto.servicio = servicio;
        if (cliente_id) findProyecto.cliente_id = cliente_id;
        if (fechaServicio) findProyecto.fechaServicio = fechaServicio;
        if (cantidadPuntosParametros) findProyecto.cantidadPuntosParametros = cantidadPuntosParametros;
        if (lugarMuestreo) findProyecto.lugarMuestreo = lugarMuestreo;
        if (estado) findProyecto.estado = estado;
        await findProyecto.save();
        return res.status(200).json({ message: "Proyecto actualizado correctamente", type: "Correcto" });
    } catch (error) {
        console.error("Error al actualizar el proyecto:", error);
        return res.status(500).json({ message: "Error interno del servidor" });
    }
};

module.exports = patchProyecto;

