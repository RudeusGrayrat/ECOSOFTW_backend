require("dotenv").config();

const mongoose = require("mongoose");

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL en el .env");
  await mongoose.connect(process.env.DATABASE_URL);

  const collection = mongoose.connection.collection("operaciones_informes_ensayos");
  const indexes = await collection.indexes();
  const idAccesoIndex = indexes.find((index) => index.unique && index.key?.idAcceso === 1);

  if (!idAccesoIndex) {
    console.log("No existe índice único de idAcceso. Nada que cambiar.");
    return;
  }

  await collection.dropIndex(idAccesoIndex.name);
  console.log(`Índice único eliminado: ${idAccesoIndex.name}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
