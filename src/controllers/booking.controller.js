import bookingModel from "../model/booking.model.js";
import listingModel from "../model/listing.model.js";
import mongoose from "mongoose";
import { prisma } from "../config/postgres.js";


const parseDuration = (startDateStr, endDateStr, reqDuration) => {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  // Validate dates
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error("Invalid start or end date");
  }

  // End date must be after start date
  if (start >= end) {
    throw new Error("End date must be after start date");
  }

  // Calculate calendar month difference
  let durationMonths =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());

  // Validate complete months
  if (end.getDate() !== start.getDate()) {
    throw new Error("Rental duration must be in complete months");
  }

  // Validate minimum duration
  if (durationMonths < 1) {
    throw new Error("Rental duration must be at least one month");
  }

  // Validate requested duration if provided
  if (
    reqDuration !== undefined &&
    reqDuration !== null &&
    Number(reqDuration) !== durationMonths
  ) {
    throw new Error("Duration months does not match the dates");
  }

  return {
    start,
    end,
    durationMonths,
  };
};
const validateAvailability = async (listing, start, end, durationMonths) => {
  // 1. Check listing status
  if (listing.status !== "active") {
    return {
      available: false,
      message: "This listing is not currently active",
    };
  }

  // 2. Check if listing is already occupied
  if (listing.isOccupied) {
    return {
      available: false,
      message: "This space is currently occupied",
    };
  }

  // 3. Check availableFrom and availableUntil
  if (!listing.availableImmediately) {
    if (listing.availableFrom) {
      const availableFrom = new Date(listing.availableFrom);

      if (start < availableFrom) {
        return {
          available: false,
          message: `Space is only available starting from ${availableFrom.toISOString().split("T")[0]}`,
        };
      }
    }

    if (listing.availableUntil) {
      const availableUntil = new Date(listing.availableUntil);

      if (end > availableUntil) {
        return {
          available: false,
          message: `Space is only available until ${availableUntil.toISOString().split("T")[0]}`,
        };
      }
    }
  }

  // 4. Validate minimum duration
  if (listing.minDuration) {
    const minVal = parseInt(listing.minDuration, 10);

    if (!Number.isNaN(minVal) && durationMonths < minVal) {
      return {
        available: false,
        message: `Minimum booking duration for this space is ${minVal} month(s)`,
      };
    }
  }

  // 5. Validate maximum duration
  if (listing.maxDuration) {
    const maxVal = parseInt(listing.maxDuration, 10);

    if (!Number.isNaN(maxVal) && durationMonths > maxVal) {
      return {
        available: false,
        message: `Maximum booking duration for this space is ${maxVal} month(s)`,
      };
    }
  }

  // 6. Check overlapping bookings
  const overlap = await prisma.booking.findFirst({
    where: {
      listingId: listing._id.toString(),
      bookingStatus: {
        in: ["pending", "confirmed", "active"],
      },
      startDate: {
        lt: end,
      },
      endDate: {
        gt: start,
      },
    },
  });

  if (overlap) {
    return {
      available: false,
      message: "Space is already booked for the selected dates",
    };
  }

  // 7. Listing is available
  return {
    available: true,
    message: "Space is available for the selected dates",
  };
};

