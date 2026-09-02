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
const socketIo = require("socket.io");
const tokenVerify = require("./controllers/auth/midellware");
const attachUser = require("./controllers/auth/attachUser");
const notifyActionMiddleware = require("./controllers/Herramientas/Notifications/notifyActionMiddleware");
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
app.use(attachUser);
app.use(notifyActionMiddleware);
app.use("/api", routes);

// Crear el servidor HTTP para Express
const httpServer = http.createServer(app);

const io = socketIo(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    credentials: true,
  },
});

app.set("io", io);

io.on("connection", (socket) => {
  socket.on("register_session", ({ userId, submodules }) => {
    if (!userId) return;
    socket.join(userId.toString());
    socket.join("ERP_GLOBAL");

    if (Array.isArray(submodules)) {
      submodules.forEach((submodule) => {
        if (submodule) socket.join(`SUBMODULE_${submodule.toString().toUpperCase()}`);
      });
    }
  });
});

module.exports = { app, httpServer }; // Exporta tanto la app como el servidor
