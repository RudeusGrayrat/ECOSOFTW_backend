require("dotenv").config();

const mongoose = require("mongoose");
const Module = require("../src/Models/Herramientas/Modulo");
const Submodule = require("../src/Models/Herramientas/Submodulo");
const Permission = require("../src/Models/Herramientas/Permission");
const User = require("../src/Models/Herramientas/User");

const adminUserName = process.env.SEED_ADMIN_USER || "MiguelAdmin1";
const permissionNames = ["VER", "CREAR", "EDITAR", "ELIMINAR", "APROBAR", "DESAPROBAR", "REPORTAR", "ENVIAR"];
const modules = [
  {
    name: "HERRAMIENTAS",
    slug: "herramientas",
    icon: "HERRAMIENTAS.svg",
    order: 99,
    submodules: [
      { name: "MODULOS Y SUBMODULOS", slug: "modulos y submodulos", order: 1 },
      { name: "PERMISOS", slug: "permisos", order: 2 },
      { name: "USUARIOS", slug: "usuarios", order: 3 },
    ],
  },
  {
    name: "OPERACIONES",
    slug: "operaciones",
    icon: "OPERACIONES.svg",
    order: 2,
    submodules: [
      { name: "INFORMES DE ENSAYO", slug: "informes de ensayo", order: 1 },
      { name: "CONFIGURACION", slug: "configuracion", order: 2 },
    ],
  },
];

const normalize = (value) => value.toString().trim().toUpperCase();

async function upsertPermission(name) {
  return Permission.findOneAndUpdate(
    { name },
    { $set: { name, active: true }, $setOnInsert: { description: name } },
    { new: true, upsert: true }
  );
}

async function upsertModule(moduleData) {
  return Module.findOneAndUpdate(
    { name: moduleData.name },
    {
      $set: {
        name: moduleData.name,
        slug: moduleData.slug,
        icon: moduleData.icon,
        order: moduleData.order,
        active: true,
      },
    },
    { new: true, upsert: true }
  );
}

async function upsertSubmodule(moduleDoc, submoduleData) {
  return Submodule.findOneAndUpdate(
    { name: submoduleData.name, module: moduleDoc.name },
    {
      $set: {
        name: submoduleData.name,
        module: moduleDoc.name,
        moduleId: moduleDoc._id,
        slug: submoduleData.slug,
        order: submoduleData.order,
        active: true,
      },
    },
    { new: true, upsert: true }
  );
}

function upsertUserAccess(user, moduleDoc, submoduleDoc) {
  const moduleName = normalize(moduleDoc.name);
  const submoduleName = normalize(submoduleDoc.name);
  const index = user.modules.findIndex(
    (item) => normalize(item.name) === moduleName && normalize(item.submodule?.name || "") === submoduleName
  );

  const access = {
    name: moduleDoc.name,
    moduleId: moduleDoc._id,
    submodule: {
      name: submoduleDoc.name,
      submoduleId: submoduleDoc._id,
      permissions: permissionNames,
    },
  };

  if (index >= 0) user.modules[index] = access;
  else user.modules.push(access);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL en el .env");

  await mongoose.connect(process.env.DATABASE_URL);

  await Promise.all(permissionNames.map(upsertPermission));

  const admin = await User.findOne({ userName: adminUserName });
  const createdSubmodules = [];

  for (const moduleData of modules) {
    const moduleDoc = await upsertModule(moduleData);
    for (const submoduleData of moduleData.submodules) {
      const submoduleDoc = await upsertSubmodule(moduleDoc, submoduleData);
      createdSubmodules.push(`${moduleDoc.name} / ${submoduleDoc.name}`);
      if (admin) upsertUserAccess(admin, moduleDoc, submoduleDoc);
    }
  }

  if (admin) await admin.save();

  console.log("Seed de permisos base completado.");
  console.log(`Submodulos activos: ${createdSubmodules.join(", ")}`);
  console.log(admin ? `Permisos completos asignados a ${adminUserName}.` : `Usuario ${adminUserName} no encontrado; solo se crearon catalogos.`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
