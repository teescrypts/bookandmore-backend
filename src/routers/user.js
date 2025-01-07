const express = require("express");
const User = require("../models/user");
const auth = require("../middleware/auth");
const multer = require("multer");
const sharp = require("sharp");
const Branch = require("../models/branch");
const Rent = require("../models/rent");
const StaffInfo = require("../models/staff-info");
const CustomerInfo = require("../models/customer-info");
const confirmReferralCode = require("../utils/confirm-referral-code");
const router = new express.Router();

// const isProduction = process.env.NODE_ENV === "production";
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

router.post("/api/register", async (req, res) => {
  const demoInfo = {
    fname: "Jane",
    lname: "Doe",
    email: req.body.email,
    password: "bookandmore",
    type: "admin",
  };

  const user = new User(demoInfo);

  try {
    await user.save();
    const token = await user.generateAuthToken();

    return res
      .status(201)
      .send({ message: "User registered successfully", token });
  } catch (error) {
    return res.status(400).send({ error: "User registration failed" });
  }
});

router.post("/api/users/signup", async (req, res) => {
  try {
    const existingCustomerAct = await User.findOne({
      email: req.body.email,
      type: "customer",
    });

    if (existingCustomerAct) {
      return res.send({ error: "Email Already Exist" });
    }

    const stripeCustomer = await stripe.customers.create({
      name: `${req.body.fname} ${req.body.lname}`,
      email: req.body.name,
    });

    const admin = await User.findOne({
      email: "admin@bookandmore.com",
      type: "admin",
    }).select("_id");

    const user = new User({
      type: "customer",
      admin: admin._id,
      stripeCustomer: stripeCustomer.id,
      ...req.body,
    });

    const newCustomer = await user.save();

    const isValidReferralCode = await confirmReferralCode(
      req.body.referralCode
    );

    const customerInfo = new CustomerInfo({
      customer: newCustomer._id,
      admin: admin._id,
      ...(isValidReferralCode && {
        referred: { code: req.body.referralCode, used: false },
      }),
    });

    await customerInfo.save();
    const token = await user.generateAuthToken();

    return res.status(201).send({ message: "Signup successfully", token });
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

router.post("/api/users/login", async (req, res) => {
  try {
    const { email, password, type } = req.body;

    const users = await User.find({ email }).populate({
      path: "branch",
      select: "name",
    });

    if (users.length > 1 && !type) {
      const types = users.map((user) => {
        if (user.type === "admin") {
          return {
            type: user.type,
          };
        } else {
          return {
            type: user.type,
            branch: {
              name: user.branch.name,
              id: user.branch.id,
            },
          };
        }
      });

      return res.send({ message: "Please select an account type.", types });
    }

    const user = await User.findByCredentials(email, password, type);
    const token = await user.generateAuthToken();

    res.status(200).send({ token, type: user.type });
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

router.get("/api/users-data", auth, async (req, res) => {
  const user = req.user;

  try {
    switch (user.type) {
      case "admin":
        const activeBranch = await Branch.findOne({
          active: true,
          admin: user._id,
        }).select("name opened");

        if (!activeBranch) {
          return res.status(201).send({
            message: {
              type: "admin",
              id: user._id,
            },
          });
        }

        return res.status(201).send({
          message: {
            activeBranch,
            type: "admin",
            id: user._id,
            name: `${user.fname} ${user.lname}`,
            email: user.email,
          },
        });
        break;

      case "tenant":
        const tenantBranch = await Branch.findOne({ _id: user.branch }).select(
          "name opened"
        );

        const rentStatus = await Rent.findOne({
          tenant: user._id,
        }).select("paymentStatus status stripeCustomer dueOn");

        return res.status(201).send({
          message: {
            activeBranch: tenantBranch._id,
            type: "tenant",
            id: user._id,
            name: `${user.fname} ${user.lname}`,
            email: user.email,
            rentStatus,
          },
        });
        break;

      case "staff":
        const staffBranch = await Branch.findOne({ _id: user.branch }).select(
          "name opened"
        );

        const staffInfo = await StaffInfo.findOne({ staff: user._id }).select(
          "type permissions"
        );

        res.status(201).send({
          message: {
            activeBranch: staffBranch._id,
            type: "staff",
            id: user._id,
            name: `${user.fname} ${user.lname}`,
            email: user.email,
            permissions: staffInfo.permissions,
          },
        });
        break;

      case "customer":
        res.send({
          message: {
            _id: req.user._id,
            name: `${user.fname} ${user.lname}`,
            type: "customer",
          },
        });
        break;

      default:
        throw new Error("Invalid Opearation");
        break;
    }
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

router.get("/api/users", auth, async (req, res) => {
  res.status(201).send({ message: req.user });
});

router.patch("/api/users/me/password", auth, async (req, res) => {
  try {
    const isVerify = await req.user.verifyCredentials(req.body.password);
    if (!isVerify) {
      throw new Error("Invalid Operation.");
    }

    req.user.password = req.body.newPassword;
    await req.user.save();
    res.send({ message: "Update successful" });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

router.patch("/api/users/me", auth, async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = ["fname", "lname", "email"];
  const isValidOperation = updates.every((update) =>
    allowedUpdates.includes(update)
  );

  if (!isValidOperation) {
    return res.status(400).send({ error: "Invalid updates!" });
  }

  try {
    updates.forEach(async (update) => (req.user[update] = req.body[update]));
    await req.user.save();
    res.send({ message: "Update successful" });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

router.post("/api/users/staffs/account-session", auth, async (req, res) => {
  const user = req.user;

  try {
    const staffInfo = await StaffInfo.findOne({ staff: user._id });

    if (staffInfo.type === "regular") {
      return res.send({ message: "Not a Commission staff" });
    }

    const accountSession = await stripe.accountSessions.create({
      account: staffInfo.stripeAccountId,
      components: {
        account_onboarding: {
          enabled: true,
        },
        payments: {
          enabled: true,
        },
        payouts: {
          enabled: true,
        },
        balances: {
          enabled: true,
        },
      },
    });

    res.status(201).send({ message: accountSession.client_secret });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

// ----------------------------- Handling Account Avatar ----------------------------- //

const upload = multer({
  fileFilter(req, file, cb) {
    if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
      return cb(new Error("Please upload an image"));
    }

    cb(undefined, true);
  },
});

router.post(
  "/api/users/me/avatar",
  auth,
  upload.single("avatar"),
  async (req, res) => {
    const buffer = await sharp(req.file.buffer)
      .webp({ quality: 30 })
      .toBuffer();

    req.user.avatar = buffer;
    await req.user.save();
    res.send({ message: "success" });
  },
  (error, req, res, next) => {
    res.status(400).send({ error: error.message });
  }
);

router.get("/api/users/:id/avatar", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user || !user.avatar) {
      throw new Error();
    }

    res.set("Content-Type", "image/webp");
    res.send(user.avatar);
  } catch (e) {
    res.status(404).send();
  }
});

module.exports = router;
