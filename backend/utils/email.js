const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,

    auth: {
        user: process.env.BREVO_SMTP_LOGIN,
        pass: process.env.BREVO_SMTP_KEY
    }
});

async function sendVerificationCode(email, code) {

    try {

        const mailOptions = {
            from: `"Student Health Appointment System" <${process.env.BREVO_SENDER_EMAIL}>`,
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

                        <p>Hello,</p>

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
                            This code will expire in
                            <strong>10 minutes</strong>.
                        </p>

                        <p>
                            If you did not request this code,
                            you can safely ignore this email.
                        </p>

                        <hr style="
                            border: none;
                            border-top: 1px solid #e5e5e5;
                            margin: 25px 0;
                        ">

                        <p style="
                            font-size: 13px;
                            color: #68756f;
                        ">
                            Student Health Appointment System
                        </p>

                    </div>

                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);

        console.log(
            "OTP email sent successfully:",
            info.messageId
        );

        return info;

    } catch (error) {

        console.error("SMTP EMAIL ERROR:", error);

        throw error;
    }
}

module.exports = {
    sendVerificationCode
};