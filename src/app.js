import express from 'express';
import morgan from 'morgan';
import authRouter from './routes/auth.routes.js'
import cors from 'cors'
import cookieParser from 'cookie-parser';


const app = express();


app.use(cookieParser())
app.use(
    cors({
        origin: "http://localhost:5173",
        credentials: true,
    })
);
app.use(express.json());
app.use(morgan("dev"));
app.use("/api", authRouter)


export default app



