const express = require("express");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const crypto = require("crypto");

const Student = require("../model/student");
const { sendVerificationCode } = require("../utils/email");

const router = express.Router();


// =====================================================
// HELPER: CREATE 6-DIGIT OTP
// =====================================================

function generateOTP() {
    return crypto.randomInt(100000, 1000000).toString();
}


// =====================================================
// HELPER: STUDENT RESPONSE
// Never return passwords or OTP information
// =====================================================

function getStudentData(student) {
    return {
        id: String(student._id),
        _id: String(student._id),
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        phone: student.phone,
        matricNumber: student.matricNumber,
        department: student.department,
        level: student.level,
        gender: student.gender
    };
}


// =====================================================
// GET ALL STUDENTS
// GET /api/students
// =====================================================

router.get("/", async (req, res) => {
    try {

        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({
                success: false,
                message: "MongoDB is not connected."
            });
        }

        const students = await Student.find({})
            .select("-password -otpHash")
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            count: students.length,
            students
        });

    } catch (error) {

        console.error("GET STUDENTS ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while fetching students."
        });
    }
});


// =====================================================
// GET SINGLE STUDENT
// GET /api/students/:id
// =====================================================

router.get("/:id", async (req, res) => {
    try {

        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid student ID."
            });
        }

        const student = await Student.findById(req.params.id)
            .select("-password -otpHash")
            .lean();

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found."
            });
        }

        return res.status(200).json({
            success: true,
            student
        });

    } catch (error) {

        console.error("GET SINGLE STUDENT ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while fetching student."
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
                message: "Please fill in all required fields."
            });
        }


        // ---------------------------------------------
        // PASSWORD LENGTH
        // ---------------------------------------------

        if (String(password).length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters."
            });
        }


        // ---------------------------------------------
        // CLEAN INPUT
        // ---------------------------------------------

        const cleanEmail = String(email)
            .trim()
            .toLowerCase();

        const cleanMatric = String(matricNumber)
            .trim()
            .toUpperCase();


        // ---------------------------------------------
        // CHECK EMAIL
        // ---------------------------------------------

        const existingEmail = await Student.findOne({
            email: cleanEmail
        });

        if (existingEmail) {
            return res.status(409).json({
                success: false,
                message: "A student with this email already exists."
            });
        }


        // ---------------------------------------------
        // CHECK MATRIC NUMBER
        // ---------------------------------------------

        const existingMatric = await Student.findOne({
            matricNumber: cleanMatric
        });

        if (existingMatric) {
            return res.status(409).json({
                success: false,
                message: "A student with this matric number already exists."
            });
        }


        // ---------------------------------------------
        // HASH PASSWORD
        // ---------------------------------------------

        const hashedPassword = await bcrypt.hash(
            String(password),
            10
        );


        // ---------------------------------------------
        // CREATE STUDENT
        // ---------------------------------------------

        const student = new Student({

            firstName: String(firstName).trim(),

            lastName: String(lastName).trim(),

            email: cleanEmail,

            password: hashedPassword,

            phone: String(phone).trim(),

            matricNumber: cleanMatric,

            department: String(department).trim(),

            level: String(level).trim(),

            gender: String(gender).trim(),

            twoFactorEnabled: true,

            otpHash: null,

            otpExpiresAt: null,

            otpAttempts: 0,

            otpLastSentAt: null

        });


        // ---------------------------------------------
        // SAVE
        // ---------------------------------------------

        const savedStudent = await student.save();


        // ---------------------------------------------
        // RESPONSE
        // ---------------------------------------------

        return res.status(201).json({

            success: true,

            message: "Student registered successfully.",

            student: getStudentData(savedStudent)

        });

    } catch (error) {

        console.error(
            "STUDENT REGISTRATION ERROR:",
            error
        );

        return res.status(500).json({

            success: false,

            message: "Server error while registering student."

        });
    }
});


