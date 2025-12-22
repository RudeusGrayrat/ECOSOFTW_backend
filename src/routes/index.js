const { Router } = require("express");

const comercialRouter = require("./Modulos/Comercial");
const verifyToken = require("../controllers/auth/verifyToken");
const herramientasRouter = require("./Modulos/Herramientas");
const login = require("../controllers/Herramientas/User/login");

const router = Router();

// router.post("/registerUser", registerUser);
router.post("/login", login);
// router.post("/logout", logout);

router.get("/auth/verify", verifyToken);

router.use("/comercial", comercialRouter);
router.use("/herramientas", herramientasRouter);

module.exports = router;
