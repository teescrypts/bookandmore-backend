const express = require("express");
const auth = require("../middleware/auth");
const Service = require("../models/service");
const Branch = require("../models/branch");
const Addon = require("../models/addon");
const User = require("../models/user");
const checkPermission = require("../utils/check-permission");
const router = new express.Router();

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

router.get("/api/services/fetch/staffs", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (admin, branch) => {
    const staffs = await User.find({ admin, branch, type: "staff" }).select(
      "fname lname"
    );
    const adminObj = await User.findOne({ _id: admin }).select("fname lname");

    const combinedResult = [adminObj, ...staffs];
    res.status(201).send({ message: combinedResult });
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
        const isPermitted = await checkPermission("services", user._id);

        if (!isPermitted) {
          return res.send({ error: "Invalid Operation" });
        }

        await eventHandler(user.admin, user.branch);
        break;
      }

      default:
        break;
    }
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

router.post("/api/services", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (admin, branch) => {
    const product = await stripe.products.create({
      name: req.body.name,
      ...(req.body.description && { description: req.body.description }),
      tax_code: req.body.category.taxCode,
      default_price_data: {
        currency: "USD",
        unit_amount: Math.round(req.body.priceAmount * 100),
      },
    });

    const service = new Service({
      admin,
      branch,
      stripeData: { priceId: product.default_price, productId: product.id },
      ...req.body,
    });


    await service.save();
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
        const isPermitted = await checkPermission("services", user._id);

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

    res.status(201).send({ message: "service uploaded successfully" });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

router.get("/api/services/:id", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (admin) => {
    const service = await Service.findOne({ _id: req.params.id });

    if (!service) {
      return res.send({ error: "Invalid Operation" });
    }

    const addons = await Addon.find({ service: service._id })
      .select("-service")
      .populate({
        path: "addonService",
        select: "name",
      });

    const staffs = await User.find({
      admin: service.admin,
      branch: service.branch,
      type: "staff",
    }).select("fname lname");

    const adminObj = await User.findOne({ _id: admin }).select("fname lname");

    const combinedResult = [adminObj, ...staffs];

    res
      .status(201)
      .send({ message: { service, addons, staffs: combinedResult } });
  };

  try {
    switch (user.type) {
      case "admin": {
        await eventHandler(user._id);
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("services", user._id);

        if (!isPermitted) {
          return res.send({ error: "Invalid Operation" });
        }

        await eventHandler(user.admin);
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

router.get("/api/services", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (admin, branch) => {
    const services = await Service.find({ admin, branch })
      .select("-admin -branch")
      .exec();

    res.status(201).send({ message: services });
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
        const isPermitted = await checkPermission("services", user._id);

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

router.patch("/api/services/:id", auth, async (req, res) => {
  const user = req.user;
  const _id = req.params.id;

  const eventHandler = async () => {
    const updates = Object.keys(req.body);
    const allowedUpdates = [
      "name",
      "category",
      "description",
      "color",
      "priceAmount",
      "estimatedTime",
      "bufferTime",
      "status",
      "staffs",
    ];

    const isValidOperation = updates.every((update) =>
      allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
      return res.status(400).send({ error: "Invalid updates!" });
    }

    const service = await Service.findOne({ _id });

    if (!service) {
      return res.status(404).send({ error: "Invalid Operation" });
    }

    if (req.body.price !== service.price) {
      await stripe.prices.update(service.stripeData.priceId, {
        active: false,
      });

      const price = await stripe.prices.create({
        currency: "usd",
        unit_amount: Math.round(req.body.price * 100),
        product: service.stripeData.productId,
      });

      await stripe.products.update(service.stripeData.productId, {
        default_price: price.id,
      });

      service.stripeData.priceId = price.id;
    }

    if (req.body.name !== service.name) {
      await stripe.products.update(service.stripeData.productId, {
        name: req.body.name,
      });
    }

    if (req.body.description !== service.description) {
      await stripe.products.update(service.stripeData.productId, {
        description: req.body.description,
      });
    }

    if (
      req.body.category?.taxCode &&
      req.body.category.taxCode !== service.category.taxCode
    ) {
      await stripe.products.update(service.stripeData.productId, {
        tax_code: req.body.category.taxCode,
      });
    }

    updates.forEach((update) => (service[update] = req.body[update]));
    await service.save();
  };

  try {
    switch (user.type) {
      case "admin": {
        await eventHandler();
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("services", user._id);

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

    res.status(201).send({ message: "Service Updated successfully" });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

router.delete("/api/services/:id", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async () => {
    const service = await Service.findOneAndDelete({
      _id: req.params.id,
    });

    if (!service) {
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
        const isPermitted = await checkPermission("services", user._id);

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

    res.status(201).send({ message: "Service Deleted successfully" });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

router.delete("/api/services/addon/manager/:id", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async () => {
    const deletedAddon = await Addon.findOneAndDelete({ _id: req.params.id });

    if (!deletedAddon) {
      return res.send({ error: "Invalid operation" });
    }
  };

  try {
    switch (user.type) {
      case "admin": {
        await eventHandler();
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("services", user._id);

        if (!isPermitted) {
          return res.send({ error: "Invalid Operation" });
        }

        await eventHandler();
        break;
      }

      default:
        break;
    }

    res.status(200).send({ message: "Addon removed" });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

router.post("/api/services/addon/manager", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async () => {
    const addon = new Addon(req.body);
    await addon.save();
  };

  try {
    switch (user.type) {
      case "admin": {
        await eventHandler();
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("services", user._id);

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

    res.status(200).send({ message: "Addon added successfully" });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

router.get("/api/services/addon/manager", auth, async (req, res) => {
  const user = req.user;
  const type = req.query.type;

  const eventHandler = async (admin, branch) => {
    if (type === "service") {
      const services = await Service.find({ admin, branch }).select("name");
      res.status(201).send({ message: services });
    }

    if (type === "product") {
      const services = await Service.find({ admin, branch }).select("name");
      res.status(201).send({ message: services });
    }
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
        const isPermitted = await checkPermission("services", user._id);

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

module.exports = router;






