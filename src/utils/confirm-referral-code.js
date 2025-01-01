const CustomerInfo = require("../models/customer-info");

const confirmReferralCode = async (code) => {
  if (!code) return false;

  const isValidOwner = await CustomerInfo.findOne({
    "referralCode.value": code,
  });

  if (isValidOwner) {
    return true;
  }

  return false;
};

module.exports = confirmReferralCode;
