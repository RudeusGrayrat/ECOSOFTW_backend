const Notification = require("../../../Models/Herramientas/Notification");

class NotificationService {
  static async send(io, data) {
    const notification = await Notification.create(data);
    if (!io) return notification;

    if (notification.type === "GLOBAL") {
      io.to("ERP_GLOBAL").emit("nuevaNotificacion", notification);
    }

    if (notification.type === "SUBMODULE") {
      io.to(`SUBMODULE_${notification.submodule}`).emit("nuevaNotificacion", notification);
    }

    if (notification.type === "INDIVIDUAL" && notification.receiver) {
      io.to(notification.receiver.toString()).emit("nuevaNotificacion", notification);
    }

    return notification;
  }
}

module.exports = NotificationService;
