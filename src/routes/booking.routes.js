import { Router } from "express";
import * as bookingController from "../controllers/booking.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const bookingRouter = Router();

// Preview — public (no auth) so users can see pricing before signing in
bookingRouter.post("/booking/preview", bookingController.previewBooking);

// Create booking (RESTful: POST /booking)
bookingRouter.post("/booking", protect, bookingController.createBooking);

// List endpoints
bookingRouter.get("/booking", protect, bookingController.getMyBookings);
bookingRouter.get("/booking/host", protect, bookingController.getHostBookings);

// Host-specific detail — MUST come before the generic /:id route
bookingRouter.get("/booking/host/:bookingId", protect, bookingController.getHostBookingById);

// Generic detail — catches all remaining /booking/:id
bookingRouter.get("/booking/:id", protect, bookingController.getBookingById);

// Actions
bookingRouter.patch("/booking/:id/cancel", protect, bookingController.cancelBooking);
bookingRouter.patch("/booking/:id/complete", protect, bookingController.completeBooking);


export default bookingRouter;