// =====================================================
// STUDENT LOGIN - STEP 1
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
                message: "Email and password are required."
            });
        }


        // ---------------------------------------------
        // CLEAN EMAIL
        // ---------------------------------------------

        const cleanEmail = String(email)
            .trim()
            .toLowerCase();


        // ---------------------------------------------
        // FIND STUDENT
        // ---------------------------------------------

        const student = await Student.findOne({
            email: cleanEmail
        });


        if (!student) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }


        // ---------------------------------------------
        // CHECK PASSWORD
        // ---------------------------------------------

        const passwordMatch = await bcrypt.compare(
            String(password),
            student.password
        );


        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }


        // =================================================
        // TWO-FACTOR AUTHENTICATION
        // =================================================

        const otp = generateOTP();


        // ---------------------------------------------
        // HASH OTP
        // ---------------------------------------------

        const otpHash = await bcrypt.hash(
            otp,
            10
        );


        // ---------------------------------------------
        // SAVE OTP
        // ---------------------------------------------

        student.otpHash = otpHash;

        student.otpExpiresAt = new Date(
            Date.now() + 10 * 60 * 1000
        );

        student.otpAttempts = 0;

        student.otpLastSentAt = new Date();


        await student.save();


        // ---------------------------------------------
        // SEND OTP
        // ---------------------------------------------

        try {

            await sendVerificationCode(
                student.email,
                otp
            );

        } catch (emailError) {

            console.error(
                "OTP EMAIL ERROR:",
                emailError
            );


            // Clear OTP if email fails

            student.otpHash = null;

            student.otpExpiresAt = null;

            student.otpAttempts = 0;

            student.otpLastSentAt = null;

            await student.save();


            return res.status(500).json({

                success: false,

                message:
                    "Unable to send verification code. Please try again."

            });
        }


        // ---------------------------------------------
        // OTP SENT
        // ---------------------------------------------

        return res.status(200).json({

            success: true,

            requiresTwoFactor: true,

            message:
                "A verification code has been sent to your email.",

            email:
                student.email,

            studentId:
                String(student._id)

        });

    } catch (error) {

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
// VERIFY OTP - STEP 2
// POST /api/students/verify-otp
// =====================================================

router.post("/verify-otp", async (req, res) => {
    try {

        const {
            studentId,
            otp
        } = req.body;


        // ---------------------------------------------
        // VALIDATION
        // ---------------------------------------------

        if (!studentId || !otp) {

            return res.status(400).json({

                success: false,

                message:
                    "Student ID and verification code are required."

            });
        }


        // ---------------------------------------------
        // OTP FORMAT
        // ---------------------------------------------

        if (!/^\d{6}$/.test(String(otp).trim())) {

            return res.status(400).json({

                success: false,

                message:
                    "Verification code must be 6 digits."

            });
        }


        // ---------------------------------------------
        // VALIDATE STUDENT ID
        // ---------------------------------------------

        if (
            !mongoose.Types.ObjectId.isValid(studentId)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid student ID."

            });
        }


        // ---------------------------------------------
        // FIND STUDENT
        // ---------------------------------------------

        const student =
            await Student.findById(studentId);


        if (!student) {

            return res.status(404).json({

                success: false,

                message:
                    "Student account not found."

            });
        }


        // ---------------------------------------------
        // CHECK OTP
        // ---------------------------------------------

        if (
            !student.otpHash ||
            !student.otpExpiresAt
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "No active verification code. Please request a new code."

            });
        }


        // ---------------------------------------------
        // CHECK EXPIRATION
        // ---------------------------------------------

        if (
            new Date() >
            new Date(student.otpExpiresAt)
        ) {

            student.otpHash = null;

            student.otpExpiresAt = null;

            student.otpAttempts = 0;

            student.otpLastSentAt = null;

            await student.save();


            return res.status(400).json({

                success: false,

                message:
                    "Verification code has expired. Please request a new code."

            });
        }


        // ---------------------------------------------
        // CHECK ATTEMPT LIMIT
        // ---------------------------------------------

        if (student.otpAttempts >= 5) {

            student.otpHash = null;

            student.otpExpiresAt = null;

            student.otpAttempts = 0;

            student.otpLastSentAt = null;

            await student.save();


            return res.status(429).json({

                success: false,

                message:
                    "Too many incorrect attempts. Please request a new code."

            });
        }


        // ---------------------------------------------
        // COMPARE OTP
        // ---------------------------------------------

        const otpMatch =
            await bcrypt.compare(
                String(otp).trim(),
                student.otpHash
            );


        // ---------------------------------------------
        // WRONG OTP
        // ---------------------------------------------

        if (!otpMatch) {

            student.otpAttempts =
                Number(student.otpAttempts || 0) + 1;

            await student.save();


            const remainingAttempts =
                Math.max(
                    0,
                    5 - student.otpAttempts
                );


            return res.status(401).json({

                success: false,

                message:
                    `Incorrect verification code. ${remainingAttempts} attempt(s) remaining.`

            });
        }


        // ---------------------------------------------
        // OTP CORRECT
        // ---------------------------------------------

        student.otpHash = null;

        student.otpExpiresAt = null;

        student.otpAttempts = 0;

        student.otpLastSentAt = null;


        await student.save();


        // ---------------------------------------------
        // LOGIN COMPLETE
        // ---------------------------------------------

        return res.status(200).json({

            success: true,

            message:
                "Two-factor verification successful. Login complete.",

            student:
                getStudentData(student)

        });

    } catch (error) {

        console.error(
            "VERIFY OTP ERROR:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Server error while verifying code."

        });
    }
});


