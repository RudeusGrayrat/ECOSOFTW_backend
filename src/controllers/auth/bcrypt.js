const bcrypt = require("bcrypt");

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  return hash;
};

const compare = async (pass, hashedPass) => {
  const res = await bcrypt.compare(pass, hashedPass);
  return res;
};

module.exports = {
  hashPassword,
  compare,
}