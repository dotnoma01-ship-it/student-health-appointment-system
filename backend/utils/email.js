const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    }
});

async function sendVerificationCode(email, code) {

    await transporter.sendMail({

        from: `"Student Health Appointment System" <${process.env.GMAIL_USER}>`,

        to: email,

        subject: "Your Student Health Verification Code",

        html: `
            <div style="
                font-family: Arial, sans-serif;
                max-width: 600px;
                margin: auto;
                padding: 30px;
                background: #f5f7f6;
            ">

                <div style="
                    background: white;
                    padding: 30px;
                    border-radius: 12px;
                ">

                    <h2 style="color: #198754;">
                        Student Health Appointment System
                    </h2>

                    <p>
                        Your verification code is:
                    </p>

                    <div style="
                        font-size: 32px;
                        font-weight: bold;
                        letter-spacing: 8px;
                        margin: 25px 0;
                        color: #198754;
                    ">
                        ${code}
                    </div>

                    <p>
                        This code will expire in 10 minutes.
                    </p>

                    <p>
                        If you did not request this code,
                        you can safely ignore this email.
                    </p>

                </div>

            </div>
        `

    });

}

module.exports = {
    sendVerificationCode
};