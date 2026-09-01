
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

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

    if (!process.env.MONGO_URI) {

        console.error(
            "MONGO_URI is missing from the .env file."
        );

        process.exit(1);

    }

    try {

        await mongoose.connect(
            process.env.MONGO_URI,
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

