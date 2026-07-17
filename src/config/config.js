import dotenv from "dotenv";


dotenv.config();

if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not define in environment variables !")
}
if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not define in environment variables !")
}
if (!process.env.EMAIL_USER) {
    throw new Error("EMAIL_USER is not define in environment variables !")
}
if (!process.env.EMAIL_PASS) {
    throw new Error("EMAIL_PASS is not define in environment variables !")
}
if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new Error("CLOUDINARY_CLOUD_NAME is not define in environment variables !")
}
if (!process.env.CLOUDINARY_API_KEY) {
    throw new Error("CLOUDINARY_API_KEY is not define in environment variables !")
}
if (!process.env.CLOUDINARY_API_SECRET) {
    throw new Error("CLOUDINARY_API_SECRET is not define in environment variables !")
}

const config = {
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    MONGO_URI: process.env.MONGO_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_PASS: process.env.EMAIL_PASS
}

export default config;