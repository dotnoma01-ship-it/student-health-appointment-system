const express = require("express");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const Student = require("../model/student");

const router = express.Router();


// =====================================================
// GET ALL STUDENTS
// GET /api/students
// =====================================================

router.get("/", async (req, res) => {

    try {

        // Check MongoDB connection
        if (mongoose.connection.readyState !== 1) {

            return res.status(503).json({

                success: false,

                message:
                    "MongoDB is not connected."

            });

        }


        const students =
            await Student.find({})
                .select("-password")
                .sort({
                    createdAt: -1
                })
                .lean();


        return res.status(200).json({

            success: true,

            count:
                students.length,

            students:
                students

        });

    }

    catch (error) {

        console.error(
            "GET STUDENTS ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Server error while fetching students."

        });

    }

});


// =====================================================
// GET SINGLE STUDENT
// GET /api/students/:id
// =====================================================

router.get("/:id", async (req, res) => {

    try {

        // Validate MongoDB ID
        if (
            !mongoose.Types.ObjectId.isValid(
                req.params.id
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid student ID."

            });

        }


        const student =
            await Student.findById(
                req.params.id
            )
            .select("-password")
            .lean();


        if (!student) {

            return res.status(404).json({

                success: false,

                message:
                    "Student not found."

            });

        }


        return res.status(200).json({

            success: true,

            student:
                student

        });

    }

    catch (error) {

        console.error(
            "GET SINGLE STUDENT ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Server error while fetching student."

        });

    }

});


// =====================================================
// REGISTER STUDENT
// POST /api/students/register
// =====================================================

router.post("/register", async (req, res) => {

    try {

        const {
            firstName,
            lastName,
            email,
            password,
            phone,
            matricNumber,
            department,
            level,
            gender
        } = req.body;


        // ---------------------------------------------
        // REQUIRED FIELDS
        // ---------------------------------------------

        if (
            !firstName ||
            !lastName ||
            !email ||
            !password ||
            !phone ||
            !matricNumber ||
            !department ||
            !level ||
            !gender
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Please fill in all required fields."

            });

        }


        // ---------------------------------------------
        // PASSWORD LENGTH
        // ---------------------------------------------

        if (String(password).length < 8) {

            return res.status(400).json({

                success: false,

                message:
                    "Password must be at least 8 characters."

            });

        }


        // ---------------------------------------------
        // CLEAN INPUT
        // ---------------------------------------------

        const cleanEmail =
            String(email)
                .trim()
                .toLowerCase();


        const cleanMatric =
            String(matricNumber)
                .trim()
                .toUpperCase();


        // ---------------------------------------------
        // CHECK EXISTING EMAIL
        // ---------------------------------------------

        const existingEmail =
            await Student.findOne({

                email:
                    cleanEmail

            });


        if (existingEmail) {

            return res.status(409).json({

                success: false,

                message:
                    "A student with this email already exists."

            });

        }


        // ---------------------------------------------
        // CHECK EXISTING MATRIC NUMBER
        // ---------------------------------------------

        const existingMatric =
            await Student.findOne({

                matricNumber:
                    cleanMatric

            });


        if (existingMatric) {

            return res.status(409).json({

                success: false,

                message:
                    "A student with this matric number already exists."

            });

        }


        // ---------------------------------------------
        // HASH PASSWORD
        // ---------------------------------------------

        const hashedPassword =
            await bcrypt.hash(
                String(password),
                10
            );


        // ---------------------------------------------
        // CREATE STUDENT
        // ---------------------------------------------

        const student =
            new Student({

                firstName:
                    String(firstName).trim(),

                lastName:
                    String(lastName).trim(),

                email:
                    cleanEmail,

                password:
                    hashedPassword,

                phone:
                    String(phone).trim(),

                matricNumber:
                    cleanMatric,

                department:
                    String(department).trim(),

                level:
                    String(level).trim(),

                gender:
                    String(gender).trim()

            });


        // ---------------------------------------------
        // SAVE STUDENT
        // ---------------------------------------------

        const savedStudent =
            await student.save();


        // ---------------------------------------------
        // RESPONSE
        // ---------------------------------------------

        return res.status(201).json({

            success: true,

            message:
                "Student registered successfully.",

            student: {

                id:
                    String(
                        savedStudent._id
                    ),

                _id:
                    String(
                        savedStudent._id
                    ),

                firstName:
                    savedStudent.firstName,

                lastName:
                    savedStudent.lastName,

                email:
                    savedStudent.email,

                phone:
                    savedStudent.phone,

                matricNumber:
                    savedStudent.matricNumber,

                department:
                    savedStudent.department,

                level:
                    savedStudent.level,

                gender:
                    savedStudent.gender,

                createdAt:
                    savedStudent.createdAt

            }

        });

    }

    catch (error) {

        console.error(
            "STUDENT REGISTRATION ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Server error while registering student."

        });

    }

});


