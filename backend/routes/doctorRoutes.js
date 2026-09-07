const express = require("express");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const Doctor = require("../model/doctor");
const { sendVerificationCode } = require("../utils/email");

const router = express.Router();


// ==========================================
// GENERATE 6-DIGIT OTP
// ==========================================
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}


// ==========================================
// RETURN SAFE DOCTOR DATA
// ==========================================
function getDoctorData(doctor) {
    return {
        id: doctor._id,
        _id: doctor._id,

        firstName: doctor.firstName,
        lastName: doctor.lastName,
        email: doctor.email,
        phone: doctor.phone,

        specialization: doctor.specialization,
        licenseNumber: doctor.licenseNumber,
        gender: doctor.gender,

        isVerified: doctor.isVerified,
        twoFactorEnabled: doctor.twoFactorEnabled
    };
}


// ==========================================
// GET ALL DOCTORS
// ==========================================
router.get("/", async (req, res) => {
    try {
        const doctors = await Doctor.find().select("-password -otp -otpExpires");

        res.json({
            success: true,
            doctors
        });

    } catch (error) {
        console.error("Get doctors error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to get doctors"
        });
    }
});


// ==========================================
// GET ONE DOCTOR
// ==========================================
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid doctor ID"
            });
        }

        const doctor = await Doctor.findById(id);

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: "Doctor not found"
            });
        }

        res.json({
            success: true,
            doctor: getDoctorData(doctor)
        });

    } catch (error) {
        console.error("Get doctor error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to get doctor"
        });
    }
});


// ==========================================
// DOCTOR REGISTRATION
// ==========================================
router.post("/register", async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            password,
            phone,
            specialization,
            licenseNumber,
            gender
        } = req.body;

        // Check required fields
        if (
            !firstName ||
            !lastName ||
            !email ||
            !password ||
            !phone ||
            !specialization ||
            !licenseNumber ||
            !gender
        ) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        const cleanEmail = email.trim().toLowerCase();
        const cleanLicenseNumber = licenseNumber.trim();

        // Check existing email
        const existingEmail = await Doctor.findOne({
            email: cleanEmail
        });

        if (existingEmail) {
            return res.status(400).json({
                success: false,
                message: "A doctor with this email already exists"
            });
        }

        // Check existing license number
        const existingLicense = await Doctor.findOne({
            licenseNumber: cleanLicenseNumber
        });

        if (existingLicense) {
            return res.status(400).json({
                success: false,
                message: "This license number is already registered"
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate OTP
        const otp = generateOTP();

        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        // Create doctor
        const doctor = new Doctor({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: cleanEmail,
            password: hashedPassword,
            phone: phone.trim(),
            specialization: specialization.trim(),
            licenseNumber: cleanLicenseNumber,
            gender: gender.trim(),

            otp,
            otpExpires,

            isVerified: false,
            twoFactorEnabled: true
        });

        await doctor.save();

        // Send OTP email
        try {
            await sendVerificationCode(cleanEmail, otp);
        } catch (emailError) {
            console.error("Doctor OTP email error:", emailError);

            // Remove account if email could not be sent
            await Doctor.findByIdAndDelete(doctor._id);

            return res.status(500).json({
                success: false,
                message: "Unable to send verification code"
            });
        }

        res.status(201).json({
            success: true,
            message: "Doctor registered successfully. Verification code sent to your email.",
            doctorId: doctor._id
        });

    } catch (error) {
        console.error("Doctor registration error:", error);

        res.status(500).json({
            success: false,
            message: "Doctor registration failed"
        });
    }
});


// ==========================================
// DOCTOR LOGIN
// ==========================================
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        const doctor = await Doctor.findOne({
            email: cleanEmail
        });

        if (!doctor) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // Check password
        const passwordMatch = await bcrypt.compare(
            password,
            doctor.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // If account is not verified
        if (!doctor.isVerified) {
            const otp = generateOTP();

            doctor.otp = otp;
            doctor.otpExpires = new Date(
                Date.now() + 10 * 60 * 1000
            );

            await doctor.save();

            try {
                await sendVerificationCode(cleanEmail, otp);
            } catch (emailError) {
                console.error("Doctor login OTP error:", emailError);

                return res.status(500).json({
                    success: false,
                    message: "Unable to send verification code"
                });
            }

            return res.status(403).json({
                success: false,
                requiresVerification: true,
                message: "Please verify your email with the OTP sent to you.",
                doctorId: doctor._id
            });
        }

        // Login successful
        res.json({
            success: true,
            message: "Doctor login successful",
            doctor: getDoctorData(doctor)
        });

    } catch (error) {
        console.error("Doctor login error:", error);

        res.status(500).json({
            success: false,
            message: "Doctor login failed"
        });
    }
});


