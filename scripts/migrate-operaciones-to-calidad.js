require("dotenv").config();

const mongoose = require("mongoose");
const Module = require("../src/Models/Herramientas/Modulo");
const Submodule = require("../src/Models/Herramientas/Submodulo");
const User = require("../src/Models/Herramientas/User");

const normalize = (value = "") => value.toString().trim().toUpperCase();
const isQualityModule = (value) => ["OPERACIONES", "CALIDAD"].includes(normalize(value));

async function resolveQualityModule() {
  const oldModule = await Module.findOne({ $or: [{ name: "OPERACIONES" }, { slug: "operaciones" }] });
  const currentModule = await Module.findOne({ $or: [{ name: "CALIDAD" }, { slug: "calidad" }] });

  if (currentModule) {
    currentModule.name = "CALIDAD";
    currentModule.slug = "calidad";
    currentModule.icon = "CALIDAD.svg";
    currentModule.active = true;
    await currentModule.save();

    if (oldModule && oldModule._id.toString() !== currentModule._id.toString()) {
      await Module.deleteOne({ _id: oldModule._id });
    }

    return currentModule;
  }

  if (oldModule) {
    oldModule.name = "CALIDAD";
    oldModule.slug = "calidad";
    oldModule.icon = "CALIDAD.svg";
    oldModule.active = true;
    await oldModule.save();
    return oldModule;
  }

  return Module.create({
    name: "CALIDAD",
    slug: "calidad",
    icon: "CALIDAD.svg",
    order: 2,
    active: true,
  });
}

async function migrateUsers(moduleDoc) {
  const users = await User.find({ "modules.name": { $in: ["OPERACIONES", "CALIDAD"] } });
  let updatedUsers = 0;

  for (const user of users) {
    const regularAccess = [];
    const qualityAccessBySubmodule = new Map();

    for (const access of user.modules || []) {
      const plainAccess = access.toObject ? access.toObject() : access;

      if (!isQualityModule(plainAccess.name)) {
        regularAccess.push(plainAccess);
        continue;
      }

      const submoduleName = normalize(plainAccess.submodule?.name);
      if (!submoduleName) continue;

      const existing = qualityAccessBySubmodule.get(submoduleName) || {
        name: "CALIDAD",
        moduleId: moduleDoc._id,
        submodule: {
          name: plainAccess.submodule.name,
          submoduleId: plainAccess.submodule.submoduleId,
          permissions: [],
        },
      };

      existing.submodule.permissions = Array.from(new Set([
        ...(existing.submodule.permissions || []),
        ...(plainAccess.submodule?.permissions || []),
      ]));

      qualityAccessBySubmodule.set(submoduleName, existing);
    }

    user.modules = [...regularAccess, ...qualityAccessBySubmodule.values()];
    await user.save();
    updatedUsers += 1;
  }

  return updatedUsers;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL en el .env");

  await mongoose.connect(process.env.DATABASE_URL);

  const moduleDoc = await resolveQualityModule();
  const submodulesResult = await Submodule.updateMany(
    { module: { $in: ["OPERACIONES", "CALIDAD"] } },
    { $set: { module: "CALIDAD", moduleId: moduleDoc._id, active: true } }
  );
  const updatedUsers = await migrateUsers(moduleDoc);

  console.log("Migracion OPERACIONES -> CALIDAD completada.");
  console.log(`Modulo final: ${moduleDoc.name} (${moduleDoc.slug})`);
  console.log(`Submodulos actualizados: ${submodulesResult.modifiedCount}`);
  console.log(`Usuarios actualizados: ${updatedUsers}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
