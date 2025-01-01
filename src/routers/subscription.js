const express = require("express");
const auth = require("../middleware/auth");
const Subscription = require("../models/subscription");
const Branch = require("../models/branch");
const checkPermission = require("../utils/check-permission");
const router = new express.Router();

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

router.post("/api/subscriptions", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (admin, branch) => {
    const product = await stripe.products.create({
      name: req.body.name,
      ...(req.body.description && { description: req.body.description }),
    });

    const price = await stripe.prices.create({
      currency: "usd",
      unit_amount: Math.round(Number(req.body.amount) * 100),
      recurring: {
        interval: req.body.interval,
      },
      product: product.id,
    });

    const subscription = new Subscription({
      admin,
      branch,
      name: req.body.name,
      stripeProductId: product.id,
      stripePriceId: price.id,
      interval: req.body.interval,
      amount: req.body.amount,
      ...(req.body.description && { description: req.body.description }),
    });

    await subscription.save();
  };

  try {
    switch (user.type) {
      case "admin": {
        const activeBranch = await Branch.findOne({
          active: true,
          admin: user._id,
        });

        if (!activeBranch) {
          return res.send({ message: "No active location found" });
        }

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

    res.status(201).send({ message: "Subscription Uploaded Successfully" });
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

router.get("/api/subscriptions", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (admin, branch) => {
    const subscriptions = await Subscription.find({ admin, branch });
    res.status(200).send({ message: subscriptions });
  };

  try {
    switch (user.type) {
      case "admin": {
        const activeBranch = await Branch.findOne({
          active: true,
          admin: user._id,
        });

        if (!activeBranch) {
          return res.send({ message: "No Active location found" });
        }

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
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

router.get("/api/subscriptions/:id", auth, async (req, res) => {
  const user = req.user;
  const _id = req.params.id;

  const eventHandler = async () => {
    const subscription = await Subscription.findById({ _id });
    res.status(201).send({ message: subscription });
  };

  try {
    switch (user.type) {
      case "admin": {
        await eventHandler();
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("rent", user._id);

        if (!isPermitted) {
          return res.send({ error: "Invalid Operation" });
        }

        await eventHandler();
        break;
      }

      default:
        throw new Error("Invalid Operation");
        break;
    }
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

router.patch("/api/subscriptions/:id", auth, async (req, res) => {
  const user = req.user;
  const _id = req.params.id;

  const updates = Object.keys(req.body);
  const allowedUpdates = ["name", "active", "description"];
  const isValidOperation = updates.every((update) =>
    allowedUpdates.includes(update)
  );

  if (!isValidOperation) {
    return res.status(400).send({ error: "Invalid updates!" });
  }

  const eventHandler = async () => {
    const subscription = await Subscription.findById(_id);

    if (!subscription) {
      return res.status(404).send({ error: "Invalid updates" });
    }

    if (req.body?.name || req.body?.description) {
      await stripe.products.update(subscription.stripeProductId, {
        name: req.body.name,
        ...(req.body?.description && { description: req.body.description }),
      });
    }

    updates.forEach((update) => (subscription[update] = req.body[update]));
    await subscription.save();
  };

  try {
    switch (user.type) {
      case "admin": {
        await eventHandler();
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("rent", user._id);

        if (!isPermitted) {
          return res.send({ error: "Invalid Operation" });
        }

        await eventHandler();
        break;
      }

      default:
        throw new Error("Invalid Operation");
        break;
    }

    res.status(201).send({ message: "Subscription Updated" });
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

router.delete("/api/subscriptions/:id", auth, async (req, res) => {
  const user = req.user;
  const _id = req.params.id;

  const eventHandler = async () => {
    const subscription = await Subscription.findOneAndDelete({ _id });

    if (!subscription) {
      return res.status(404).send({ error: "Invalid updates" });
    }

    await stripe.products.update(subscription.stripeProductId, {
      active: false,
    });

    await stripe.prices.update(subscription.stripePriceId, {
      active: false,
    });
  };

  try {
    switch (user.type) {
      case "admin": {
        await eventHandler();
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("rent", user._id);

        if (!isPermitted) {
          return res.send({ error: "Invalid Operation" });
        }

        await eventHandler();
        break;
      }

      default:
        throw new Error("Invalid Operation");
        break;
    }

    res.status(200).send({ message: "Success" });
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

module.exports = router;
