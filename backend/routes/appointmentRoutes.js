
const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const Appointment = require("../model/appointment");
const Student = require("../model/student");


// ======================================================
// HELPER: NORMALIZE STATUS
// ======================================================

function normalizeStatus(status) {

    if (!status) {
        return "Pending";
    }

    const value = String(status)
        .trim()
        .toLowerCase();

    switch (value) {

        case "pending":
        case "waiting":
            return "Pending";

        case "approved":
        case "approve":
        case "accepted":
        case "accept":
            return "Approved";

        case "completed":
        case "complete":
            return "Completed";

        case "declined":
        case "decline":
        case "rejected":
        case "reject":
            return "Declined";

        case "cancelled":
        case "canceled":
        case "cancel":
            return "Cancelled";

        default:
            return "Pending";
    }
}


// ======================================================
// GET ALL APPOINTMENTS
// GET /api/appointments
// ======================================================

router.get("/", async (req, res) => {

    try {

        const appointments =
            await Appointment.find({})
                .sort({
                    createdAt: -1
                })
                .lean();

        return res.status(200).json({

            success: true,

            count:
                appointments.length,

            appointments

        });

    }

    catch (error) {

        console.error(
            "Get all appointments error:",
            error.message
        );

        return res.status(500).json({

            success: false,

            message:
                "Server error while fetching appointments."

        });

    }

});


// ======================================================
// BOOK APPOINTMENT
// POST /api/appointments/book
// ======================================================

router.post("/book", async (req, res) => {

    try {

        const {

            studentId,
            studentName,
            studentEmail,
            studentPhone,
            matricNumber,

            service,
            serviceName,

            doctorId,
            doctorName,
            doctorSpecialization,

            date,
            time,

            appointmentType,
            appointmentTypeName,

            reason

        } = req.body;


        // ==================================================
        // REQUIRED FIELDS
        // ==================================================

        if (

            !studentId ||
            !studentName ||
            !studentEmail ||
            !service ||
            !serviceName ||
            !doctorId ||
            !doctorName ||
            !date ||
            !time ||
            !appointmentType ||
            !appointmentTypeName ||
            !reason

        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Please provide all required appointment information."

            });

        }


        // ==================================================
        // CLEAN STUDENT INFORMATION
        // ==================================================

        const cleanStudentId =
            String(studentId).trim();

        const cleanEmail =
            String(studentEmail)
                .trim()
                .toLowerCase();

        const cleanMatric =
            matricNumber
                ? String(matricNumber)
                    .trim()
                    .toUpperCase()
                : "";


        // ==================================================
        // CHECK DUPLICATE APPOINTMENT
        // ==================================================

        const duplicateConditions = [

            {
                studentId:
                    cleanStudentId
            },

            {
                studentEmail:
                    cleanEmail
            }

        ];


        if (cleanMatric) {

            duplicateConditions.push({

                matricNumber:
                    cleanMatric

            });

        }


        const existingAppointment =
            await Appointment.findOne({

                $or:
                    duplicateConditions,

                date:
                    String(date).trim(),

                time:
                    String(time).trim(),

                status: {

                    $nin: [

                        "Declined",
                        "declined",

                        "Rejected",
                        "rejected",

                        "Cancelled",
                        "cancelled",

                        "Canceled",
                        "canceled"

                    ]

                }

            });


        if (existingAppointment) {

            return res.status(409).json({

                success: false,

                message:
                    "You already have an appointment at this date and time."

            });

        }


        // ==================================================
        // CREATE APPOINTMENT
        // ==================================================

        const appointment =
            await Appointment.create({

                studentId:
                    cleanStudentId,

                studentName:
                    String(studentName).trim(),

                studentEmail:
                    cleanEmail,

                studentPhone:
                    studentPhone
                        ? String(studentPhone).trim()
                        : "",

                matricNumber:
                    cleanMatric,

                service:
                    String(service).trim(),

                serviceName:
                    String(serviceName).trim(),

                doctorId:
                    String(doctorId).trim(),

                doctorName:
                    String(doctorName).trim(),

                doctorSpecialization:
                    doctorSpecialization
                        ? String(doctorSpecialization).trim()
                        : "",

                date:
                    String(date).trim(),

                time:
                    String(time).trim(),

                appointmentType:
                    String(appointmentType).trim(),

                appointmentTypeName:
                    String(appointmentTypeName).trim(),

                reason:
                    String(reason).trim(),

                status:
                    "Pending",

                doctorNote:
                    "",

                rejectionReason:
                    ""

            });


        return res.status(201).json({

            success: true,

            message:
                "Appointment booked successfully.",

            appointment

        });

    }

    catch (error) {

        console.error(
            "Appointment booking error:",
            error.message
        );

        return res.status(500).json({

            success: false,

            message:
                "Server error while booking appointment."

        });

    }

});


