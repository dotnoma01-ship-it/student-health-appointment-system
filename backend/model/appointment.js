const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
    {
        studentId: {
            type: String,
            required: true
        },

        studentName: {
            type: String,
            required: true
        },

        studentEmail: {
            type: String,
            required: true
        },

        studentPhone: {
            type: String,
            default: ""
        },

        matricNumber: {
            type: String,
            default: ""
        },

        service: {
            type: String,
            required: true
        },

        serviceName: {
            type: String,
            required: true
        },

        doctorId: {
            type: String,
            required: true
        },

        doctorName: {
            type: String,
            required: true
        },

        doctorSpecialization: {
            type: String,
            default: ""
        },

        date: {
            type: String,
            required: true
        },

        time: {
            type: String,
            required: true
        },

        appointmentType: {
            type: String,
            required: true
        },

        appointmentTypeName: {
            type: String,
            required: true
        },

        reason: {
            type: String,
            required: true
        },

        status: {
            type: String,
            enum: [
                "Pending",
                "Confirmed",
                "Completed",
                "Cancelled",
                "Rejected"
            ],
            default: "Pending"
        },

        doctorNote: {
            type: String,
            default: ""
        },

        rejectionReason: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "Appointment",
    appointmentSchema
);