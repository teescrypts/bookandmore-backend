const express = require("express");
const auth = require("../middleware/auth");
const RentForm = require("../models/rent-form");
const Branch = require("../models/branch");
const checkPermission = require("../utils/check-permission");
const router = new express.Router();

router.post("/api/rent-forms", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (admin, branch) => {
    const rentForm = new RentForm({
      admin,
      branch,
      ...req.body,
    });

    await rentForm.save();
  };

  try {
    switch (user.type) {
      case "admin": {
        const activeBranch = await Branch.findOne({
          active: true,
          admin: user._id,
        }).select("_id");
        await eventHandler(user._id, activeBranch._id);
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("rent", user._id);

        if (!isPermitted) {
          return res.send({ error: "Invalid Operation" });
        }

        await eventHandler(user.admin, user.branch);
        break;
      }

      default:
        throw new Error("Invalid Operation");
        break;
    }

    res.status(201).send({ message: "Rent Uploaded successfuly" });
  } catch (e) {
    return res.status(400).send({ error: e.messaage });
  }
});

router.get("/api/rent-forms", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (admin, branch) => {
    const rentForms = await RentForm.find({ admin, branch });
    res.status(201).send({ message: rentForms });
  };

  try {
    switch (user.type) {
      case "admin": {
        const activeBranch = await Branch.findOne({
          active: true,
          admin: user._id,
        });

        await eventHandler(user._id, activeBranch._id);
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("rent", user._id);

        if (!isPermitted) return res.send({ error: "Invalid Operation" });

        await eventHandler(user.admin, user.branch);
        break;
      }
      default:
        throw new Error("Invalid Operation");
        break;
    }
  } catch (e) {
    return res.status(400).send({ error: e.messaage });
  }
});

router.delete("/api/rent-forms/:id", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async () => {
    const rentForm = await RentForm.findOneAndDelete({ _id: req.params.id });

    if (!rentForm) {
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
        const isPermitted = await checkPermission("rent", user._id);

        if (!isPermitted) return res.send({ error: "Invalid Operation" });

        await eventHandler();
        break;
      }

      default:
        throw new Error("Invalid Operation");
        break;
    }

    res.status(201).send({ message: "Deleted succesfully" });
  } catch (e) {
    return res.status(400).send({ error: e.messaage });
  }
});

router.get("/api/rent-forms/:id", async (req, res) => {
  try {
    const rentForm = await RentForm.findOne({ _id: req.params.id }).populate({
      path: "subscription",
      select: "stripeProductId stripePriceId interval amount description",
    });

    if (!rentForm) return res.status(400).send({ error: "Invalid Operation" });

    res.status(200).send({ message: rentForm });
  } catch (e) {
    return res.status(400).send({ error: e.messaage });
  }
});

module.exports = router;
