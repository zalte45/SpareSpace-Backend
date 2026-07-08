import dotenv  from "dotenv";


dotenv.config();

if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not define in environment variables !")
}
if (!process.env.JWT_SECRET) {
    throw new Error("MONGO_URI is not define in environment variables !")
}
if (!process.env.EMAIL_USER) {
    throw new Error("MONGO_URI is not define in environment variables !")
}
if (!process.env.EMAIL_PASS) {
    throw new Error("MONGO_URI is not define in environment variables !")
}

const config={
    MONGO_URI:process.env.MONGO_URI,
    JWT_SECRET:process.env.JWT_SECRET,
    // RESEND_API_KEY:process.env.RESEND_API_KEY,
    EMAIL_USER:process.env.EMAIL_USER,
    EMAIL_PASS:process.env.EMAIL_PASS
}

export default config;