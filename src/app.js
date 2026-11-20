import express from 'express';
import morgan from 'morgan';
import authRouter from './routes/auth.routes.js'
import listingRouter from './routes/listing.routes.js';
import bookingRouter from './routes/booking.routes.js';
import cors from 'cors'
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,                 // maximum 100 requests
    message: {
        success: false,
        message: "Too many requests. Please try again later."
    },
    standardHeaders: true,
    legacyHeaders: false,
});
const app = express();


app.use(cookieParser())
const allowedOrigins = [
    "http://localhost:5173",
    "https://spare-space-personal.vercel.app",
];

app.use(
    cors({
        origin: allowedOrigins,
        credentials: true,
    })
);
app.use(express.json());
app.use(morgan("dev"));
app.use("/api", limiter);
app.use("/api", authRouter);
app.use("/api", listingRouter);
app.use("/api", bookingRouter);



export default app



