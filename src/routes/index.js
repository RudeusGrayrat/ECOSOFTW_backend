const { Router } = require("express");

const comercialRouter = require("./Modulos/Comercial");
const verifyToken = require("../controllers/auth/verifyToken");
const herramientasRouter = require("./Modulos/Herramientas");
const calidadRouter = require("./Modulos/Calidad");
const login = require("../controllers/Herramientas/User/login");
const requireAuth = require("../controllers/auth/requireAuth");
const getResumenDashboard = require("../controllers/Dashboard/getResumenDashboard");

const router = Router();

// router.post("/registerUser", registerUser);
router.post("/login", login);
// router.post("/logout", logout);

router.get("/auth/verify", verifyToken);
router.get("/dashboard/resumen", requireAuth, getResumenDashboard);

router.use("/comercial", comercialRouter);
router.use("/herramientas", herramientasRouter);
router.use("/calidad", calidadRouter);
router.use("/operaciones", calidadRouter);

module.exports = router;
