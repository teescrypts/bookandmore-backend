const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const userSchema = new mongoose.Schema(
  {
    fname: {
      type: String,
      required: true,
      trim: true,
    },
    lname: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      validate(value) {
        if (!validator.isEmail(value)) {
          throw new Error("Email is invalid");
        }
      },
    },
    password: {
      type: String,
      required: true,
      minlength: 7,
      trim: true,
      validate(value) {
        if (value.toLowerCase().includes("password")) {
          throw new Error('Password cannot contain "password"');
        }
      },
    },
    active: {
      type: Boolean,
      default: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["tenant", "admin", "staff", "customer"],
      trim: true,
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      validate: {
        validator: function (value) {
          if (this.type !== "admin" && !value) {
            throw new Error("Admin field is required for non-admin users.");
          }
        },
        message: "Admin field validation failed.",
      },
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      validate: {
        validator: function (value) {
          if (this.type !== "admin" && !value) {
            throw new Error("Branch field is required for non-admin users.");
          }
        },
        message: "Branch field validation failed.",
      },
    },
    dob: {
      day: { type: Number },
      month: { type: Number },
      year: { type: Number },
    },

    stripeCustomer: { type: String },
    tokens: [
      {
        token: {
          type: String,
          required: true,
        },
      },
    ],
    avatar: {
      type: Buffer,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.methods.toJSON = function () {
  const user = this;
  const userObject = user.toObject();

  delete userObject.password;
  delete userObject.tokens;
  delete userObject.avatar;

  return userObject;
};

userSchema.methods.generateAuthToken = async function () {
  const user = this;
  const token = jwt.sign({ _id: user._id.toString() }, process.env.JWT_SECRET);

  user.tokens = user.tokens.concat({ token });
  await user.save();

  return token;
};

userSchema.statics.findByCredentials = async (email, password, type) => {
  const query = { email };
  if (type) query.type = type;

  const user = await User.findOne(query);
  if (!user) {
    throw new Error("Invalid login credentials.");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new Error("Invalid login credentials.");
  }

  return user;
};

userSchema.methods.verifyCredentials = async function (password) {
  const user = this;

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    return false;
  }

  return true;
};

userSchema.pre("save", async function (next) {
  const user = this;

  if (user.isModified("password")) {
    user.password = await bcrypt.hash(user.password, 8);
  }

  next();
});

const User = mongoose.model("User", userSchema);

module.exports = User;
