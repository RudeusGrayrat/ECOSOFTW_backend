const Notification = require("../../../Models/Herramientas/Notification");

const restoreNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ message: "Notificación no encontrada" });

    if (notification.type === "INDIVIDUAL" && notification.receiver?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "No puedes restaurar esta notificación" });
    }

    notification.hiddenBy = notification.hiddenBy.filter((item) => item.userId?.toString() !== req.user._id.toString());
    await notification.save();

    res.json({ message: "Notificación restaurada", type: "Correcto", data: notification });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = restoreNotification;
