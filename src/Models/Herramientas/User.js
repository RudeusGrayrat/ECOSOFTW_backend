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
    email: {
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
    modules: [
      {
        name: {
          type: String,
          ref: "Module",
        },
        submodule: {
          name: {
            type: String,
            ref: "Submodule",
          },
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
