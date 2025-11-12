const express = require("express");
const morgan = require("morgan");
// const cors = requiequire("socket.io"); // Importar socket.io
const dotenv = require("dotenv");
dotenv.config();
const cookieParser = require("cookie-parser");
const routes = require("./routes/index");
const bodyParser = require("body-parser");
// const fileUpload = require("express-fileupload"); //permite subir archivos al servidor
const http = require("http"); // Importar http para usarlo con Socket.IO
const tokenVerify = require("./controllers/auth/midellware");
const { FRONTEND_URL, FRONTEND2_URL } = process.env;

const allowedOrigins = [
  FRONTEND_URL?.toString(),
  FRONTEND2_URL?.toString(),
  "http://localhost:5174", // Agrega cualquier otro dominio si es necesario
];

const app = express();

// Configuración de CORS para Express
// app.use(fileUpload());
app.use(morgan("dev"));
app.use(bodyParser.json());

// Middleware de CORS
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    return next();
  }

  return tokenVerify(req, res, next);
});

app.use(cookieParser());
app.use(express.json());
app.use("/api", routes);

// Crear el servidor HTTP para Express
const httpServer = http.createServer(app);

// Configurar Socket.IO y habilitar CORS
// const io = socketIo(httpServer, {
//   cors: {
//     origin: allowedOrigins, // Usar el array de URLs permitidas
//     methods: ["GET", "POST"],
//     credentials: true, // Permitir credenciales
//   },
// });
// app.set("io", io); // <- ESTO es lo que falta

// io.on("connection", (socket) => {
//   // El frontend debe enviar el ID del usuario al conectarse
//   socket.on("register", (employeeId) => {
//     socket.join(employeeId); // Así puedes senviarle mensajes individualmente
//     console.log(`Socket ${socket.id} unido a ${employeeId}`);
//   });

//   socket.on("disconnect", () => {
//     console.log(`Socket ${socket.id} desconectado`);
//   });
// });

module.exports = { app, httpServer }; // Exporta tanto la app como el servidor
