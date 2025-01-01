const express = require("express");
const Branch = require("../models/branch");
const auth = require("../middleware/auth");
const checkPermission = require("../utils/check-permission");
const router = new express.Router();

router.post("/api/locations", auth, async (req, res) => {
  const user = req.user;

  try {
    switch (user.type) {
      case "admin": {
        const branch = new Branch({ ...req.body, admin: user._id });
        await branch.save();
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("locations", user._id);

        if (!isPermitted) {
          return res.send({ error: "Invalid Operation" });
        }

        const branch = new Branch({ ...req.body, admin: user.admin });
        await branch.save();
        break;
      }

      default:
        throw new Error("Invalid Opearation");
        break;
    }

    res.status(201).send({ message: "Branch Added Succesfully" });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

router.get("/api/locations", auth, async (req, res) => {
  const user = req.user;

  try {
    switch (user.type) {
      case "admin": {
        const branches = await Branch.find({ admin: user._id });
        res.status(200).send({ message: branches });
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("locations", user._id);

        if (!isPermitted) {
          return res.send({ error: "Invalid Operation" });
        }

        const branches = await Branch.find({ admin: user.admin });
        res.status(200).send({ message: branches });
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

router.get("/api/locations/:id", auth, async (req, res) => {
  const _id = req.params.id;
  const user = req.user;

  const eventHandler = async () => {
    const branch = await Branch.findOne({ _id });

    if (!branch) {
      return res.status(404).send({ error: "Invalid Operation" });
    }

    res.status(201).send({ message: branch });
  };

  try {
    switch (user.type) {
      case "admin": {
        await eventHandler();
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("locations", user._id);

        if (!isPermitted) {
          return res.send({ error: "Invalid Operation" });
        }

        await eventHandler();
        break;
      }

      default:
        break;
    }
  } catch (e) {
    res.status(500).send({ error: "Unable to fetch branch" });
  }
});

router.patch("/api/locations/:id/name-address", auth, async (req, res) => {
  const user = req.user;
  const updates = Object.keys(req.body);
  const allowedUpdates = ["name", "address timeZone"];
  const isValidOperation = updates.every((update) =>
    allowedUpdates.includes(update)
  );

  if (!isValidOperation) {
    return res.status(400).send({ error: "Invalid updates!" });
  }

  const eventHandler = async () => {
    const branch = await Branch.findOne({
      _id: req.params.id,
    });

    if (!branch) {
      return res.status(404).send({ error: "Invalid Operation" });
    }

    updates.forEach((update) => (branch[update] = req.body[update]));
    await branch.save();
  };

  try {
    switch (user.type) {
      case "admin": {
        await eventHandler();
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("locations", user._id);

        if (!isPermitted) {
          return res.send({ error: "Invalid Operation" });
        }

        await eventHandler();
        break;
      }

      default:
        break;
    }

    res.status(200).send({ message: "success" });
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

router.patch("/api/locations/:id", auth, async (req, res) => {
  const user = req.user;
  const updates = Object.keys(req.body);
  const allowedUpdates = ["opened", "active"];
  const isValidOperation = updates.every((update) =>
    allowedUpdates.includes(update)
  );

  if (!isValidOperation) {
    return res.status(400).send({ error: "Invalid updates!" });
  }

  const eventHandler = async (admin) => {
    const branch = await Branch.findOne({
      _id: req.params.id,
    });

    if (!branch) {
      return res.status(404).send({ error: "Invalid Operation" });
    }

    updates.forEach((update) => (branch[update] = req.body[update]));
    if (req.body.active)
      await Branch.findOneAndUpdate({ active: true, admin }, { active: false });
    await branch.save();
  };

  try {
    switch (user.type) {
      case "admin": {
        await eventHandler(user._id);
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("locations", user._id);

        if (!isPermitted) {
          return res.send({ error: "Invalid Operation" });
        }

        if (req.body.active) {
          return res.send({ error: "Invalid Operation" });
        }

        await eventHandler(user.admin);
        break;
      }

      default:
        break;
    }

    res.status(200).send({ message: "success" });
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

module.exports = router;