// =====================================================
// STUDENT LOGIN
// POST /api/students/login
// =====================================================

router.post("/login", async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;


        // ---------------------------------------------
        // VALIDATION
        // ---------------------------------------------

        if (!email || !password) {

            return res.status(400).json({

                success: false,

                message:
                    "Email and password are required."

            });

        }


        // ---------------------------------------------
        // CLEAN EMAIL
        // ---------------------------------------------

        const cleanEmail =
            String(email)
                .trim()
                .toLowerCase();


        // ---------------------------------------------
        // FIND STUDENT
        // ---------------------------------------------

        const student =
            await Student.findOne({

                email:
                    cleanEmail

            });


        if (!student) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid email or password."

            });

        }


        // ---------------------------------------------
        // CHECK PASSWORD
        // ---------------------------------------------

        const passwordMatch =
            await bcrypt.compare(

                String(password),

                student.password

            );


        if (!passwordMatch) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid email or password."

            });

        }


        // ---------------------------------------------
        // SUCCESS
        // ---------------------------------------------

        return res.status(200).json({

            success: true,

            message:
                "Login successful.",

            student: {

                id:
                    String(
                        student._id
                    ),

                _id:
                    String(
                        student._id
                    ),

                firstName:
                    student.firstName,

                lastName:
                    student.lastName,

                email:
                    student.email,

                phone:
                    student.phone,

                matricNumber:
                    student.matricNumber,

                department:
                    student.department,

                level:
                    student.level,

                gender:
                    student.gender

            }

        });

    }

    catch (error) {

        console.error(
            "STUDENT LOGIN ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Server error while logging in."

        });

    }

});


// =====================================================
// CHECK EMAIL FOR PASSWORD RESET
// POST /api/students/check-email
// =====================================================

router.post("/check-email", async (req, res) => {

    try {

        const {
            email
        } = req.body;


        if (!email) {

            return res.status(400).json({

                success: false,

                message:
                    "Email is required."

            });

        }


        const cleanEmail =
            String(email)
                .trim()
                .toLowerCase();


        const student =
            await Student.findOne({

                email:
                    cleanEmail

            });


        if (!student) {

            return res.status(404).json({

                success: false,

                message:
                    "No student account was found with this email."

            });

        }


        return res.status(200).json({

            success: true,

            message:
                "Email verified successfully."

        });

    }

    catch (error) {

        console.error(
            "CHECK EMAIL ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Server error while checking email."

        });

    }

});


// =====================================================
// RESET / FORGOT PASSWORD
// POST /api/students/forgot-password
// =====================================================

router.post("/forgot-password", async (req, res) => {

    try {

        const {
            email,
            newPassword
        } = req.body;


        // ---------------------------------------------
        // VALIDATION
        // ---------------------------------------------

        if (!email || !newPassword) {

            return res.status(400).json({

                success: false,

                message:
                    "Email and new password are required."

            });

        }


        if (String(newPassword).length < 8) {

            return res.status(400).json({

                success: false,

                message:
                    "New password must be at least 8 characters."

            });

        }


        // ---------------------------------------------
        // CLEAN EMAIL
        // ---------------------------------------------

        const cleanEmail =
            String(email)
                .trim()
                .toLowerCase();


        // ---------------------------------------------
        // FIND STUDENT
        // ---------------------------------------------

        const student =
            await Student.findOne({

                email:
                    cleanEmail

            });


        if (!student) {

            return res.status(404).json({

                success: false,

                message:
                    "Student account not found."

            });

        }


        // ---------------------------------------------
        // HASH NEW PASSWORD
        // ---------------------------------------------

        const hashedPassword =
            await bcrypt.hash(

                String(newPassword),

                10

            );


        // ---------------------------------------------
        // UPDATE PASSWORD
        // ---------------------------------------------

        student.password =
            hashedPassword;


        await student.save();


        // ---------------------------------------------
        // SUCCESS
        // ---------------------------------------------

        return res.status(200).json({

            success: true,

            message:
                "Password reset successfully."

        });

    }

    catch (error) {

        console.error(
            "FORGOT PASSWORD ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Server error while resetting password."

        });

    }

});


// =====================================================
// EXPORT ROUTER
// =====================================================

module.exports = router;