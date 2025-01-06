const User = require("../models/user");

const getAdminId = async () => {
  const admin = await User.findOne({
    email: "admin@bookandmore.com",
    type: "admin",
  }).select("_id");

  if (!admin) return null;

  const id = admin._id;
  return id;
};

module.exports = getAdminId;
