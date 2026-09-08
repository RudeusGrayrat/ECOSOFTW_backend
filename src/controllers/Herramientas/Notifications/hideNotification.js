const Notification = require("../../../Models/Herramientas/Notification");

const hideNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ message: "Notificación no encontrada" });

    if (notification.type === "INDIVIDUAL" && notification.receiver?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "No puedes eliminar esta notificación" });
    }

    const alreadyHidden = notification.hiddenBy.some((item) => item.userId?.toString() === req.user._id.toString());
    if (!alreadyHidden) notification.hiddenBy.push({ userId: req.user._id, hiddenAt: new Date() });

    if (notification.type === "INDIVIDUAL") {
      notification.isReadIndividual = true;
    } else if (!notification.readBy.some((item) => item.userId?.toString() === req.user._id.toString())) {
      notification.readBy.push({ userId: req.user._id, readAt: new Date() });
    }

    await notification.save();
    res.json({ message: "Notificación eliminada de tu bandeja", type: "Correcto", data: notification });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = hideNotification;