// =====================================================
// RESEND OTP
// POST /api/students/resend-otp
// =====================================================

router.post("/resend-otp", async (req, res) => {
    try {

        const {
            studentId
        } = req.body;


        // ---------------------------------------------
        // VALIDATION
        // ---------------------------------------------

        if (!studentId) {

            return res.status(400).json({

                success: false,

                message:
                    "Student ID is required."

            });
        }


        if (
            !mongoose.Types.ObjectId.isValid(studentId)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid student ID."

            });
        }


        // ---------------------------------------------
        // FIND STUDENT
        // ---------------------------------------------

        const student =
            await Student.findById(studentId);


        if (!student) {

            return res.status(404).json({

                success: false,

                message:
                    "Student account not found."

            });
        }


        // ---------------------------------------------
        // RESEND COOLDOWN
        // 60 seconds
        // ---------------------------------------------

        if (student.otpLastSentAt) {

            const secondsSinceLastSent =
                Math.floor(
                    (
                        Date.now() -
                        new Date(student.otpLastSentAt).getTime()
                    ) / 1000
                );


            if (secondsSinceLastSent < 60) {

                const secondsRemaining =
                    60 - secondsSinceLastSent;


                return res.status(429).json({

                    success: false,

                    message:
                        `Please wait ${secondsRemaining} seconds before requesting another code.`

                });
            }
        }


        // ---------------------------------------------
        // CREATE NEW OTP
        // ---------------------------------------------

        const otp =
            generateOTP();


        const otpHash =
            await bcrypt.hash(
                otp,
                10
            );


        // ---------------------------------------------
        // SAVE NEW OTP
        // ---------------------------------------------

        student.otpHash =
            otpHash;

        student.otpExpiresAt =
            new Date(
                Date.now() +
                10 * 60 * 1000
            );

        student.otpAttempts = 0;

        student.otpLastSentAt =
            new Date();


        await student.save();


        // ---------------------------------------------
        // SEND NEW OTP
        // ---------------------------------------------

        try {

            await sendVerificationCode(
                student.email,
                otp
            );

        } catch (emailError) {

            console.error(
                "RESEND OTP EMAIL ERROR:",
                emailError
            );


            student.otpHash = null;

            student.otpExpiresAt = null;

            student.otpAttempts = 0;

            student.otpLastSentAt = null;


            await student.save();


            return res.status(500).json({

                success: false,

                message:
                    "Unable to send a new verification code."

            });
        }


        // ---------------------------------------------
        // SUCCESS
        // ---------------------------------------------

        return res.status(200).json({

            success: true,

            message:
                "A new verification code has been sent to your email."

        });

    } catch (error) {

        console.error(
            "RESEND OTP ERROR:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Server error while resending code."

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
                email: cleanEmail
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

    } catch (error) {

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
                email: cleanEmail
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

    } catch (error) {

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