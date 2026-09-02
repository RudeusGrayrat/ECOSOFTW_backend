const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    type: { type: String, enum: ["GLOBAL", "SUBMODULE", "INDIVIDUAL"], required: true },
    module: { type: String, uppercase: true, trim: true },
    submodule: { type: String, uppercase: true, trim: true },
    action: { type: String, uppercase: true, trim: true },
    route: String,
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "UserEcosoft" },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: "UserEcosoft" },
    creatorName: String,
    targetEntity: {
      entityId: String,
      entityModel: String,
    },
    isReadIndividual: { type: Boolean, default: false },
    readBy: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "UserEcosoft" },
        readAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

notificationSchema.index({ type: 1, receiver: 1, isReadIndividual: 1 });
notificationSchema.index({ module: 1, submodule: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 5184000 });

module.exports = mongoose.model("herramientas_notificaciones", notificationSchema);
