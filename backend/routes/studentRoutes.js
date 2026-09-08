const express = require("express");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const crypto = require("crypto");

const router = express.Router();

const Student = require("../model/student");
const { sendVerificationCode } = require("../utils/email");


// ======================================================
// GENERATE 6-DIGIT OTP
// ======================================================

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}


// ======================================================
// GET STUDENT DATA WITHOUT SENSITIVE INFORMATION
// ======================================================

function getStudentData(student) {
    return {
        id: student._id,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        emailVerified: student.emailVerified,
        phone: student.phone,
        matricNumber: student.matricNumber,
        department: student.department,
        level: student.level,
        gender: student.gender,
        twoFactorEnabled: student.twoFactorEnabled,
        createdAt: student.createdAt,
        updatedAt: student.updatedAt
    };
}


// ======================================================
// GET ALL STUDENTS
// ======================================================

router.get("/", async (req, res) => {
    try {
        const students = await Student.find()
            .select(
                "-password " +
                "-otpHash " +
                "-otpExpiresAt " +
                "-otpAttempts " +
                "-otpLastSentAt " +
                "-resetOtpHash " +
                "-resetOtpExpiresAt " +
                "-resetOtpAttempts " +
                "-resetOtpLastSentAt " +
                "-resetToken " +
                "-resetTokenExpiresAt"
            )
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: students.length,
            students
        });

    } catch (error) {
        console.error("GET STUDENTS ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Server error while fetching students."
        });
    }
});


// ======================================================
// GET ONE STUDENT
// ======================================================

router.get("/:id", async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid student ID."
            });
        }

        const student = await Student.findById(req.params.id)
            .select(
                "-password " +
                "-otpHash " +
                "-otpExpiresAt " +
                "-otpAttempts " +
                "-otpLastSentAt " +
                "-resetOtpHash " +
                "-resetOtpExpiresAt " +
                "-resetOtpAttempts " +
                "-resetOtpLastSentAt " +
                "-resetToken " +
                "-resetTokenExpiresAt"
            );

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found."
            });
        }

        res.status(200).json({
            success: true,
            student
        });

    } catch (error) {
        console.error("GET STUDENT ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Server error while fetching student."
        });
    }
});


// ======================================================
// STUDENT REGISTRATION
// ======================================================

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
                message: "All fields are required."
            });
        }

        if (String(password).length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters."
            });
        }

        const cleanEmail = String(email).trim().toLowerCase();
        const cleanMatric = String(matricNumber).trim().toUpperCase();

        const existingEmail = await Student.findOne({
            email: cleanEmail
        });

        if (existingEmail) {
            return res.status(409).json({
                success: false,
                message: "A student with this email already exists."
            });
        }

        const existingMatric = await Student.findOne({
            matricNumber: cleanMatric
        });

        if (existingMatric) {
            return res.status(409).json({
                success: false,
                message: "A student with this matric number already exists."
            });
        }

        const hashedPassword = await bcrypt.hash(
            String(password),
            10
        );

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

            emailVerified: false,
            twoFactorEnabled: false
        });

        const otp = generateOTP();

        student.otpHash = await bcrypt.hash(otp, 10);
        student.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
        student.otpAttempts = 0;
        student.otpLastSentAt = new Date();

        await student.save();

        try {
            await sendVerificationCode(cleanEmail, otp);
        } catch (emailError) {
            console.error("REGISTRATION EMAIL ERROR:", emailError);

            await Student.findByIdAndDelete(student._id);

            return res.status(500).json({
                success: false,
                message: "Unable to send verification email. Please try again."
            });
        }

        res.status(201).json({
            success: true,
            message: "Registration successful. Verification code sent to your email.",
            studentId: student._id,
            email: student.email
        });

    } catch (error) {
        console.error("REGISTRATION ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Server error during registration."
        });
    }
});


