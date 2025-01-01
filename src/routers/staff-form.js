const express = require("express");
const auth = require("../middleware/auth");
const Branch = require("../models/branch");
const StaffForm = require("../models/staff-form");
const Service = require("../models/service");
const checkPermission = require("../utils/check-permission");
const router = new express.Router();

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

router.get("/api/fetch/services/staff-forms", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (admin, branch) => {
    const services = await Service.find({ admin, branch }).select("name");
    res.status(201).send({ message: services });
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

router.post("/api/staff-forms", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (admin, branch) => {
    const staffForm = new StaffForm({
      admin,
      branch,
      ...req.body,
    });

    await staffForm.save();
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

    res.status(201).send({ message: "Form Uploaded successfully" });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

router.get("/api/staff-forms", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (admin, branch) => {
    const staffForms = await StaffForm.find({ admin, branch }).populate({
      path: "services",
      select: "name",
    });
    res.status(200).send({ message: staffForms });
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

router.delete("/api/staff-forms/:id", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async () => {
    const staffForm = await StaffForm.findOneAndDelete({ _id: req.params.id });

    if (!staffForm) {
      res.status(404).send({ error: "Invalid operation" });
    }
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
        break;
    }

    res.status(201).send({ message: "Deleted succesfully" });
  } catch (e) {
    return res.status(400).send({ error: e.messaage });
  }
});

router.get("/api/staff-forms/:id", async (req, res) => {
  try {
    const staffForm = await StaffForm.findOne({ _id: req.params.id }).populate({
      path: "services",
      select: "name",
    });

    if (!staffForm) return res.status(400).send({ error: "Invalid Operation" });

    res.status(200).send({ message: staffForm });
  } catch (e) {
    return res.status(400).send({ error: e.messaage });
  }
});

module.exports = router;