// ======================================================
// GET APPOINTMENTS FOR ONE STUDENT
// GET /api/appointments/student/:studentId
// ======================================================

router.get(
    "/student/:studentId",
    async (req, res) => {

        try {

            const studentId =
                String(req.params.studentId).trim();


            if (!studentId) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Student ID is required."

                });

            }


            // ==================================================
            // FIND STUDENT
            // ==================================================

            let student = null;


            if (
                mongoose.Types.ObjectId.isValid(
                    studentId
                )
            ) {

                student =
                    await Student.findById(
                        studentId
                    ).lean();

            }


            // ==================================================
            // SEARCH CONDITIONS
            // ==================================================

            const conditions = [

                {
                    studentId:
                        studentId
                }

            ];


            // ==================================================
            // EMAIL BACKUP
            // ==================================================

            if (
                student &&
                student.email
            ) {

                conditions.push({

                    studentEmail:
                        String(student.email)
                            .trim()
                            .toLowerCase()

                });

            }


            // ==================================================
            // MATRIC BACKUP
            // ==================================================

            if (
                student &&
                student.matricNumber
            ) {

                conditions.push({

                    matricNumber:
                        String(
                            student.matricNumber
                        )
                            .trim()
                            .toUpperCase()

                });

            }


            // ==================================================
            // FIND APPOINTMENTS
            // ==================================================

            const appointments =
                await Appointment.find({

                    $or:
                        conditions

                })
                    .sort({

                        createdAt:
                            -1

                    })
                    .lean();


            return res.status(200).json({

                success: true,

                count:
                    appointments.length,

                appointments

            });

        }

        catch (error) {

            console.error(
                "Get student appointments error:",
                error.message
            );

            return res.status(500).json({

                success: false,

                message:
                    "Server error while fetching student appointments."

            });

        }

    }
);


// ======================================================
// GET APPOINTMENTS FOR DOCTOR
// GET /api/appointments/doctor/:doctorId
// ======================================================

router.get(
    "/doctor/:doctorId",
    async (req, res) => {

        try {

            const doctorId =
                String(req.params.doctorId).trim();


            if (!doctorId) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Doctor ID is required."

                });

            }


            const appointments =
                await Appointment.find({

                    doctorId:
                        doctorId

                })
                    .sort({

                        createdAt:
                            -1

                    })
                    .lean();


            return res.status(200).json({

                success: true,

                count:
                    appointments.length,

                appointments

            });

        }

        catch (error) {

            console.error(
                "Get doctor appointments error:",
                error.message
            );

            return res.status(500).json({

                success: false,

                message:
                    "Server error while fetching doctor appointments."

            });

        }

    }
);


// ======================================================
// GET ONE APPOINTMENT
// GET /api/appointments/:id
// ======================================================

router.get("/:id", async (req, res) => {

    try {

        const appointment =
            await Appointment.findById(
                req.params.id
            );


        if (!appointment) {

            return res.status(404).json({

                success: false,

                message:
                    "Appointment not found."

            });

        }


        return res.status(200).json({

            success: true,

            appointment

        });

    }

    catch (error) {

        console.error(
            "Get appointment error:",
            error.message
        );

        return res.status(500).json({

            success: false,

            message:
                "Server error while fetching appointment."

        });

    }

});


