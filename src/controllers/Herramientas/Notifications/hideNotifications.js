const Notification = require("../../../Models/Herramientas/Notification");

const visibleToUser = (user) => {
  const submodules = (user.modules || []).map((item) => item.submodule?.name).filter(Boolean).map((name) => name.toUpperCase());
  return {
    "hiddenBy.userId": { $ne: user._id },
    $or: [
      { type: "GLOBAL" },
      { type: "SUBMODULE", submodule: { $in: submodules } },
      { type: "INDIVIDUAL", receiver: user._id },
    ],
  };
};

// No se borran notificaciones globales para otros usuarios: se eliminan solo
// de la bandeja del usuario que hizo la acción, igual que la eliminación unitaria.
const hideNotifications = async (req, res) => {
  try {
    const { ids, all } = req.body || {};
    if (!all && (!Array.isArray(ids) || ids.length === 0)) {
      return res.status(400).json({ message: "Selecciona notificaciones o indica que deseas vaciar la bandeja", type: "Advertencia" });
    }

    const filter = visibleToUser(req.user);
    if (!all) filter._id = { $in: ids };
    const notifications = await Notification.find(filter).select("_id type").lean();
    const notificationIds = notifications.map((item) => item._id);
    if (!notificationIds.length) return res.json({ message: "No hay notificaciones para eliminar", type: "Informacion", count: 0 });

    const now = new Date();
    await Notification.updateMany(
      { _id: { $in: notificationIds } },
      { $push: { hiddenBy: { userId: req.user._id, hiddenAt: now } } }
    );
    const individualIds = notifications.filter((item) => item.type === "INDIVIDUAL").map((item) => item._id);
    const sharedIds = notifications.filter((item) => item.type !== "INDIVIDUAL").map((item) => item._id);
    if (individualIds.length) await Notification.updateMany({ _id: { $in: individualIds } }, { $set: { isReadIndividual: true } });
    if (sharedIds.length) await Notification.updateMany({ _id: { $in: sharedIds }, "readBy.userId": { $ne: req.user._id } }, { $push: { readBy: { userId: req.user._id, readAt: now } } });

    return res.json({ message: all ? "Bandeja de notificaciones vaciada" : "Notificaciones eliminadas de tu bandeja", type: "Correcto", count: notificationIds.length });
  } catch (error) {
    return res.status(500).json({ message: error.message, type: "Error" });
  }
};

module.exports = hideNotifications;
