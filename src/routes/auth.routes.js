import { Router } from "express";
import * as authController from '../controllers/auth.controller.js';


const authRouter = Router();

// Authentication routes
authRouter.post("/register", authController.register);
authRouter.get("/getMe", authController.getMe);
authRouter.post("/login", authController.login)
authRouter.get("/logout", authController.Logout)
authRouter.post("/verifyOtp", authController.verifyOtp)
authRouter.post("/forgotOtp", authController.forgotOtp)
authRouter.post("/forgotOtpVerify", authController.forgotOtpVerify)
authRouter.post("/newPassword", authController.newPassword)



export default authRouter