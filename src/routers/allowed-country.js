const express = require("express");
const auth = require("../middleware/auth");
const AllowedCountry = require("../models/allowed-country");
const Branch = require("../models/branch");
const ShippingOption = require("../models/shipping-option");
const checkPermission = require("../utils/check-permission");
const router = new express.Router();

router.post("/api/allowed-country", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (admin, branch) => {
    const allowedCountry = new AllowedCountry({
      admin,
      branch,
      ...req.body,
    });

    await allowedCountry.save();
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

    res.status(200).send({ message: "Country uploaded" });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

router.delete("/api/allowed-country/:id", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async () => {
    const deletedShippingOption = await AllowedCountry.findByIdAndDelete(
      req.params.id
    );

    if (!deletedShippingOption) {
      return res.send({ error: "Invalid Operation" });
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

    res.status(200).send({ message: "Country Deleted" });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

module.exports = router;
