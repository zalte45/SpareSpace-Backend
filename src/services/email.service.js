// import { Resend } from "resend";
import config from "../config/config.js";
import nodemailer from "nodemailer"


const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: config.EMAIL_USER,
        pass: config.EMAIL_PASS
    }
})


transporter.verify((error, success) => {
    if (error) {
        console.log('error connecting to email service', error)
    }
    else {
        console.log('email server is ready to send message');
    }

}
)


export const sendEmail = async (to, subject, text, html) => {
    try {
        const info = await transporter.sendMail({
            from: `"Your Name" <${config.EMAIL_USER}>`, // sender address
            to, // list of receivers
            subject, // Subject line
            text, // plain text body
            html, // html body
        });
        if (!info) {
            console.log("email not sent !!");
        }

        console.log('Message sent: %s', info.messageId);
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    } catch (error) {
        console.error('Error sending email:', error);
    }
};

export default sendEmail;