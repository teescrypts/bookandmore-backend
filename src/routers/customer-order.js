const express = require("express");
const auth = require("../middleware/auth");
const Order = require("../models/order");
const router = new express.Router();

router.get("/api/customer-orders", auth, async (req, res) => {
  const user = req.user;

  if (user.type !== "customer")
    return res.send({ error: "Login as a customer" });

  try {
    const orders = await Order.find({ customer: user._id })
      .populate({
        path: "products.product", // Path to populate
        select: "name", // Select only the name field
      })
      .exec();

    res.status(200).send({ message: orders });
  } catch (error) {
    res.status(500).send({ error: "An error occurred while fetching orders." });
  }
});

module.exports = router;
