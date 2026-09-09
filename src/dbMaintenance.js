const ensureInformeIndexes = async (mongoose) => {
  const collection = mongoose.connection.collection("operaciones_informes_ensayos");
  const indexes = await collection.indexes();
  const idAccesoUniqueIndex = indexes.find((index) => index.unique && index.key?.idAcceso === 1);

  if (!idAccesoUniqueIndex) return;

  await collection.dropIndex(idAccesoUniqueIndex.name);
  console.log(`Índice único legado eliminado: ${idAccesoUniqueIndex.name}`);
};

const runDbMaintenance = async (mongoose) => {
  try {
    await ensureInformeIndexes(mongoose);
  } catch (error) {
    console.warn(`No se pudo validar índices de informes de ensayo: ${error.message}`);
  }
};

module.exports = runDbMaintenance;
