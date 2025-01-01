const express = require("express");
const auth = require("../middleware/auth");
const Rent = require("../models/rent");
const Branch = require("../models/branch");
const RentForm = require("../models/rent-form");
const checkPermission = require("../utils/check-permission");
const router = new express.Router();

router.get("/api/rents", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (branch, admin) => {
    const rents = await Rent.find({ branch, admin })
      .populate({
        path: "tenant",
        select: "fname lname email",
      })
      .select("paidOn dueOn status tenant");
    const pendingFormCount = await RentForm.countDocuments({ branch, admin });
    res.status(200).send({ message: { rents, pendingFormCount } });
  };

  try {
    switch (user.type) {
      case "admin": {
        const activeBranch = await Branch.findOne({
          active: true,
          admin: user._id,
        }).select("_id");

        await eventHandler(activeBranch._id, user._id);
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("rent", user._id);

        if (!isPermitted) {
          return res.send({ error: "Invalid Operation" });
        }

        await eventHandler(user.branch, user.admin);
        break;
      }

      default:
        throw new Error("Invalid Operation");
        break;
    }
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

module.exports = router;
