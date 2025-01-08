const express = require("express");
const auth = require("../middleware/auth");
const Order = require("../models/order");
const Branch = require("../models/branch");
const checkPermission = require("../utils/check-permission");
const router = new express.Router();

router.get("/api/orders", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (branch) => {
    const orders = await Order.find({ branch })
      .populate({
        path: "customer",
        select: "fname lname", // Select only fname and lname for the customer
      })
      .populate({
        path: "products.product",
        select: "name", // Select only the name for each product in the products array
      });

    res.send({ message: orders });
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

        await eventHandler(activeBranch._id);
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("orders", user._id);

        if (!isPermitted) return res.send({ error: "Invalid Operation" });

        await eventHandler(user.branch);
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

router.patch("/api/orders/:id", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async () => {
    const updates = Object.keys(req.body);
    const allowedUpdates = ["shippingAddress", "status"];
    const isValidOperation = updates.every((update) =>
      allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
      return res.status(400).send({ error: "Invalid updates!" });
    }

    const order = await Order.findOne({
      _id: req.params.id,
    });

    if (!order) {
      return res.status(404).send({ error: "Invalid Operation" });
    }

    updates.forEach((update) => (order[update] = req.body[update]));
    await order.save();
  };

  try {
    switch (user.type) {
      case "admin": {
        await eventHandler();
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("orders", user._id);

        if (!isPermitted) return res.send({ error: "Invalid Operation" });

        await eventHandler();
        break;
      }

      default:
        throw new Error("Invalid Opearation");
        break;
    }

    res.status(201).send({ message: "Order updated" });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

module.exports = router;