// ======================================================
// STUDENT LOGIN
// ======================================================

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const cleanEmail = String(email).trim().toLowerCase();

        const student = await Student.findOne({
            email: cleanEmail
        });

        if (!student) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

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

        // Student has not verified registration email
        if (!student.emailVerified) {
            return res.status(403).json({
                success: false,
                requiresVerification: true,
                message: "Please verify your email before logging in.",
                studentId: student._id,
                email: student.email
            });
        }

        res.status(200).json({
            success: true,
            message: "Login successful.",
            student: getStudentData(student)
        });

    } catch (error) {
        console.error("LOGIN ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Server error during login."
        });
    }
});


// ======================================================
// VERIFY REGISTRATION OTP
// ======================================================

router.post("/verify-otp", async (req, res) => {
    try {
        const { studentId, otp } = req.body;

        if (!studentId || !otp) {
            return res.status(400).json({
                success: false,
                message: "Student ID and OTP are required."
            });
        }

        if (!mongoose.Types.ObjectId.isValid(studentId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid student ID."
            });
        }

        if (!/^\d{6}$/.test(String(otp))) {
            return res.status(400).json({
                success: false,
                message: "OTP must be 6 digits."
            });
        }

        const student = await Student.findById(studentId);

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student account not found."
            });
        }

        if (!student.otpHash || !student.otpExpiresAt) {
            return res.status(400).json({
                success: false,
                message: "No active verification code. Please request a new one."
            });
        }

        if (new Date() > student.otpExpiresAt) {
            return res.status(400).json({
                success: false,
                message: "Verification code has expired."
            });
        }

        if ((student.otpAttempts || 0) >= 5) {
            return res.status(429).json({
                success: false,
                message: "Too many incorrect attempts. Please request a new code."
            });
        }

        const validOTP = await bcrypt.compare(
            String(otp),
            student.otpHash
        );

        if (!validOTP) {
            student.otpAttempts = (student.otpAttempts || 0) + 1;
            await student.save();

            return res.status(400).json({
                success: false,
                message: "Incorrect verification code."
            });
        }

        student.emailVerified = true;
        student.otpHash = null;
        student.otpExpiresAt = null;
        student.otpAttempts = 0;
        student.otpLastSentAt = null;

        await student.save();

        res.status(200).json({
            success: true,
            message: "Email verified successfully.",
            student: getStudentData(student)
        });

    } catch (error) {
        console.error("VERIFY OTP ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Server error while verifying OTP."
        });
    }
});


// ======================================================
// RESEND REGISTRATION OTP
// ======================================================

router.post("/resend-otp", async (req, res) => {
    try {
        const { studentId } = req.body;

        if (!studentId) {
            return res.status(400).json({
                success: false,
                message: "Student ID is required."
            });
        }

        if (!mongoose.Types.ObjectId.isValid(studentId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid student ID."
            });
        }

        const student = await Student.findById(studentId);

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student account not found."
            });
        }

        if (student.emailVerified) {
            return res.status(400).json({
                success: false,
                message: "Email is already verified."
            });
        }

        if (
            student.otpLastSentAt &&
            Date.now() - new Date(student.otpLastSentAt).getTime() < 60000
        ) {
            return res.status(429).json({
                success: false,
                message: "Please wait 60 seconds before requesting another code."
            });
        }

        const otp = generateOTP();

        student.otpHash = await bcrypt.hash(otp, 10);
        student.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
        student.otpAttempts = 0;
        student.otpLastSentAt = new Date();

        await student.save();

        try {
            await sendVerificationCode(student.email, otp);
        } catch (emailError) {
            console.error("RESEND OTP EMAIL ERROR:", emailError);

            return res.status(500).json({
                success: false,
                message: "Unable to send verification code."
            });
        }

        res.status(200).json({
            success: true,
            message: "A new verification code has been sent."
        });

    } catch (error) {
        console.error("RESEND OTP ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Server error while resending OTP."
        });
    }
});


