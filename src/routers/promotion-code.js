const express = require("express");
const auth = require("../middleware/auth");
const PromotionCode = require("../models/promotion-code");
const Coupon = require("../models/coupon");
const checkPermission = require("../utils/check-permission");
const router = new express.Router();

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

router.post("/api/promotion-codes", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async () => {
    const restrictions = req.body.restrictions;
    const stripePromotionCode = await stripe.promotionCodes.create({
      coupon: req.body.stripeCouponId,
      code: req.body.code,
      ...(req.body?.maxRedemptions && {
        max_redemptions: req.body.max_redemptions,
      }),
      restrictions: {
        first_time_transaction: restrictions.firstTransactionOnly,
        ...(restrictions.minimumAmount && {
          minimum_amount: restrictions.minimumAmount,
          minimum_amount_currency: "USD",
        }),
      },
    });

    const promotionCode = new PromotionCode({
      ...req.body,
      stripeData: {
        promotionCodeId: stripePromotionCode.id,
      },
    });

    const newPromotionCode = await promotionCode.save();

    const coupon = await Coupon.findById(req.body.coupon);
    coupon.promotionCodes = coupon.promotionCodes.concat(newPromotionCode._id);

    await coupon.save();
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

    res.status(201).send({ message: "Promotion code added" });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

router.patch("/api/promotion-codes/:id", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async () => {
    const updatedPromoCode = await PromotionCode.findByIdAndUpdate(
      { _id: req.params.id },
      { active: req.body.active }
    );

    await stripe.promotionCodes.update(
      updatedPromoCode.stripeData.promotionCodeId,
      {
        active: req.body.active,
      }
    );
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

    res.status(201).send({ message: "Promotion code updated" });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

module.exports = router;