// ==========================================
// VERIFY DOCTOR OTP
// ==========================================
router.post("/verify-otp", async (req, res) => {
    try {
        const { doctorId, otp } = req.body;

        if (!doctorId || !otp) {
            return res.status(400).json({
                success: false,
                message: "Doctor ID and OTP are required"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(doctorId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid doctor ID"
            });
        }

        const doctor = await Doctor.findById(doctorId);

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: "Doctor not found"
            });
        }

        if (!doctor.otp || doctor.otp !== otp.toString().trim()) {
            return res.status(400).json({
                success: false,
                message: "Invalid verification code"
            });
        }

        // Check expiration
        if (!doctor.otpExpires || doctor.otpExpires < new Date()) {
            return res.status(400).json({
                success: false,
                message: "Verification code has expired"
            });
        }

        // Verify account
        doctor.isVerified = true;
        doctor.otp = null;
        doctor.otpExpires = null;

        await doctor.save();

        res.json({
            success: true,
            message: "Doctor account verified successfully",
            doctor: getDoctorData(doctor)
        });

    } catch (error) {
        console.error("Doctor OTP verification error:", error);

        res.status(500).json({
            success: false,
            message: "OTP verification failed"
        });
    }
});


// ==========================================
// RESEND DOCTOR OTP
// ==========================================
router.post("/resend-otp", async (req, res) => {
    try {
        const { doctorId } = req.body;

        if (!doctorId) {
            return res.status(400).json({
                success: false,
                message: "Doctor ID is required"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(doctorId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid doctor ID"
            });
        }

        const doctor = await Doctor.findById(doctorId);

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: "Doctor not found"
            });
        }

        const otp = generateOTP();

        doctor.otp = otp;
        doctor.otpExpires = new Date(
            Date.now() + 10 * 60 * 1000
        );

        await doctor.save();

        try {
            await sendVerificationCode(doctor.email, otp);
        } catch (emailError) {
            console.error("Resend doctor OTP error:", emailError);

            return res.status(500).json({
                success: false,
                message: "Unable to send verification code"
            });
        }

        res.json({
            success: true,
            message: "A new verification code has been sent"
        });

    } catch (error) {
        console.error("Resend OTP error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to resend OTP"
        });
    }
});


// ==========================================
// CHECK DOCTOR EMAIL
// ==========================================
router.post("/check-email", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const doctor = await Doctor.findOne({
            email: email.trim().toLowerCase()
        });

        res.json({
            success: true,
            exists: !!doctor
        });

    } catch (error) {
        console.error("Check doctor email error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to check email"
        });
    }
});


// ==========================================
// UPDATE DOCTOR PROFILE
// ==========================================
router.put("/:doctorId", async (req, res) => {
    try {
        const { doctorId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(doctorId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid doctor ID"
            });
        }

        const doctor = await Doctor.findById(doctorId);

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: "Doctor not found"
            });
        }

        const {
            firstName,
            lastName,
            email,
            phone,
            specialization,
            licenseNumber,
            gender
        } = req.body;

        if (
            !firstName ||
            !lastName ||
            !email ||
            !phone ||
            !specialization ||
            !licenseNumber ||
            !gender
        ) {
            return res.status(400).json({
                success: false,
                message: "All profile fields are required"
            });
        }

        const cleanEmail = email.trim().toLowerCase();
        const cleanLicenseNumber = licenseNumber.trim();

        // Check if another doctor uses the email
        const emailExists = await Doctor.findOne({
            email: cleanEmail,
            _id: { $ne: doctorId }
        });

        if (emailExists) {
            return res.status(400).json({
                success: false,
                message: "This email is already being used"
            });
        }

        // Check if another doctor uses the license number
        const licenseExists = await Doctor.findOne({
            licenseNumber: cleanLicenseNumber,
            _id: { $ne: doctorId }
        });

        if (licenseExists) {
            return res.status(400).json({
                success: false,
                message: "This license number is already being used"
            });
        }

        doctor.firstName = firstName.trim();
        doctor.lastName = lastName.trim();
        doctor.email = cleanEmail;
        doctor.phone = phone.trim();
        doctor.specialization = specialization.trim();
        doctor.licenseNumber = cleanLicenseNumber;
        doctor.gender = gender.trim();

        await doctor.save();

        res.json({
            success: true,
            message: "Doctor profile updated successfully",
            doctor: getDoctorData(doctor)
        });

    } catch (error) {
        console.error("Update doctor error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update doctor profile"
        });
    }
});


module.exports = router;