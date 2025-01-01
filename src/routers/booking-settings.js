const express = require("express");
const auth = require("../middleware/auth");
const BookingSettings = require("../models/booking-settings");
const Branch = require("../models/branch");
const checkPermission = require("../utils/check-permission");
const router = new express.Router();

router.post("/api/booking-settings", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (admin, branch) => {
    const existingSettings = await BookingSettings.countDocuments({
      admin,
      branch,
    });

    if (existingSettings === 1) {
      return res.send({
        error: "There is an existing Set up for this branch.",
      });
    }

    const bookingSettings = new BookingSettings({
      admin,
      branch,
      ...req.body,
    });

    await bookingSettings.save();
  };

  try {
    switch (user.type) {
      case "admin": {
        const activeBranch = await Branch.findOne({
          active: true,
          admin: user._id,
        }).select("_id");

        if (!activeBranch) {
          return res.send({ message: "No active branch found" });
        }

        await eventHandler(user._id, activeBranch._id);
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("settings", user._id);

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

    res.status(201).send({ message: "Settings Uploaded " });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

router.get("/api/booking-settings", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (admin, branch) => {
    const settings = await BookingSettings.findOne({ admin, branch });
    res.status(201).send({ message: settings });
  };

  try {
    switch (user.type) {
      case "admin": {
        const activeBranch = await Branch.findOne({
          active: true,
          admin: user._id,
        }).select("_id");

        if (!activeBranch) {
          return res.send({ message: "No active branch found" });
        }

        await eventHandler(user._id, activeBranch._id);
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("settings", user._id);

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
    console.log(e);
    return res.status(400).send({ error: e.message });
  }
});

router.patch("/api/booking-settings/:id", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async () => {
    const updates = Object.keys(req.body);
    const allowedUpdates = [
      "policy",
      "rescheduling",
      "leadTime",
      "bookingWindow",
    ];
    const isValidOperation = updates.every((update) =>
      allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
      return res.status(400).send({ error: "Invalid updates!" });
    }

    const bookingSettings = await BookingSettings.findOne({
      _id: req.params.id,
    });

    if (!bookingSettings) {
      return res.status(404).send({ error: "Invalid Operation" });
    }

    updates.forEach((update) => (bookingSettings[update] = req.body[update]));
    await bookingSettings.save();
  };

  try {
    switch (user.type) {
      case "admin":
        await eventHandler();
        break;

      case "staff": {
        const isPermitted = await checkPermission("settings", user._id);

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

    res.status(201).send({ message: "Settings Updated" });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

module.exports = router;
