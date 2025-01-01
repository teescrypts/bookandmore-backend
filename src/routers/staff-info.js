const express = require("express");
const auth = require("../middleware/auth");
const StaffInfo = require("../models/staff-info");
const Branch = require("../models/branch");
const checkPermission = require("../utils/check-permission");
const User = require("../models/user");
const router = new express.Router();

router.get("/api/staff-infos", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (admin, branch) => {
    const staffInfo = await StaffInfo.find({ admin, branch })
      .populate({
        path: "staff",
        select: "fname lname email active",
      })
      .select("type commission");

    res.status(201).send({ message: staffInfo });
  };

  try {
    switch (user.type) {
      case "admin": {
        const activeBranch = await Branch.findOne({
          active: true,
          admin: user._id,
        }).select("_id");

        if (!activeBranch) {
          throw new Error("No active branch found");
        }

        await eventHandler(user._id, activeBranch._id);
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("staffs", user._id);

        if (!isPermitted) {
          return res.send({ error: "Invalid Operation" });
        }

        await eventHandler(user.admin, user.branch);
        break;
      }

      default:
        throw new Error("Invalid Opearation");
        break;
    }
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

router.delete("/api/staff-infos/:id", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async () => {
    const deletedStaff = await StaffInfo.findByIdAndDelete(req.params.id);
    await User.findByIdAndDelete(deletedStaff.staff);
  };

  try {
    switch (user.type) {
      case "admin": {
        await eventHandler();
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("staffs", user._id);

        if (!isPermitted) {
          return res.send({ error: "Invalid Operation" });
        }

        await eventHandler();
        break;
      }

      default:
        throw new Error("Invalid Opearation");
        break;
    }

    res.status(201).send({ message: "Staff Deleted" });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

module.exports = router;
