const express = require("express");
const auth = require("../middleware/auth");
const OpeningHour = require("../models/opening-hour");
const Branch = require("../models/branch");
const User = require("../models/user");
const checkPermission = require("../utils/check-permission");
const router = new express.Router();

router.post("/api/opening-hours", auth, async (req, res) => {
  const user = req.user;

  const { day, timeSlot } = req.body;

  const eventHandler = async (admin, branch) => {
    if (!timeSlot.from || !timeSlot.to) {
      return res
        .status(400)
        .send({ error: "Both 'from' and 'to' are required." });
    }

    if (
      ![
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ].includes(day)
    ) {
      return res.status(400).send({ error: "Invalid day specified." });
    }

    let openingHour = await OpeningHour.findOne({
      admin,
      branch,
      owner: user._id,
    });
    if (!openingHour) {
      openingHour = new OpeningHour({ admin, branch, owner: user._id });
    }

    openingHour[day] = openingHour[day].concat(timeSlot);

    await openingHour.save();
  };

  try {
    switch (user.type) {
      case "admin": {
        const activeBranch = await Branch.findOne({
          admin: user._id,
          active: true,
        }).select("_id");
        await eventHandler(user._id, activeBranch._id);
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("openingHours", user._id);

        if (!isPermitted) return res.send({ error: "Invalid Operation" });

        await eventHandler(user.admin, user.branch);
        break;
      }

      default:
        throw new Error("Invalid Opearation");
        break;
    }

    res.status(200).send({ message: "Uploaded successfully" });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

router.patch("/api/opening-hours", auth, async (req, res) => {
  const user = req.user;
  const availability = req.body.availability;

  const eventHandler = async () => {
    await OpeningHour.findOneAndUpdate({ owner: user._id }, { availability });

    await User.findOneAndUpdate(
      { _id: user._id },
      { active: availability === "available" ? true : false }
    );
  };

  try {
    switch (user.type) {
      case "admin":
        await eventHandler();
        break;

      case "staff": {
        const isPermitted = await checkPermission("openingHours", user._id);

        if (!isPermitted) return res.send({ error: "Invalid Operation" });

        await eventHandler();
        break;
      }

      default:
        throw new Error("Invalid Opearation");
        break;
    }

    res.status(200).send({ message: "Avaiilability Updated" });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

router.get("/api/opening-hours", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (admin, branch) => {
    let openingHour = await OpeningHour.findOne({
      admin,
      branch,
      owner: user._id,
    });

    if (!openingHour) {
      openingHour = new OpeningHour({ admin, branch, owner: user._id });
      const newOpeningHours = await openingHour.save();
      return res.status(201).send({ message: newOpeningHours });
    }

    res.status(201).send({ message: openingHour });
  };

  try {
    switch (user.type) {
      case "admin": {
        const activeBranch = await Branch.findOne({
          admin: user._id,
          active: true,
        }).select("_id");

        if (!activeBranch)
          return res.send({ message: "No active branch found" });

        await eventHandler(user._id, activeBranch._id);
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("openingHours", user._id);

        if (!isPermitted) return res.send({ error: "Invalid Operation" });

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

router.delete("/api/opening-hours", auth, async (req, res) => {
  const user = req.user;
  const { day, timeSlot } = req.body;
  const from = timeSlot.from;
  const to = timeSlot.to;

  const eventHandler = async (admin, branch) => {
    const openingHour = await OpeningHour.findOne({
      admin,
      branch,
      owner: user._id,
    });

    if (!openingHour) {
      return res
        .status(404)
        .send({ error: "Opening hours not found for the specified branch." });
    }

    const daySlots = openingHour[day];

    if (!daySlots) {
      return res.status(404).send({ error: "Invalid day provided." });
    }

    const updatedTimeSlots = daySlots.filter(
      (timeSlot) => !(timeSlot.from === from && timeSlot.to === to)
    );

    if (updatedTimeSlots.length === daySlots.length) {
      return res.status(404).json({ error: "Time slot not found." });
    }

    openingHour[day] = updatedTimeSlots;

    await openingHour.save();
  };

  try {
    switch (user.type) {
      case "admin": {
        const activeBranch = await Branch.findOne({
          admin: user._id,
          active: true,
        }).select("_id");
        await eventHandler(user._id, activeBranch._id);
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("openingHours", user._id);

        if (!isPermitted) return res.send({ error: "Invalid Operation" });

        await eventHandler(user.admin, user.branch);
        break;
      }

      default:
        throw new Error("Invalid Opearation");
        break;
    }

    res.status(200).send({ message: "Time slot deleted successfully." });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

module.exports = router;
