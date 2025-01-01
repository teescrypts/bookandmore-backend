const CustomerInfo = require("../models/customer-info");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const isPaymentMethodRequired = async (user, settings) => {
  const policy = settings.policy;

  if (!user.stripeCustomer) {
    return policy.collectCancelFee || policy.collectNoshowFee;
  }

  const customerInfo = await CustomerInfo.findOne({
    customer: user._id,
  }).select("stripePaymentMethodId");

  const isPresent = customerInfo?.stripePaymentMethodId;

  if (!isPresent) {
    return policy.collectCancelFee || policy.collectNoshowFee;
  }

  return false;
};

module.exports = isPaymentMethodRequired;
