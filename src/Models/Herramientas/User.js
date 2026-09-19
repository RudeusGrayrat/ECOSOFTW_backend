const mongoose = require("mongoose");
const assetSchema = new mongoose.Schema({ path: String, filename: String, mimetype: String, bytes: Number, updatedAt: Date }, { _id: false });

const userEcosoftSchema = mongoose.Schema(
  {
    userName: {
      type: String,
      required: true,
      unique: true,
    },
    colaborador: {
      type: String
    },
    correoElectronico: {
      type: String,
    },
    puesto: {
      type: String,
    },
    telefono: {
      type: String,
    },
    password: {
      type: String,
      required: true,
    },
    photo: {
      type: String,
    },
    firma: { type: String },
    photoArchivo: assetSchema,
    firmaArchivo: assetSchema,
    estado: {
      type: String,
      default: "ACTIVO",
    },
    modules: [
      {
        name: {
          type: String,
          ref: "Module",
        },
        moduleId: { type: mongoose.Schema.Types.ObjectId, ref: "Module" },
        submodule: {
          name: {
            type: String,
            ref: "Submodule",
          },
          submoduleId: { type: mongoose.Schema.Types.ObjectId, ref: "Submodule" },
          permissions: [
            {
              type: String,
              ref: "Permission",
            },
          ],
        },
      },
    ],
  },
  { timestamps: true }
);

const UserEcosoft = mongoose.model("UserEcosoft", userEcosoftSchema);

module.exports = UserEcosoft;