// ======================================================
// UPDATE APPOINTMENT STATUS
// PUT /api/appointments/:id/status
// ======================================================

router.put(
    "/:id/status",
    async (req, res) => {

        try {

            const {

                status,
                doctorNote,
                rejectionReason

            } = req.body;


            // ==================================================
            // CHECK STATUS
            // ==================================================

            if (
                status === undefined ||
                status === null ||
                String(status).trim() === ""
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Appointment status is required."

                });

            }


            // ==================================================
            // FIND APPOINTMENT
            // ==================================================

            const appointment =
                await Appointment.findById(
                    req.params.id
                );


            if (!appointment) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Appointment not found."

                });

            }


            // ==================================================
            // NORMALIZE STATUS
            // ==================================================

            appointment.status =
                normalizeStatus(status);


            // ==================================================
            // DOCTOR NOTE
            // ==================================================

            if (
                doctorNote !== undefined
            ) {

                appointment.doctorNote =
                    String(doctorNote);

            }


            // ==================================================
            // REJECTION REASON
            // ==================================================

            if (
                rejectionReason !== undefined
            ) {

                appointment.rejectionReason =
                    String(rejectionReason);

            }


            // ==================================================
            // SAVE
            // ==================================================

            await appointment.save();


            return res.status(200).json({

                success: true,

                message:
                    "Appointment status updated successfully.",

                appointment

            });

        }

        catch (error) {

            console.error(
                "Update appointment status error:",
                error.message
            );

            return res.status(500).json({

                success: false,

                message:
                    "Server error while updating appointment status."

            });

        }

    }
);


// ======================================================
// UPDATE COMPLETE APPOINTMENT
// PUT /api/appointments/:id
// ======================================================

router.put("/:id", async (req, res) => {

    try {

        const appointment =
            await Appointment.findById(
                req.params.id
            );


        if (!appointment) {

            return res.status(404).json({

                success: false,

                message:
                    "Appointment not found."

            });

        }


        const {

            status,
            doctorNote,
            rejectionReason,
            date,
            time,
            doctorName,
            doctorSpecialization

        } = req.body;


        // ==================================================
        // STATUS
        // ==================================================

        if (
            status !== undefined
        ) {

            appointment.status =
                normalizeStatus(status);

        }


        // ==================================================
        // OTHER FIELDS
        // ==================================================

        if (
            doctorNote !== undefined
        ) {

            appointment.doctorNote =
                String(doctorNote);

        }


        if (
            rejectionReason !== undefined
        ) {

            appointment.rejectionReason =
                String(rejectionReason);

        }


        if (
            date !== undefined
        ) {

            appointment.date =
                String(date);

        }


        if (
            time !== undefined
        ) {

            appointment.time =
                String(time);

        }


        if (
            doctorName !== undefined
        ) {

            appointment.doctorName =
                String(doctorName);

        }


        if (
            doctorSpecialization !== undefined
        ) {

            appointment.doctorSpecialization =
                String(doctorSpecialization);

        }


        await appointment.save();


        return res.status(200).json({

            success: true,

            message:
                "Appointment updated successfully.",

            appointment

        });

    }

    catch (error) {

        console.error(
            "Update appointment error:",
            error.message
        );

        return res.status(500).json({

            success: false,

            message:
                "Server error while updating appointment."

        });

    }

});


// ======================================================
// DELETE APPOINTMENT
// DELETE /api/appointments/:id
// ======================================================

router.delete("/:id", async (req, res) => {

    try {

        const appointment =
            await Appointment.findByIdAndDelete(
                req.params.id
            );


        if (!appointment) {

            return res.status(404).json({

                success: false,

                message:
                    "Appointment not found."

            });

        }


        return res.status(200).json({

            success: true,

            message:
                "Appointment deleted successfully."

        });

    }

    catch (error) {

        console.error(
            "Delete appointment error:",
            error.message
        );

        return res.status(500).json({

            success: false,

            message:
                "Server error while deleting appointment."

        });

    }

});


// ======================================================
// EXPORT
// ======================================================

module.exports = router;

