require("dotenv").config();
const { PORT } = process.env;
const { httpServer } = require("./src/app"); // Importar el servidor con Socket.IO integrado
const connectDB = require("./src/dbConnection");

// Conectar a la base de datos
connectDB();

// Iniciar el servidor
httpServer.listen(PORT || 3002, () => {
  console.log(`Servidor corriendo en el puerto ${PORT || 3002}`);
});
