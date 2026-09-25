import bookingModel from "../model/booking.model.js";
import listingModel from "../model/listing.model.js";

// Helper: Calculate month difference or duration
const parseDuration = (startDateStr, endDateStr, reqDuration) => {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error("Invalid start or end date");
  }
  if (start >= end) {
    throw new Error("End date must be after start date");
  }

  let durationMonths = Number(reqDuration);
  if (!durationMonths || durationMonths < 1) {
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    durationMonths = Math.max(1, Math.round(diffDays / 30));
  }

  return { start, end, durationMonths };
};

// Helper: Check listing date bounds & overlapping bookings
const validateAvailability = async (listing, start, end, durationMonths) => {
  // Check listing availableFrom & availableUntil if not availableImmediately
  if (!listing.availableImmediately) {
    if (listing.availableFrom && start < new Date(listing.availableFrom)) {
      return { available: false, message: `Space is only available starting from ${new Date(listing.availableFrom).toISOString().split('T')[0]}` };
    }
    if (listing.availableUntil && end > new Date(listing.availableUntil)) {
      return { available: false, message: `Space is only available until ${new Date(listing.availableUntil).toISOString().split('T')[0]}` };
    }
  }

  // Check minDuration / maxDuration if specified (e.g. "1 Month" -> 1)
  if (listing.minDuration) {
    const minVal = parseInt(listing.minDuration);
    if (!isNaN(minVal) && durationMonths < minVal) {
      return { available: false, message: `Minimum booking duration for this space is ${minVal} month(s)` };
    }
  }
  if (listing.maxDuration) {
    const maxVal = parseInt(listing.maxDuration);
    if (!isNaN(maxVal) && durationMonths > maxVal) {
      return { available: false, message: `Maximum booking duration for this space is ${maxVal} month(s)` };
    }
  }

  // Check overlapping active / pending / confirmed bookings
  const overlap = await bookingModel.findOne({
    listing: listing._id,
    bookingStatus: { $in: ["pending", "confirmed", "active"] },
    $or: [
      { startDate: { $lt: end }, endDate: { $gt: start } }
    ]
  });

  if (overlap) {
    return { available: false, message: "Space is already booked for the selected dates" };
  }

  return { available: true };
};

export async function previewBooking(req, res) {
  try {
    const { listingId, startDate, endDate, durationMonths } = req.body;

    if (!listingId || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: "Listing ID, start date, and end date are required" });
    }

    const listing = await listingModel.findById(listingId);
    if (!listing) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }

    const { start, end, durationMonths: calculatedDuration } = parseDuration(startDate, endDate, durationMonths);
    const check = await validateAvailability(listing, start, end, calculatedDuration);

    if (!check.available) {
      return res.status(400).json({ success: false, message: check.message });
    }

    const monthlyPrice = listing.price || 0;
    const securityDeposit = listing.securityDeposit || 0;
    const rentTotal = monthlyPrice * calculatedDuration;
    const platformFee = Math.round(rentTotal * 0.05);
    const totalAmount = rentTotal + securityDeposit + platformFee;

    return res.status(200).json({
      success: true,
      available: true,
      preview: {
        listingId: listing._id,
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
        durationMonths: calculatedDuration,
        monthlyPrice,
        securityDeposit,
        platformFee,
        totalAmount,
      },
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function createBooking(req, res) {
  try {
    const { listingId, startDate, endDate, durationMonths } = req.body;
    const userId = req.user.id;

    if (!listingId || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: "Listing ID, start date, and end date are required" });
    }

    const listing = await listingModel.findById(listingId);
    if (!listing) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }

    const { start, end, durationMonths: calculatedDuration } = parseDuration(startDate, endDate, durationMonths);
    const check = await validateAvailability(listing, start, end, calculatedDuration);

    if (!check.available) {
      return res.status(400).json({ success: false, message: check.message });
    }

    const monthlyPrice = listing.price || 0;
    const securityDeposit = listing.securityDeposit || 0;
    const rentTotal = monthlyPrice * calculatedDuration;
    const platformFee = Math.round(rentTotal * 0.05);
    const totalAmount = rentTotal + securityDeposit + platformFee;

    const booking = await bookingModel.create({
      renter: userId,
      listing: listing._id,
      host: listing.owner,
      startDate: start,
      endDate: end,
      monthlyPrice,
      securityDeposit,
      platformFee,
      totalAmount,
      bookingStatus: "pending",
      paymentStatus: "pending",
    });

    return res.status(201).json({
      success: true,
      message: "Booking created successfully",
      booking
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function getMyBookings(req, res) {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    const query = { renter: userId };
    if (status) {
      const lower = status.toLowerCase();
      if (lower === "upcoming") {
        query.bookingStatus = { $in: ["pending", "confirmed"] };
      } else if (lower === "active") {
        query.bookingStatus = "active";
      } else if (lower === "completed") {
        query.bookingStatus = "completed";
      } else if (lower === "cancelled") {
        query.bookingStatus = "cancelled";
      } else {
        query.bookingStatus = status;
      }
    }

    const bookings = await bookingModel
      .find(query)
      .populate("listing")
      .populate("host", "username email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      bookings,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getBookingById(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const booking = await bookingModel
      .findById(id)
      .populate("listing")
      .populate("host", "username email");

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    const renterId = booking.renter._id ? booking.renter._id.toString() : booking.renter.toString();
    const hostId = booking.host._id ? booking.host._id.toString() : booking.host.toString();

    if (renterId !== userId && hostId !== userId) {
      return res.status(403).json({ success: false, message: "Unauthorized to view this booking" });
    }

    return res.status(200).json({
      success: true,
      booking,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function cancelBooking(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const booking = await bookingModel.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    const renterId = booking.renter._id ? booking.renter._id.toString() : booking.renter.toString();
    const hostId = booking.host._id ? booking.host._id.toString() : booking.host.toString();

    if (renterId !== userId && hostId !== userId) {
      return res.status(403).json({ success: false, message: "Unauthorized to cancel this booking" });
    }

    if (booking.bookingStatus === "cancelled") {
      return res.status(400).json({ success: false, message: "Booking is already cancelled" });
    }

    if (booking.bookingStatus === "completed") {
      return res.status(400).json({ success: false, message: "Completed bookings cannot be cancelled" });
    }

    booking.bookingStatus = "cancelled";
    await booking.save();

    const populated = await bookingModel
      .findById(booking._id)
      .populate("listing")
      .populate("host", "username email");

    return res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      booking: populated,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
