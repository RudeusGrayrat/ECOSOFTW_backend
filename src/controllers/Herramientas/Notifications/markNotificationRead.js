const Notification = require("../../../Models/Herramientas/Notification");

const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ message: "Notificacion no encontrada" });

    if (notification.type === "INDIVIDUAL") {
      if (notification.receiver?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "No puedes leer esta notificacion" });
      }
      notification.isReadIndividual = true;
    } else if (!notification.readBy.some((item) => item.userId?.toString() === req.user._id.toString())) {
      notification.readBy.push({ userId: req.user._id, readAt: new Date() });
    }

    await notification.save();
    res.json({ message: "Notificacion leida", data: notification });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = markNotificationRead;