// ======================================================
// CHECK STUDENT EMAIL
// ======================================================

router.post("/check-email", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required."
            });
        }

        const cleanEmail = String(email).trim().toLowerCase();

        const student = await Student.findOne({
            email: cleanEmail
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student email not found."
            });
        }

        res.status(200).json({
            success: true,
            message: "Student email exists.",
            emailVerified: student.emailVerified
        });

    } catch (error) {
        console.error("CHECK EMAIL ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Server error while checking email."
        });
    }
});


// ======================================================
// 1. FORGOT PASSWORD
// SEND RESET OTP
// ======================================================

router.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required."
            });
        }

        const cleanEmail = String(email).trim().toLowerCase();

        const student = await Student.findOne({
            email: cleanEmail
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "No student account was found with this email."
            });
        }

        // 60-second resend protection
        if (
            student.resetOtpLastSentAt &&
            Date.now() - new Date(student.resetOtpLastSentAt).getTime() < 60000
        ) {
            return res.status(429).json({
                success: false,
                message: "Please wait 60 seconds before requesting another code."
            });
        }

        const otp = generateOTP();

        student.resetOtpHash = await bcrypt.hash(otp, 10);
        student.resetOtpExpiresAt = new Date(
            Date.now() + 10 * 60 * 1000
        );
        student.resetOtpAttempts = 0;
        student.resetOtpLastSentAt = new Date();

        student.resetToken = null;
        student.resetTokenExpiresAt = null;

        await student.save();

        try {
            await sendVerificationCode(student.email, otp);
        } catch (emailError) {
            console.error("PASSWORD RESET EMAIL ERROR:", emailError);

            return res.status(500).json({
                success: false,
                message: "Unable to send reset code. Please try again."
            });
        }

        res.status(200).json({
            success: true,
            message: "A password reset code has been sent to your email."
        });

    } catch (error) {
        console.error("FORGOT PASSWORD ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Server error while requesting password reset."
        });
    }
});


// ======================================================
// 2. VERIFY PASSWORD RESET OTP
// ======================================================

router.post("/verify-reset-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: "Email and OTP are required."
            });
        }

        if (!/^\d{6}$/.test(String(otp))) {
            return res.status(400).json({
                success: false,
                message: "OTP must be 6 digits."
            });
        }

        const cleanEmail = String(email).trim().toLowerCase();

        const student = await Student.findOne({
            email: cleanEmail
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student account not found."
            });
        }

        if (!student.resetOtpHash || !student.resetOtpExpiresAt) {
            return res.status(400).json({
                success: false,
                message: "No active reset code. Please request a new code."
            });
        }

        if (new Date() > student.resetOtpExpiresAt) {
            return res.status(400).json({
                success: false,
                message: "Reset code has expired. Please request a new code."
            });
        }

        if ((student.resetOtpAttempts || 0) >= 5) {
            return res.status(429).json({
                success: false,
                message: "Too many incorrect attempts. Please request a new code."
            });
        }

        const validOTP = await bcrypt.compare(
            String(otp),
            student.resetOtpHash
        );

        if (!validOTP) {
            student.resetOtpAttempts =
                (student.resetOtpAttempts || 0) + 1;

            await student.save();

            return res.status(400).json({
                success: false,
                message: "Incorrect reset code."
            });
        }

        // OTP is correct
        student.resetOtpHash = null;
        student.resetOtpExpiresAt = null;
        student.resetOtpAttempts = 0;
        student.resetOtpLastSentAt = null;

        // Generate temporary reset token
        const resetToken = crypto.randomBytes(32).toString("hex");

        student.resetToken = resetToken;
        student.resetTokenExpiresAt = new Date(
            Date.now() + 15 * 60 * 1000
        );

        await student.save();

        res.status(200).json({
            success: true,
            message: "OTP verified successfully.",
            resetToken
        });

    } catch (error) {
        console.error("VERIFY RESET OTP ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Server error while verifying reset code."
        });
    }
});


