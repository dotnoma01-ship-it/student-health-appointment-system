const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

async function sendVerificationCode(email, code) {
    try {
        const response = await fetch(BREVO_API_URL, {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "api-key": process.env.BREVO_API_KEY
            },

            body: JSON.stringify({
                sender: {
                    name: "Student Health Appointment System",
                    email: process.env.BREVO_SENDER_EMAIL
                },

                to: [
                    {
                        email: email
                    }
                ],

                subject: "Your Student Health Verification Code",

                htmlContent: `
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
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("BREVO API ERROR:", data);

            throw new Error(
                data.message || "Brevo failed to send email"
            );
        }

        console.log("OTP email sent successfully:", data);

        return data;

    } catch (error) {
        console.error("OTP EMAIL ERROR:", error);
        throw error;
    }
}

module.exports = {
    sendVerificationCode
};