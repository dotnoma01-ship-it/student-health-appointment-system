const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true
    },

    lastName: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      required: true
    },

    phone: {
      type: String,
      required: true,
      trim: true
    },

    specialization: {
      type: String,
      required: true,
      trim: true
    },

    licenseNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    gender: {
      type: String,
      required: true,
      trim: true
    },

    otp: {
      type: String,
      default: null
    },

    otpExpires: {
      type: Date,
      default: null
    },

    isVerified: {
      type: Boolean,
      default: false
    },

    twoFactorEnabled: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Doctor", doctorSchema);