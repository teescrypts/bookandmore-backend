const express = require("express");
const auth = require("../middleware/auth");
const ShippingOption = require("../models/shipping-option");
const Branch = require("../models/branch");
const AllowedCountry = require("../models/allowed-country");
const checkPermission = require("../utils/check-permission");
const router = new express.Router();

router.post("/api/shipping-options", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (admin, branch) => {
    const shippiingOption = new ShippingOption({ admin, branch, ...req.body });
    await shippiingOption.save();
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
        const isPermitted = await checkPermission("shipping", user._id);

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

    res.status(201).send({ message: "Shipping Option added" });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

router.get("/api/shipping-options", auth, async (req, res) => {
  const user = req.user;
  const eventHandler = async (admin, branch) => {
    const shippingOptions = await ShippingOption.find({ admin, branch });
    const allowedCountries = await AllowedCountry.find({
      admin,
      branch,
    }).select("country");
    res.status(201).send({ message: { shippingOptions, allowedCountries } });
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
        const isPermitted = await checkPermission("shipping", user._id);

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

router.patch("/api/shipping-options/:id", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async () => {
    const updates = Object.keys(req.body);
    const allowedUpdates = [
      "displayName",
      "amount",
      "minEstimate",
      "maxEstimate",
      "unit",
    ];

    const isValidOperation = updates.every((update) =>
      allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
      return res.status(400).send({ error: "Invalid updates!" });
    }

    const shippingOption = await ShippingOption.findOne({
      _id: req.params.id,
    });

    if (!shippingOption) {
      return res.status(404).send();
    }

    updates.forEach((update) => (shippingOption[update] = req.body[update]));
    await shippingOption.save();
  };

  try {
    switch (user.type) {
      case "admin": {
        await eventHandler();
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("shipping", user._id);

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

    res.status(200).send({ message: "Shipping Option Updated" });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

router.delete("/api/shipping-options/:id", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async () => {
    const shippingOption = await ShippingOption.findOneAndDelete({
      _id: req.params.id,
    });

    if (!shippingOption) {
      res.status(404).send({ error: "Invalid Operation" });
    }
  };

  try {
    switch (user.type) {
      case "admin": {
        await eventHandler();
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("shipping", user._id);

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

    res.status(200).send({ message: "Shipping Option Updated" });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

module.exports = router;