// ======================================================
// 3. RESEND PASSWORD RESET OTP
// ======================================================

router.post("/resend-reset-otp", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required."
            });
        }

        const cleanEmail = String(email).trim().toLowerCase();

        const student = await Student.findOne({
            email: cleanEmail
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student account not found."
            });
        }

        if (
            student.resetOtpLastSentAt &&
            Date.now() - new Date(student.resetOtpLastSentAt).getTime() < 60000
        ) {
            return res.status(429).json({
                success: false,
                message: "Please wait 60 seconds before requesting another code."
            });
        }

        const otp = generateOTP();

        student.resetOtpHash = await bcrypt.hash(otp, 10);
        student.resetOtpExpiresAt = new Date(
            Date.now() + 10 * 60 * 1000
        );
        student.resetOtpAttempts = 0;
        student.resetOtpLastSentAt = new Date();

        student.resetToken = null;
        student.resetTokenExpiresAt = null;

        await student.save();

        try {
            await sendVerificationCode(student.email, otp);
        } catch (emailError) {
            console.error("RESEND RESET OTP EMAIL ERROR:", emailError);

            return res.status(500).json({
                success: false,
                message: "Unable to send reset code."
            });
        }

        res.status(200).json({
            success: true,
            message: "A new password reset code has been sent."
        });

    } catch (error) {
        console.error("RESEND RESET OTP ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Server error while resending reset code."
        });
    }
});


// ======================================================
// 4. RESET PASSWORD
// ======================================================

router.post("/reset-password", async (req, res) => {
    try {
        const {
            email,
            resetToken,
            newPassword
        } = req.body;

        if (!email || !resetToken || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Email, reset token and new password are required."
            });
        }

        if (String(newPassword).length < 8) {
            return res.status(400).json({
                success: false,
                message: "New password must be at least 8 characters."
            });
        }

        const cleanEmail = String(email).trim().toLowerCase();

        const student = await Student.findOne({
            email: cleanEmail
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student account not found."
            });
        }

        if (!student.resetToken || !student.resetTokenExpiresAt) {
            return res.status(400).json({
                success: false,
                message: "Password reset session is invalid. Please start again."
            });
        }

        if (new Date() > student.resetTokenExpiresAt) {
            student.resetToken = null;
            student.resetTokenExpiresAt = null;

            await student.save();

            return res.status(400).json({
                success: false,
                message: "Password reset session has expired. Please start again."
            });
        }

        if (student.resetToken !== String(resetToken)) {
            return res.status(400).json({
                success: false,
                message: "Invalid password reset token."
            });
        }

        const hashedPassword = await bcrypt.hash(
            String(newPassword),
            10
        );

        student.password = hashedPassword;

        // Clear reset session after successful password change
        student.resetToken = null;
        student.resetTokenExpiresAt = null;

        await student.save();

        res.status(200).json({
            success: true,
            message: "Password reset successfully. You can now log in."
        });

    } catch (error) {
        console.error("RESET PASSWORD ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Server error while resetting password."
        });
    }
});


// ======================================================
// UPDATE STUDENT PROFILE
// ======================================================

router.put("/:studentId", async (req, res) => {
    try {
        const { studentId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(studentId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid student ID."
            });
        }

        const allowedFields = [
            "firstName",
            "lastName",
            "phone",
            "department",
            "level",
            "gender"
        ];

        const updates = {};

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates[field] = String(req.body[field]).trim();
            }
        }

        const student = await Student.findByIdAndUpdate(
            studentId,
            { $set: updates },
            {
                new: true,
                runValidators: true
            }
        );

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found."
            });
        }

        res.status(200).json({
            success: true,
            message: "Student profile updated successfully.",
            student: getStudentData(student)
        });

    } catch (error) {
        console.error("UPDATE STUDENT ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Server error while updating student."
        });
    }
});


module.exports = router;
