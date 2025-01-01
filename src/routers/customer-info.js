const express = require("express");
const auth = require("../middleware/auth");
const User = require("../models/user");
const generateReferralCode = require("../utils/generate-referral-code");
const CustomerInfo = require("../models/customer-info");
const Branch = require("../models/branch");
const checkPermission = require("../utils/check-permission");
const LoyaltyPointsSettings = require("../models/loyalty-point-settings");
const Coupon = require("../models/coupon");
const PromotionCode = require("../models/promotion-code");
const router = new express.Router();

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

function generatePromoCode(fname) {
  // Ensure the first name is uppercase and trimmed
  const namePart = fname.trim().toUpperCase();

  // Generate 3 random numbers (0-9)
  const randomNumbers = Math.floor(100 + Math.random() * 900); // Ensures a 3-digit number

  // Combine name and random numbers
  const promoCode = `${namePart}${randomNumbers}`;

  return promoCode;
}

router.post(
  "/api/customer-info/redeem-loyalty-point",
  auth,
  async (req, res) => {
    const user = req.user;

    const code = generatePromoCode(user.fname);

    try {
      const customerInfo = await CustomerInfo.findOne({ customer: user._id });
      const settings = await LoyaltyPointsSettings.findOne({ active: true });

      if (!settings)
        return res.send({
          error: "Loyalty point feature is currently in active",
        });

      const totalLoyaltyPoint =
        customerInfo.loyaltyPoint.total - customerInfo.loyaltyPoint.redeemed;

      const totalAmount = settings.monetaryEquivalent * totalLoyaltyPoint;

      const stripeCoupon = await stripe.coupons.create({
        amount_off: Math.round(totalAmount * 100),
        currency: "USD",
        duration: "once",
        metadata: { customer: user.stripeCustomer },
        max_redemptions: 1,
      });

      const stripePromotionCode = await stripe.promotionCodes.create({
        coupon: stripeCoupon.id,
        customer: user.stripeCustomer,
        code,
      });

      const coupon = new Coupon({
        valueType: "amount_off",
        value: totalAmount,
        stripeData: { couponId: stripeCoupon.id },
      });

      const newCoupon = await coupon.save();

      const promotionCode = new PromotionCode({
        coupon: newCoupon._id,
        code,
        stripeData: { promotionCodeId: stripePromotionCode.id },
        isLoyalty: {
          enabled: true,
          customer: user._id,
        },
      });

      await promotionCode.save();

      customerInfo.loyaltyPoint.redeemed += customerInfo.loyaltyPoint.total;
      await customerInfo.save();
      res.send({ message: "Promotion code geerated" });
    } catch (e) {
      console.log(e);
      res.status(400).send({ error: e.message });
    }
  }
);

router.post("/api/customer-info/generate-code", auth, async (req, res) => {
  const user = req.user;

  try {
    const customer = await User.findOne({
      _id: user._id,
      type: "customer",
    }).select("fname");

    if (!customer)
      return res.send({
        error: "Invalid Operation. Customer account not found ",
      });

    const fname = customer.fname;

    const code = generateReferralCode(fname);

    await CustomerInfo.findOneAndUpdate(
      { customer: user._id },
      { referralCode: { value: code, count: 0 } }
    );

    res.send({ message: "Success" });
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

router.get("/api/customer-info", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (admin) => {
    const customers = await CustomerInfo.find({ admin })
      .populate("customer", "fname lname email") // Populate customer details from the User model
      .exec();

    // Map the data into a frontend-friendly format
    const formattedData = customers.map((customer) => ({
      id: customer._id,
      customerName: `${customer.customer?.fname || ""} ${
        customer.customer?.lname || ""
      }`.trim(),
      email: customer.customer?.email || "Unknown",
      loyaltyPoint: customer.loyaltyPoint,
      referralCode: customer.referralCode,
      referred: customer.referred,
      cancelledAppointments: customer.cancelledAppointments,
      completedAppointments: customer.completedAppointments,
      totalAppointments: customer.totalAppointments,
      purcheses: customer.purcheses,
      createdAt: customer.createdAt,
    }));

    res.status(200).send({ message: formattedData });
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

        await eventHandler(user._id);
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("settings", user._id);

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
    console.log(e);
    return res.status(400).send({ error: e.message });
  }
});

module.exports = router;