export async function previewBooking(req, res) {
  try {
    const { listingId, startDate, endDate, durationMonths } = req.body;

    // 1. Validate required fields
    if (!listingId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Listing ID, start date, and end date are required",
      });
    }

    // 2. Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid listing ID",
      });
    }

    // 3. Find listing
    const listing = await listingModel.findById(listingId);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found",
      });
    }

    // 4. Validate dates and duration
    let parsedDuration;

    try {
      parsedDuration = parseDuration(
        startDate,
        endDate,
        durationMonths
      );
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    const { start, end, durationMonths: calculatedDuration } =
      parsedDuration;

    // 5. Check listing availability
    const check = await validateAvailability(
      listing,
      start,
      end,
      calculatedDuration
    );

    if (!check.available) {
      return res.status(400).json({
        success: false,
        message: `Message from available check: ${check.message}`,
      });
    }

    // 6. Validate listing pricing
    const monthlyPrice = Number(listing.price);
    const securityDeposit = Number(listing.securityDeposit);

    if (
      !Number.isFinite(monthlyPrice) ||
      !Number.isFinite(securityDeposit) ||
      monthlyPrice < 0 ||
      securityDeposit < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid listing pricing information",
      });
    }

    // 7. Calculate booking amount
    const rentTotal = monthlyPrice * calculatedDuration;
    const platformFee = rentTotal * 0.05;
    const totalAmount = rentTotal + securityDeposit + platformFee;

    // 8. Return booking preview
    return res.status(200).json({
      success: true,
      available: true,
      preview: {
        listingId: listing._id,
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
        durationMonths: calculatedDuration,
        monthlyPrice,
        rentTotal,
        securityDeposit,
        platformFee,
        totalAmount,
      },
    });
  } catch (error) {
    console.error("Preview booking error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

export async function createBooking(req, res) {
  try {
    // 1. Validate required fields
    if (!req.body.listingId || !req.body.startDate || !req.body.endDate) {
      return res.status(400).json({
        success: false,
        message: "Listing ID, start date, and end date are required",
      });
    }

    // 2. Validate MongoDB listing ID
    if (!mongoose.Types.ObjectId.isValid(req.body.listingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid listing ID",
      });
    }

    // 3. Fetch listing from MongoDB
    const listing = await listingModel.findById(req.body.listingId);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found",
      });
    }

    // 4. Prevent self-booking
    if (listing.owner.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot book your own listing",
      });
    }

    // 5. Validate dates and duration
    let parsedDates;

    try {
      parsedDates = parseDuration(
        req.body.startDate,
        req.body.endDate,
        req.body.durationMonths
      );
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    const { start, end, durationMonths } = parsedDates;

    // 6. Validate listing availability
    // This should validate listing status, available dates,
    // and duration constraints. SQL overlap checking happens below.
    const availabilityCheck = await validateAvailability(
      listing,
      start,
      end,
      durationMonths
    );

    if (!availabilityCheck.available) {
      return res.status(409).json({
        success: false,
        message: availabilityCheck.message,
      });
    }

    // 7. Calculate pricing
    const monthlyPrice = Number(listing.price);
    const securityDeposit = Number(listing.securityDeposit);

    if (
      !Number.isFinite(monthlyPrice) ||
      !Number.isFinite(securityDeposit) ||
      monthlyPrice < 0 ||
      securityDeposit < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid listing pricing information",
      });
    }

    const rentTotal = monthlyPrice * durationMonths;
    const platformFee = rentTotal * 0.05;
    const totalAmount = rentTotal + securityDeposit + platformFee;

    const listingId = listing._id.toString();

    // 8. PostgreSQL transaction with concurrency protection
    const booking = await prisma.$transaction(async (tx) => {
      // Acquire transaction-level advisory lock for this listing.
      // Concurrent requests for the same listing must wait.
      await tx.$queryRaw`
  WITH advisory_lock AS (
    SELECT pg_advisory_xact_lock(
      hashtextextended(${listingId}, 0)
    )
  )
  SELECT 1::int AS locked
  FROM advisory_lock;
`;

      // Recheck overlapping bookings inside the locked transaction
      const overlap = await tx.Booking.findFirst({
        where: {
          listingId,
          bookingStatus: {
            in: ["pending", "confirmed", "active"],
          },
          startDate: {
            lt: end,
          },
          endDate: {
            gt: start,
          },
        },
      });

      // Return null if another booking already occupies these dates
      if (overlap) {
        return null;
      }

      // Insert the booking into PostgreSQL
      const createdBooking = await tx.booking.create({
        data: {
          renterId: req.user.id,
          listingId,
          hostId: listing.owner.toString(),

          startDate: start,
          endDate: end,

          durationMonths,

          monthlyPrice,
          securityDeposit,
          platformFee,
          totalAmount,

          bookingStatus: "confirmed",
          paymentStatus: "pending",
        },
      });

      // Return the created PostgreSQL record
      return createdBooking;
    });

    // 9. Handle overlapping booking
    if (!booking) {
      return res.status(409).json({
        success: false,
        message: "This listing is already booked for the selected dates",
      });
    }

    // 10. Return created booking
    return res.status(201).json({
      success: true,
      message: "Booking created successfully",
      booking,
    });
  } catch (error) {
    console.error("Create booking error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}


export async function getMyBookings(req, res) {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    const query = { renter: userId };

    // Filter bookings by status
    if (status) {
      const lowerStatus = status.toLowerCase().trim();

      switch (lowerStatus) {
        case "upcoming":
          query.bookingStatus = "confirmed";
          break;

        case "active":
          query.bookingStatus = "active";
          break;

        case "completed":
          query.bookingStatus = "completed";
          break;

        case "cancelled":
          query.bookingStatus = "cancelled";
          break;

        case "expired":
          query.bookingStatus = "expired";
          break;

        default:
          return res.status(400).json({
            success: false,
            message: "Invalid booking status",
          });
      }
    }

    // Fetch renter bookings
    const bookings = await bookingModel
      .find(query)
      .populate("listing")
      .populate("host", "username email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Get my bookings error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

export async function getBookingById(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 1. Validate booking ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
    }

    // 2. Find booking and populate details
    const booking = await bookingModel
      .findById(id)
      .populate("listing")
      .populate("renter", "username email")
      .populate("host", "username email");

    // 3. Check booking existence
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // 4. Extract renter and host IDs safely
    const renterId = booking.renter?._id?.toString();
    const hostId = booking.host?._id?.toString();

    // 5. Authorization check
    if (renterId !== userId && hostId !== userId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to view this booking",
      });
    }

    // 6. Return booking
    return res.status(200).json({
      success: true,
      booking,
    });
  } catch (error) {
    console.error("Get booking by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}
export async function cancelBooking(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id.toString();

    // 1. Validate booking ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
    }

    // 2. Find booking
    const booking = await bookingModel.findById(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // 3. Extract renter and host IDs
    const renterId = booking.renter?.toString();
    const hostId = booking.host?.toString();

    // 4. Authorization check
    if (renterId !== userId && hostId !== userId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to cancel this booking",
      });
    }

    // 5. Validate booking status
    if (booking.bookingStatus === "cancelled") {
      return res.status(409).json({
        success: false,
        message: "Booking is already cancelled",
      });
    }

    if (booking.bookingStatus === "completed") {
      return res.status(409).json({
        success: false,
        message: "Completed bookings cannot be cancelled",
      });
    }

    if (booking.bookingStatus === "expired") {
      return res.status(409).json({
        success: false,
        message: "Expired bookings cannot be cancelled",
      });
    }

    // 6. Cancel booking
    booking.bookingStatus = "cancelled";

    await booking.save();

    // 7. Populate booking details
    const populatedBooking = await bookingModel
      .findById(booking._id)
      .populate("listing")
      .populate("renter", "username email")
      .populate("host", "username email");

    // 8. Return response
    return res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      booking: populatedBooking,
    });
  } catch (error) {
    console.error("Cancel booking error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

export async function getHostBookings(req, res) {
  try {
    const hostId = req.user.id;
    const { status } = req.query;

    const query = { host: hostId };

    if (status) {
      const lowerStatus = status.toLowerCase().trim();

      switch (lowerStatus) {
        case "upcoming":
          query.bookingStatus = "confirmed";
          break;

        case "active":
          query.bookingStatus = "active";
          break;

        case "completed":
          query.bookingStatus = "completed";
          break;

        case "cancelled":
          query.bookingStatus = "cancelled";
          break;

        case "expired":
          query.bookingStatus = "expired";
          break;

        default:
          return res.status(400).json({
            success: false,
            message: "Invalid booking status",
          });
      }
    }

    const bookings = await bookingModel
      .find(query)
      .populate("listing")
      .populate("renter", "username email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Get host bookings error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}
export async function completeBooking(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Validate booking ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID"
      });
    }

    // Find booking
    const booking = await bookingModel.findById(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    // Only the host can complete the booking
    if (booking.host.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Only the host can complete this booking"
      });
    }

    // Booking must be active
    if (booking.bookingStatus !== "active") {
      return res.status(400).json({
        success: false,
        message: "Only active bookings can be completed"
      });
    }

    // Rental period must have ended
    if (new Date(booking.endDate) > new Date()) {
      return res.status(400).json({
        success: false,
        message: "Rental period has not ended yet"
      });
    }

    // Mark booking as completed
    booking.bookingStatus = "completed";

    await booking.save();

    // Return updated booking
    const completedBooking = await bookingModel
      .findById(booking._id)
      .populate("listing")
      .populate("renter", "username email")
      .populate("host", "username email");

    return res.status(200).json({
      success: true,
      message: "Booking completed successfully",
      booking: completedBooking
    });

  } catch (error) {
    console.error("Complete Booking Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

export async function getHostBookingById(req, res) {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;

    // Check if booking ID is provided
    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: "Booking ID required"
      });
    }

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID"
      });
    }

    // Find booking and populate details
    const booking = await bookingModel
      .findById(bookingId)
      .populate("listing")
      .populate("renter", "username email")
      .populate("host", "username email");

    // Check booking existence
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    // Check host authorization
    if (booking.host._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to access this booking"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Booking fetched successfully",
      booking
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}




