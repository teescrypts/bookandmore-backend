const mongoose = require("mongoose");

function generateReferralCode(firstName) {
  if (!firstName) {
    throw new Error("First name is required to generate a referral code.");
  }

  // Sanitize the first name (e.g., remove spaces, special characters)
  const sanitizedFirstName = firstName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  // Generate a new ObjectId
  const uniqueId = new mongoose.Types.ObjectId().toString();

  // Combine the sanitized first name and the ObjectId
  const referralCode = `${sanitizedFirstName}-${uniqueId}`;

  return referralCode;
}

module.exports = generateReferralCode;
