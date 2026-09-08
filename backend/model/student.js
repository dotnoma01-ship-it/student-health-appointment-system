const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
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

        emailVerified: {
            type: Boolean,
            default: false
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

        matricNumber: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true
        },

        department: {
            type: String,
            required: true,
            trim: true
        },

        level: {
            type: String,
            required: true,
            trim: true
        },

        gender: {
            type: String,
            required: true,
            trim: true
        },

        // =====================================================
        // TWO-FACTOR / REGISTRATION OTP
        // =====================================================

        twoFactorEnabled: {
            type: Boolean,
            default: false
        },

        otpHash: {
            type: String,
            default: null
        },

        otpExpiresAt: {
            type: Date,
            default: null
        },

        otpAttempts: {
            type: Number,
            default: 0
        },

        otpLastSentAt: {
            type: Date,
            default: null
        },

        // =====================================================
        // PASSWORD RESET OTP
        // =====================================================

        resetOtpHash: {
            type: String,
            default: null
        },

        resetOtpExpiresAt: {
            type: Date,
            default: null
        },

        resetOtpAttempts: {
            type: Number,
            default: 0
        },

        resetOtpLastSentAt: {
            type: Date,
            default: null
        },

        // =====================================================
        // PASSWORD RESET TOKEN
        // =====================================================

        resetToken: {
            type: String,
            default: null
        },

        resetTokenExpiresAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true,
        collection: "students"
    }
);

module.exports =
    mongoose.models.Student ||
    mongoose.model("Student", studentSchema);

