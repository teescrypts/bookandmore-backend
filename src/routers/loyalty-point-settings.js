const express = require("express");
const auth = require("../middleware/auth");
const Product = require("../models/product");
const Service = require("../models/service");
const Branch = require("../models/branch");
const LoyaltyPointsSettings = require("../models/loyalty-point-settings");
const checkPermission = require("../utils/check-permission");
const CustomerInfo = require("../models/customer-info");
const PromotionCode = require("../models/promotion-code");
const router = new express.Router();

router.get(
  "/api/loyalty-point-settings/fetch/services/products",
  auth,
  async (req, res) => {
    const user = req.user;

    const eventHandler = async (admin, branch) => {
      const products = await Product.find({ admin, branch }).select("name");
      const services = await Service.find({ admin, branch }).select("name");

      res.status(201).send({ message: { products, services } });
    };

    try {
      switch (user.type) {
        case "admin": {
          const activeBranch = await Branch.findOne({
            admin: user._id,
            active: true,
          }).select("_id");

          if (!activeBranch) return res.send({ error: "Invalid Operation" });

          await eventHandler(user._id, activeBranch._id);
          break;
        }

        case "staff": {
          const isPermitted = await checkPermission("marketing", user._id);

          if (!isPermitted) return res.send({ error: "Invalid Operation" });

          await eventHandler(user.admin, user.branch);
          break;
        }

        default:
          throw new Error("Invalid Opearation");
          break;
      }
    } catch (e) {
      res.status(400).send({ error: e.message });
    }
  }
);

router.post("/api/loyalty-point-settings", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (admin, branch) => {
    const existingSettings = await LoyaltyPointsSettings.findOne({
      admin,
    });

    if (existingSettings) {
      return res.send({ error: "Invalid Operation" });
    }

    const loyaltyPointSettings = new LoyaltyPointsSettings({
      admin,
      ...req.body,
    });

    await loyaltyPointSettings.save();
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
        const isPermitted = await checkPermission("marketing", user._id);

        if (!isPermitted) return res.send({ error: "Invalid Operation" });

        await eventHandler(user.admin, user.branch);
        break;
      }

      default:
        throw new Error("Invalid Opearation");
        break;
    }

    res.status(201).send({ message: "Setting uploaded" });
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

router.get("/api/loyalty-point-settings", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (admin, branch) => {
    const loyaltyPointSettings = await LoyaltyPointsSettings.findOne({ admin })
      .populate({
        path: "aptServiceIds",
        select: "name _id",
      })
      .populate({
        path: "prodServiceIds",
        select: "name _id",
      });

    const products = await Product.find({ admin, branch }).select("name _id");
    const services = await Service.find({ admin, branch }).select("name _id");

    // Variables to store filtered-out values
    let removedServices = [];
    let removedProducts = [];

    // Filter populated fields if loyaltyPointSettings exists
    if (loyaltyPointSettings) {
      const productIds = products.map((product) => product._id.toString());
      const serviceIds = services.map((service) => service._id.toString());

      // Filter aptServiceIds and store removed ones
      const filteredAptServiceIds = [];
      removedServices = loyaltyPointSettings.aptServiceIds.filter((service) => {
        const isIncluded = serviceIds.includes(service._id.toString());
        if (isIncluded) filteredAptServiceIds.push(service);
        return !isIncluded;
      });

      // Filter prodServiceIds and store removed ones
      const filteredProdServiceIds = [];
      removedProducts = loyaltyPointSettings.prodServiceIds.filter(
        (product) => {
          const isIncluded = productIds.includes(product._id.toString());
          if (isIncluded) filteredProdServiceIds.push(product);
          return !isIncluded;
        }
      );

      // Update loyaltyPointSettings with filtered values
      loyaltyPointSettings.aptServiceIds = filteredAptServiceIds;
      loyaltyPointSettings.prodServiceIds = filteredProdServiceIds;
    }

    res.status(201).send({
      message: {
        loyaltyPointSettings,
        products,
        services,
        removedServices,
        removedProducts,
      },
    });
  };

  try {
    switch (user.type) {
      case "admin": {
        const activeBranch = await Branch.findOne({
          admin: user._id,
          active: true,
        }).select("_id");

        if (!activeBranch) {
          return res.send({ message: "No active branch found" });
        }

        await eventHandler(user._id, activeBranch._id);
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("marketing", user._id);

        if (!isPermitted) return res.send({ error: "Invalid Operation" });

        await eventHandler(user.admin, user.branch);
        break;
      }

      default:
        throw new Error("Invalid Operation");
    }
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

router.patch("/api/loyalty-point-settings/:id", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async () => {
    const updates = Object.keys(req.body);
    const allowedUpdates = [
      "monetaryEquivalent",
      "enableReferral",
      "minimumReferral",
      "enableAppointment",
      "minimumAmountEnabledApt",
      "minimumAmountApt",
      "appliesToApt",
      "aptServiceIds",
      "enableProduct",
      "minimumAmountEnabledProd",
      "minimumAmountProd",
      "appliesToProd",
      "prodServiceIds",
      "active",
    ];

    const isValidOperation = updates.every((update) =>
      allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
      return res.status(400).send({ error: "Invalid updates!" });
    }

    const settings = await LoyaltyPointsSettings.findOne({
      _id: req.params.id,
    });

    if (!settings) {
      return res.status(404).send();
    }

    updates.forEach((update) => (settings[update] = req.body[update]));
    await settings.save();
  };

  try {
    switch (user.type) {
      case "admin": {
        await eventHandler();
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("marketing", user._id);

        if (!isPermitted) return res.send({ error: "Invalid Operation" });

        await eventHandler();
        break;
      }

      default:
        throw new Error("Invalid Opearation");
        break;
    }

    res.status(201).send({ message: "Settings Updated" });
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

router.get("/api/customer-loyalty-point", auth, async (req, res) => {
  const user = req.user;

  if (user.type !== "customer")
    return res.send({ error: "Please login as customer" });

  try {
    const settings = await LoyaltyPointsSettings.findOne()
      .populate({
        path: "aptServiceIds",
        select: "name _id",
      })
      .populate({
        path: "prodServiceIds",
        select: "name _id",
      });

    const customerInfo = await CustomerInfo.findOne({
      customer: user._id,
    }).select("loyaltyPoint referralCode");

    const activePromoCode = await PromotionCode.findOne({
      "isLoyalty.customer": user._id,
      active: true,
    })
      .populate({ path: "coupon", select: "value" })
      .select("code");

    if (!settings)
      return res.send({
        message: {
          settings: "No active loyalty point",
          customerInfo,
        },
      });

    res.send({ message: { settings, customerInfo, activePromoCode } });
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

module.exports = router;
