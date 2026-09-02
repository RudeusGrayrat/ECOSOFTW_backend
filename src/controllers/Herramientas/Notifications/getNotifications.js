const Notification = require("../../../Models/Herramientas/Notification");

const getNotifications = async (req, res) => {
  const { page = 0, limit = 10 } = req.query;
  const user = req.user;

  try {
    const submodules = (user.modules || [])
      .map((item) => item.submodule?.name)
      .filter(Boolean)
      .map((name) => name.toUpperCase());

    const visibleFilter = {
      creator: { $ne: user._id },
      $or: [
        { type: "GLOBAL" },
        { type: "SUBMODULE", submodule: { $in: submodules } },
        { type: "INDIVIDUAL", receiver: user._id },
      ],
    };

    const unreadFilter = {
      ...visibleFilter,
      $and: [
        {
          $or: [
            { type: "INDIVIDUAL", isReadIndividual: false },
            { type: { $in: ["GLOBAL", "SUBMODULE"] }, "readBy.userId": { $ne: user._id } },
          ],
        },
      ],
    };

    const [data, total, unread] = await Promise.all([
      Notification.find(visibleFilter)
        .sort({ createdAt: -1 })
        .skip(Number(page) * Number(limit))
        .limit(Number(limit))
        .lean(),
      Notification.countDocuments(visibleFilter),
      Notification.countDocuments(unreadFilter),
    ]);

    res.json({ data, total, unread });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = getNotifications;
