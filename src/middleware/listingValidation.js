import { z } from "zod";

const listingObjectSchema = z.object({

    // Basic Details
    title: z.string()
        .trim()
        .min(5, "Title must be at least 5 characters")
        .max(100, "Title cannot exceed 100 characters"),

    description: z.string()
        .trim()
        .min(10, "Description must be at least 10 characters"),

    category: z.enum([
        "Garage",
        "Room",
        "Basement",
        "Warehouse"
    ]),

    // Location
    street: z.string().trim().min(1),
    city: z.string().trim().min(1),
    state: z.string().trim().min(1),

    pincode: z.string()
        .regex(/^\d{6}$/, "Pincode must be 6 digits"),

    // Availability
    availableImmediately: z.coerce.boolean(),
    availableFrom: z.coerce.date(),
    availableUntil: z.coerce.date(),

    minDuration: z.coerce.number().int().positive(),
    maxDuration: z.coerce.number().int().positive(),

    // Rental
    price: z.coerce.number().positive(),
    securityDeposit: z.coerce.number().nonnegative(),
    lateFee: z.coerce.number().nonnegative(),

    cancellationPolicy: z.string().min(1),

    // Space Details
    area: z.coerce.number().positive(),
    unit: z.enum(["sqft", "sqm"]),
    accessHours: z.string().min(1),
    rules: z.string().min(1),

    // Booking Preferences
    bookingPrefs: z.object({
        instantBooking: z.boolean().optional(),
        manualApproval: z.boolean().optional(),
        weekendBookings: z.boolean().optional(),
        longTermOnly: z.boolean().optional(),
        recurringRentals: z.boolean().optional(),
        autoRenewal: z.boolean().optional()
    }).passthrough().optional(),

    // Amenities
    amenities: z.object({
        climateControlled: z.boolean().optional(),
        cctvSurveillance: z.boolean().optional(),
        lockAvailable: z.boolean().optional(),
        lighting: z.boolean().optional(),
        electricity: z.boolean().optional(),
        fireSafety: z.boolean().optional(),
        insurance: z.boolean().optional(),
        loadingAssistance: z.boolean().optional()
    }).passthrough().optional(),    

});

export const listingSchema = listingObjectSchema
    .refine(
        (data) => data.availableUntil > data.availableFrom,
        {
            message: "End date must be after start date",
            path: ["availableUntil"]
        }
    )
    .refine(
        (data) => data.maxDuration >= data.minDuration,
        {
            message: "Maximum duration must be greater than or equal to minimum duration",
            path: ["maxDuration"]
        }
    );


export const updateListingSchema = listingObjectSchema.partial();