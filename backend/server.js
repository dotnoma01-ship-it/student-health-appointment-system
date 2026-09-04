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

const PORT = process.env.PORT || 5001;


// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors());

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);


// =====================================================
// ROUTES
// =====================================================

const studentRoutes = require("./routes/studentRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");

app.use(
    "/api/students",
    studentRoutes
);

app.use(
    "/api/appointments",
    appointmentRoutes
);


// =====================================================
// ROOT ROUTE
// =====================================================

app.get("/", (req, res) => {

    res.json({
        success: true,
        message: "Student Health Appointment Backend is running."
    });

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
// MONGOOSE EVENTS
// =====================================================

mongoose.connection.on(
    "connected",
    () => {

        console.log(
            "MongoDB connected successfully."
        );

    }
);

mongoose.connection.on(
    "disconnected",
    () => {

        console.log(
            "MongoDB disconnected."
        );

    }
);

mongoose.connection.on(
    "reconnected",
    () => {

        console.log(
            "MongoDB reconnected."
        );

    }
);

mongoose.connection.on(
    "error",
    (error) => {

        console.error(
            "MongoDB error:",
            error.message
        );

    }
);


// =====================================================
// CONNECT TO MONGODB
// =====================================================

async function connectDatabase() {

    const mongoURI = process.env.MONGO_URI;

    // Check if MongoDB URI exists
    if (!mongoURI) {

        console.error(
            "MONGO_URI is missing from the .env file."
        );

        console.error(
            "Make sure your .env file is inside the backend folder."
        );

        process.exit(1);

    }

    try {

        await mongoose.connect(
            mongoURI,
            {

                serverSelectionTimeoutMS: 15000,

                connectTimeoutMS: 15000,

                socketTimeoutMS: 45000,

                maxPoolSize: 10,

                minPoolSize: 1

            }
        );

    }

    catch (error) {

        console.error(
            "MongoDB connection failed:",
            error.message
        );

        process.exit(1);

    }

}


// =====================================================
// START SERVER
// =====================================================

async function startServer() {

    try {

        await connectDatabase();

        app.listen(
            PORT,
            () => {

                console.log(
                    `Server running on port ${PORT}`
                );

                console.log(
                    `http://localhost:${PORT}`
                );

            }
        );

    }

    catch (error) {

        console.error(
            "Server startup failed:",
            error.message
        );

        process.exit(1);

    }

}


// =====================================================
// START APPLICATION
// =====================================================

startServer();