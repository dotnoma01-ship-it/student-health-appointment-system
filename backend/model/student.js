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