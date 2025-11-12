const logout = async (req, res) => {
    try {
        res.cookie("token", "", { expires: new Date(0) })
        return res.status(200).json({ message: "logou correctamente" })
    } catch (error) {
        return res.status(500).json({ message: error.message })
    }

}
module.exports = logout