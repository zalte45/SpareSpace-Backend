import { Router } from "express";
import * as bookingController from "../controllers/booking.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const bookingRouter = Router();

bookingRouter.post("/booking/preview", protect, bookingController.previewBooking);
bookingRouter.post("/createBooking", protect, bookingController.createBooking);
bookingRouter.get("/booking", protect, bookingController.getMyBookings);
bookingRouter.get("/booking/:id", protect, bookingController.getBookingById);
bookingRouter.patch("/booking/:id/cancel", protect, bookingController.cancelBooking);

export default bookingRouter;
