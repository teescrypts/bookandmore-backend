const express = require("express");
const auth = require("../middleware/auth");
const Coupon = require("../models/coupon");
const Branch = require("../models/branch");
const Product = require("../models/product");
const Service = require("../models/service");
const convertToUnixTime = require("../utils/convert-to-unix");
const PromotionCode = require("../models/promotion-code");
const checkPermission = require("../utils/check-permission");
const router = new express.Router();

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

router.post("/api/coupons", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (admin, branch) => {
    const stripeCoupon = await stripe.coupons.create({
      [req.body.valueType]:
        req.body.valueType === "amount_off"
          ? Math.round(req.body.value * 100)
          : req.body.value,
      ...(req.body.valueType === "amount_off" && { currency: "USD" }),
      ...(req.body?.appliesTo && { applies_to: req.body.appliesTo }),
      max_redemptions: req.body.maxRedemptions,
      redeem_by: convertToUnixTime(req.body.expiresAt),
    });

    const coupon = new Coupon({
      admin,
      branch,
      ...req.body,
      stripeData: { couponId: stripeCoupon.id },
    });

    await coupon.save();
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

    res.status(201).send({ message: "Coupon Added" });
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

router.get("/api/coupons", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (admin, branch) => {
    const coupons = await Coupon.find({ admin, branch })
      .populate({
        path: "addedProducts",
        select: "name",
      })
      .populate({
        path: "addedServices",
        select: "name",
      })
      .populate({
        path: "promotionCodes",
        select: "code maxRedemptions restrictions stripeData createdAt active",
      })
      .exec();

    const products = await Product.find({ admin, branch }).select(
      "name price stripeData"
    );

    const services = await Service.find({ admin, branch }).select(
      "name priceAmount stripeData"
    );

    res.status(201).send({ message: { coupons, products, services } });
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
        throw new Error("Invalid Opearation");
        break;
    }
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

router.delete("/api/coupons/:id", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async () => {
    const deletedCoupon = await Coupon.findByIdAndDelete(req.params.id);
    await stripe.coupons.del(deletedCoupon.stripeData.couponId);
    await PromotionCode.deleteMany({ coupon: deletedCoupon._id });
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

    res.status(201).send({ message: "Coupon Deleted" });
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

module.exports = router;
