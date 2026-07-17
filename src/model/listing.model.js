import mongoose from "mongoose";

const listSchema = new mongoose.Schema(
  {
    // Images
    images: [
      {
        public_id: String,
        url: String,
      },
    ],

    // Basic Info
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      required: true,
    },

    // Location
    street: {
      type: String,
      required: true,
    },

    city: {
      type: String,
      required: true,
    },

    state: {
      type: String,
      required: true,
    },

    pincode: {
      type: String,
      required: true,
    },

    // Availability
    availableImmediately: {
      type: Boolean,
      default: false,
    },

    availableFrom: {
      type: Date,
    },

    availableUntil: {
      type: Date,
    },

    // Rental
    minDuration: {
      type: String,
      default: "1 Month",
    },

    maxDuration: {
      type: String,
      default: "12 Months",
    },

    price: {
      type: Number,
      required: true,
    },

    securityDeposit: {
      type: Number,
      default: 0,
    },

    lateFee: {
      type: Number,
      default: 0,
    },

    // Policies
    cancellationPolicy: {
      type: String,
      default: "moderate",
    },

    bookingPrefs: {
      instantBooking: {
        type: Boolean,
        default: false,
      },

      manualApproval: {
        type: Boolean,
        default: false,
      },

      weekendBookings: {
        type: Boolean,
        default: false,
      },

      longTermOnly: {
        type: Boolean,
        default: false,
      },

      recurringRentals: {
        type: Boolean,
        default: false,
      },

      autoRenewal: {
        type: Boolean,
        default: false,
      },
    },

    // Space Details
    area: {
      type: Number,
    },

    unit: {
      type: String,
      default: "sq ft",
    },

    accessHours: {
      type: String,
    },

    rules: {
      type: String,
      default: "",
    },

    amenities: {
      climateControlled: {
        type: Boolean,
        default: false,
      },

      cctvSurveillance: {
        type: Boolean,
        default: false,
      },

      lockAvailable: {
        type: Boolean,
        default: false,
      },

      lighting: {
        type: Boolean,
        default: false,
      },

      electricity: {
        type: Boolean,
        default: false,
      },

      fireSafety: {
        type: Boolean,
        default: false,
      },

      insurance: {
        type: Boolean,
        default: false,
      },

      loadingAssistance: {
        type: Boolean,
        default: false,
      },
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const listingModel=mongoose.model("Listing", listSchema);

export default listingModel