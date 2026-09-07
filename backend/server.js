const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

// =====================================================
// LOAD ENVIRONMENT VARIABLES
// =====================================================

dotenv.config({
    path: path.join(__dirname, ".env")
});

// =====================================================
// CREATE EXPRESS APP
// =====================================================

const app = express();

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(
    cors({
        origin: "*",
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"]
    })
);

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);

// =====================================================
// DATABASE CONNECTION
// =====================================================

let isConnected = false;

async function connectDatabase() {

    if (isConnected && mongoose.connection.readyState === 1) {
        return;
    }

    const mongoURI = process.env.MONGO_URI;

    if (!mongoURI) {
        throw new Error("MONGO_URI is missing.");
    }

    try {

        await mongoose.connect(mongoURI, {
            serverSelectionTimeoutMS: 15000,
            connectTimeoutMS: 15000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            minPoolSize: 1
        });

        isConnected = true;

        console.log("MongoDB connected successfully.");

    } catch (error) {

        isConnected = false;

        console.error(
            "MongoDB connection failed:",
            error.message
        );

        throw error;
    }
}

// =====================================================
// ROUTES
// =====================================================

const studentRoutes = require("./routes/studentRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");

// =====================================================
// STUDENT ROUTES
// =====================================================

app.use(
    "/api/students",
    studentRoutes
);

// =====================================================
// DOCTOR ROUTES
// =====================================================

app.use(
    "/api/doctors",
    doctorRoutes
);

// =====================================================
// APPOINTMENT ROUTES
// =====================================================

app.use(
    "/api/appointments",
    appointmentRoutes
);

// =====================================================
// ROOT ROUTE
// =====================================================

app.get("/", async (req, res) => {

    try {

        await connectDatabase();

        res.json({
            success: true,
            message: "Student Health Appointment Backend is running."
        });

    } catch (error) {

        console.error(
            "Root route error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Backend is running but MongoDB connection failed."
        });

    }

});

// =====================================================
// 404 HANDLER
// =====================================================

app.use((req, res) => {

    res.status(404).json({
        success: false,
        message: "Route not found."
    });

});

// =====================================================
// ERROR HANDLER
// =====================================================

app.use((error, req, res, next) => {

    console.error(
        "Server error:",
        error.message
    );

    res.status(500).json({
        success: false,
        message: "Internal server error."
    });

});

// =====================================================
// EXPORT APP
// =====================================================

module.exports = app;

// =====================================================
// LOCAL DEVELOPMENT
// =====================================================

if (require.main === module) {

    const PORT = process.env.PORT || 5001;

    connectDatabase()
        .then(() => {

            app.listen(PORT, () => {

                console.log(
                    `Server running on port ${PORT}`
                );

                console.log(
                    `http://localhost:${PORT}`
                );

            });

        })
        .catch((error) => {

            console.error(
                "Server startup failed:",
                error.message
            );

            process.exit(1);

        });

}