const mongoose = require("mongoose");

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
