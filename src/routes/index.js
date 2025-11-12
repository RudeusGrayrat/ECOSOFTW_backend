const { Router } = require("express");

const comercialRouter = require("./Modulos/Comercial");
const verifyToken = require("../Controllers/auth/verifyToken");
const herramientasRouter = require("./Modulos/Herramientas");
const login = require("../controllers/Herramientas/User/login");

const router = Router();

// router.post("/registerUser", registerUser);
router.post("/login", login);
// router.post("/logout", logout);

// router.delete("/deleteSubmodule", deleteSubmodule);
// router.delete("/deleteModule", deleteModule);
// router.delete("/deletePermission", deletePermission);

// router.patch("/updateModule", updateModule);
// router.patch("/updateSubModule", updateSubModule);
// router.patch("/updatePermission", updatePermission);

// router.get("/getModules", getModules);
// router.get("/getSubModules", getSubModules);
// router.get("/getPermissions", getPermissions);
router.get("/auth/verify", verifyToken);

router.use("/comercial", comercialRouter);
router.use("/herramientas", herramientasRouter);

module.exports = router;
