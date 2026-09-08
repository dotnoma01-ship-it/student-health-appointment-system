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
// Never return password or OTP information
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
        gender: student.gender,

        emailVerified: student.emailVerified
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
            .select("-password -otpHash -otpExpiresAt -otpAttempts -otpLastSentAt")
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

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid student ID."
            });
        }

        const student = await Student.findById(id)
            .select("-password -otpHash -otpExpiresAt -otpAttempts -otpLastSentAt")
            .lean();

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found."
            });
        }

        return res.status(200).json({
            success: true,
            student: getStudentData(student)
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

        // Check required fields
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

        // Password validation
        if (String(password).length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters."
            });
        }

        // Clean input
        const cleanFirstName = String(firstName).trim();
        const cleanLastName = String(lastName).trim();

        const cleanEmail = String(email)
            .trim()
            .toLowerCase();

        const cleanPhone = String(phone).trim();

        const cleanMatric = String(matricNumber)
            .trim()
            .toUpperCase();

        const cleanDepartment = String(department).trim();
        const cleanLevel = String(level).trim();
        const cleanGender = String(gender).trim();


        // =================================================
        // CHECK EMAIL
        // =================================================

        const existingEmail = await Student.findOne({
            email: cleanEmail
        });

        if (existingEmail) {

            // If the account exists but email is not verified,
            // allow the user to request a new OTP instead of
            // creating another account.

            if (existingEmail.emailVerified === false) {

                return res.status(409).json({
                    success: false,
                    requiresVerification: true,
                    message:
                        "An account with this email already exists but has not been verified.",
                    studentId: String(existingEmail._id)
                });
            }

            return res.status(409).json({
                success: false,
                message: "A student with this email already exists."
            });
        }


        // =================================================
        // CHECK MATRIC NUMBER
        // =================================================

        const existingMatric = await Student.findOne({
            matricNumber: cleanMatric
        });

        if (existingMatric) {
            return res.status(409).json({
                success: false,
                message:
                    "A student with this matric number already exists."
            });
        }


        // =================================================
        // HASH PASSWORD
        // =================================================

        const hashedPassword = await bcrypt.hash(
            String(password),
            10
        );


        // =================================================
        // CREATE STUDENT
        // =================================================

        const student = new Student({
            firstName: cleanFirstName,
            lastName: cleanLastName,
            email: cleanEmail,
            password: hashedPassword,
            phone: cleanPhone,
            matricNumber: cleanMatric,
            department: cleanDepartment,
            level: cleanLevel,
            gender: cleanGender,

            // Email must be verified during registration
            emailVerified: false,

            // Keep this field for future optional 2FA
            twoFactorEnabled: false,

            otpHash: null,
            otpExpiresAt: null,
            otpAttempts: 0,
            otpLastSentAt: null
        });


        // =================================================
        // CREATE REGISTRATION OTP
        // =================================================

        const otp = generateOTP();

        const otpHash = await bcrypt.hash(
            otp,
            10
        );

        student.otpHash = otpHash;

        student.otpExpiresAt = new Date(
            Date.now() + 10 * 60 * 1000
        );

        student.otpAttempts = 0;
        student.otpLastSentAt = new Date();


        // =================================================
        // SAVE STUDENT
        // =================================================

        await student.save();


        // =================================================
        // SEND REGISTRATION OTP
        // =================================================

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

            // Delete account if email could not be sent
            await Student.findByIdAndDelete(student._id);

            return res.status(500).json({
                success: false,
                message:
                    "Unable to send verification code. Please try again."
            });
        }


        // =================================================
        // RESPONSE
        // =================================================

        return res.status(201).json({
            success: true,
            message:
                "Student registered successfully. Verification code sent to your email.",
            studentId: String(student._id),
            email: student.email
        });

    } catch (error) {

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
//
// OTP IS NOT SENT DURING NORMAL LOGIN.
// OTP IS ONLY REQUIRED FOR EMAIL VERIFICATION.
// =====================================================

router.post("/login", async (req, res) => {
    try {

        const {
            email,
            password
        } = req.body;

        // Check required fields
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message:
                    "Email and password are required."
            });
        }

        // Clean email
        const cleanEmail = String(email)
            .trim()
            .toLowerCase();

        // Find student
        const student = await Student.findOne({
            email: cleanEmail
        });

        // Student not found
        if (!student) {
            return res.status(401).json({
                success: false,
                message:
                    "Invalid email or password."
            });
        }


        // =================================================
        // CHECK PASSWORD
        // =================================================

        const passwordMatch = await bcrypt.compare(
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


        // =================================================
        // CHECK EMAIL VERIFICATION
        // =================================================

        if (!student.emailVerified) {

            return res.status(403).json({
                success: false,
                requiresVerification: true,
                message:
                    "Please verify your email before logging in.",
                studentId: String(student._id),
                email: student.email
            });
        }


        // =================================================
        // LOGIN SUCCESSFUL
        // NO OTP
        // =================================================

        return res.status(200).json({
            success: true,
            message:
                "Student login successful.",
            student:
                getStudentData(student)
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
// VERIFY REGISTRATION OTP
// POST /api/students/verify-otp
// =====================================================

router.post("/verify-otp", async (req, res) => {
    try {

        const {
            studentId,
            otp
        } = req.body;


        if (!studentId || !otp) {
            return res.status(400).json({
                success: false,
                message:
                    "Student ID and verification code are required."
            });
        }


        if (!/^\d{6}$/.test(String(otp).trim())) {
            return res.status(400).json({
                success: false,
                message:
                    "Verification code must be 6 digits."
            });
        }


        if (!mongoose.Types.ObjectId.isValid(studentId)) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid student ID."
            });
        }


        const student = await Student.findById(
            studentId
        );


        if (!student) {
            return res.status(404).json({
                success: false,
                message:
                    "Student account not found."
            });
        }


        // Already verified
        if (student.emailVerified) {
            return res.status(400).json({
                success: false,
                message:
                    "This student account is already verified."
            });
        }


        // =================================================
        // CHECK OTP EXISTS
        // =================================================

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


        // =================================================
        // CHECK EXPIRATION
        // =================================================

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


        // =================================================
        // CHECK ATTEMPT LIMIT
        // =================================================

        if (
            Number(student.otpAttempts || 0) >= 5
        ) {

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


        // =================================================
        // COMPARE OTP
        // =================================================

        const otpMatch = await bcrypt.compare(
            String(otp).trim(),
            student.otpHash
        );


        // =================================================
        // WRONG OTP
        // =================================================

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


        // =================================================
        // CORRECT OTP
        // =================================================

        student.otpHash = null;
        student.otpExpiresAt = null;
        student.otpAttempts = 0;
        student.otpLastSentAt = null;

        student.emailVerified = true;

        await student.save();


        // =================================================
        // SUCCESS
        // =================================================

        return res.status(200).json({
            success: true,
            message:
                "Email verified successfully. Registration complete.",
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
// RESEND REGISTRATION OTP
// POST /api/students/resend-otp
// =====================================================

router.post("/resend-otp", async (req, res) => {
    try {

        const {
            studentId
        } = req.body;


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


        const student =
            await Student.findById(studentId);


        if (!student) {
            return res.status(404).json({
                success: false,
                message:
                    "Student account not found."
            });
        }


        // Don't resend OTP to an already verified account
        if (student.emailVerified) {
            return res.status(400).json({
                success: false,
                message:
                    "This account is already verified."
            });
        }


        // =================================================
        // 60 SECOND COOLDOWN
        // =================================================

        if (student.otpLastSentAt) {

            const secondsSinceLastSent =
                Math.floor(
                    (
                        Date.now() -
                        new Date(
                            student.otpLastSentAt
                        ).getTime()
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


        // =================================================
        // CREATE NEW OTP
        // =================================================

        const otp = generateOTP();

        const otpHash =
            await bcrypt.hash(
                otp,
                10
            );


        student.otpHash = otpHash;

        student.otpExpiresAt =
            new Date(
                Date.now() +
                10 * 60 * 1000
            );

        student.otpAttempts = 0;
        student.otpLastSentAt = new Date();


        await student.save();


        // =================================================
        // SEND OTP
        // =================================================

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
// CHECK EMAIL
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
                "Student email exists.",
            emailVerified:
                !!student.emailVerified
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
// FORGOT PASSWORD
// =====================================================
//
// NOTE:
// This route currently changes the password directly.
// For production, this should be protected by a
// password-reset OTP/email verification flow.
// =====================================================

router.post("/forgot-password", async (req, res) => {
    try {

        const {
            email,
            newPassword
        } = req.body;


        if (!email || !newPassword) {
            return res.status(400).json({
                success: false,
                message:
                    "Email and new password are required."
            });
        }


        if (
            String(newPassword).length < 8
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "New password must be at least 8 characters."
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
                    "Student account not found."
            });
        }


        const hashedPassword =
            await bcrypt.hash(
                String(newPassword),
                10
            );


        student.password =
            hashedPassword;


        await student.save();


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
// UPDATE STUDENT PROFILE
// PUT /api/students/:studentId
// =====================================================

router.put("/:studentId", async (req, res) => {
    try {

        const {
            studentId
        } = req.params;


        const {
            firstName,
            lastName,
            email,
            phone,
            gender,
            department,
            level
        } = req.body;


        // =================================================
        // VALIDATE ID
        // =================================================

        if (
            !mongoose.Types.ObjectId.isValid(studentId)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid student ID."
            });
        }


        // =================================================
        // REQUIRED FIELDS
        // =================================================

        if (
            !firstName ||
            !lastName ||
            !email ||
            !phone ||
            !gender ||
            !department ||
            !level
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "All profile fields are required."
            });
        }


        // =================================================
        // CLEAN INPUT
        // =================================================

        const cleanFirstName =
            String(firstName).trim();

        const cleanLastName =
            String(lastName).trim();

        const cleanEmail =
            String(email)
                .trim()
                .toLowerCase();

        const cleanPhone =
            String(phone).trim();

        const cleanGender =
            String(gender).trim();

        const cleanDepartment =
            String(department).trim();

        const cleanLevel =
            String(level).trim();


        // =================================================
        // FIND STUDENT
        // =================================================

        const student =
            await Student.findById(
                studentId
            );


        if (!student) {

            return res.status(404).json({
                success: false,
                message:
                    "Student account not found."
            });
        }


        // =================================================
        // CHECK EMAIL
        // =================================================

        const existingEmail =
            await Student.findOne({

                email: cleanEmail,

                _id: {
                    $ne: student._id
                }

            });


        if (existingEmail) {

            return res.status(409).json({
                success: false,
                message:
                    "Another student is already using this email."
            });
        }


        // =================================================
        // UPDATE
        // =================================================

        student.firstName =
            cleanFirstName;

        student.lastName =
            cleanLastName;

        student.email =
            cleanEmail;

        student.phone =
            cleanPhone;

        student.gender =
            cleanGender;

        student.department =
            cleanDepartment;

        student.level =
            cleanLevel;


        // =================================================
        // SAVE
        // =================================================

        const updatedStudent =
            await student.save();


        // =================================================
        // RESPONSE
        // =================================================

        return res.status(200).json({

            success: true,

            message:
                "Profile updated successfully.",

            student:
                getStudentData(
                    updatedStudent
                )

        });

    } catch (error) {

        console.error(
            "UPDATE STUDENT PROFILE ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Server error while updating profile."
        });
    }
});


// =====================================================
// EXPORT ROUTER
// =====================================================

module.exports = router;

