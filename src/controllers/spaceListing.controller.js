import cloudinary from "../services/cloudinary.js";
import { Readable } from "stream";
import jwt from 'jsonwebtoken';
import crypto from 'crypto'
import config from "../config/config.js";
import userModel from "../model/user.model.js";
import listingModel from "../model/listing.model.js"
import { listingSchema, updateListingSchema } from "../middleware/listingValidation.js";

export async function Listing(req, res) {
    try {
        // 1. Check access token
        const accessToken = req.cookies.accessToken;

        if (!accessToken) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired token"
            });
        }

        // 2. Verify JWT
        const decoded = jwt.verify(
            accessToken,
            config.JWT_SECRET
        );

        // 3. Find user
        const user = await userModel.findById(decoded.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // 4. Parse bookingPrefs and amenities
        let bookingPrefs = {};
        let amenities = [];

        try {
            if (req.body.bookingPrefs) {
                bookingPrefs = JSON.parse(req.body.bookingPrefs);
            }

            if (req.body.amenities) {
                amenities = JSON.parse(req.body.amenities);
            }
        } catch (err) {
            return res.status(400).json({
                success: false,
                message: "bookingPrefs and amenities must be valid JSON"
            });
        }

        // 5. Validate listing data using Zod
        const validationData = {
            ...req.body,
            bookingPrefs,
            amenities
        };
        const result = listingSchema.safeParse(validationData);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                errors: result.error.issues
            });
        }
        console.log("Validation result:", result.success);
        console.log("Validation errors:", result.error?.issues);

        // Use validated data
        const data = result.data;

        // 6. Check uploaded images
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one image is required"
            });
        }

        if (req.files.length > 5) {
            return res.status(400).json({
                success: false,
                message: "Maximum 5 images allowed"
            });
        }

        // 7. Upload images to Cloudinary
        const uploadedImages = [];

        for (const file of req.files) {
            const result = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        folder: "SpareSpace"
                    },
                    (error, result) => {
                        if (error) return reject(error);
                        resolve(result);
                    }
                );

                Readable.from(file.buffer).pipe(uploadStream);
            });

            uploadedImages.push({
                url: result.secure_url,
                public_id: result.public_id
            });
        }

        // 8. Create listing in MongoDB
        const listing = await listingModel.create({
            owner: decoded.id,
            images: uploadedImages,

            title: data.title,
            description: data.description,
            category: data.category,

            street: req.body.street,
            city: req.body.city,
            state: req.body.state,
            pincode: req.body.pincode,

            availableImmediately: req.body.availableImmediately === "true",
            availableFrom: data.availableFrom,
            availableUntil: data.availableUntil,

            minDuration: req.body.minDuration,
            maxDuration: req.body.maxDuration,

            price: data.price,
            securityDeposit: data.securityDeposit,
            lateFee: data.lateFee,

            cancellationPolicy: req.body.cancellationPolicy,
            bookingPrefs,

            area: Number(req.body.area),
            unit: req.body.unit,
            accessHours: req.body.accessHours,
            rules: req.body.rules,

            amenities
        });

        // 9. Send success response
        return res.status(201).json({
            success: true,
            message: "Listing created successfully",
            listing
        });

    } catch (error) {
        console.error("Listing API Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}
export async function updateListing(req, res) {
    try {
        const listingId = req.params.id;

        // Check listing ID
        if (!listingId) {
            return res.status(400).json({
                success: false,
                message: "Listing ID is required!"
            });
        }

        // Find existing listing
        const listing = await listingModel.findById(listingId);

        if (!listing) {
            return res.status(404).json({
                success: false,
                message: "Listing not present!"
            });
        }

        // Check listing ownership
        if (!listing.owner.equals(req.user.id)) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to edit this listing!"
            });
        }

        // Validate updated data
        const validation = updateListingSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                success: false,
                message: `The error from validation: ${validation.error.issues
                    .map(issue => issue.message)
                    .join(", ")
                    } `
            });
        }

        const data = validation.data;

        // Merge booking preferences
        if (data.bookingPrefs) {
            listing.bookingPrefs = {
                ...listing.bookingPrefs.toObject(),
                ...data.bookingPrefs
            };
        }

        // Merge amenities
        if (data.amenities) {
            listing.amenities = {
                ...listing.amenities.toObject(),
                ...data.amenities
            };
        }

        // Update remaining fields
        const { bookingPrefs, amenities, ...otherData } = data;

        Object.assign(listing, otherData);

        // ---------------------------------
        // IMAGE CHANGES HANDLER
        // ---------------------------------

        // Extract images user wants to keep
        const keepImages = req.body.keepImages !== undefined
            ? JSON.parse(req.body.keepImages)
            : listing.images.map(image => image._id.toString());

        // Images to keep
        const imagesToKeep = listing.images.filter(image =>
            keepImages.includes(image._id.toString())
        );

        // Images to remove
        const imagesToRemove = listing.images.filter(image =>
            !keepImages.includes(image._id.toString())
        );

        // Upload new images
        const newImages = [];

        if (req.files && req.files.length > 0) {
            for (const file of req.files) {

                const result = await new Promise((resolve, reject) => {

                    const stream = cloudinary.uploader.upload_stream(
                        {
                            folder: "SpareSpace"
                        },
                        (error, result) => {
                            if (error) {
                                reject(error);
                            } else {
                                resolve(result);
                            }
                        }
                    );

                    Readable.from(file.buffer).pipe(stream);
                });

                newImages.push({
                    public_id: result.public_id,
                    url: result.secure_url
                });
            }
        }

        // Combine kept images and newly uploaded images
        listing.images = [
            ...imagesToKeep,
            ...newImages
        ];

        // Save updated listing to MongoDB
        await listing.save();

        // Delete removed images from Cloudinary
        for (const image of imagesToRemove) {
            await cloudinary.uploader.destroy(image.public_id);
        }

        return res.status(200).json({
            success: true,
            message: "Listing updated successfully!",
            listing
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}
export async function deleteListing(req, res) {
    try {
        const listingId = req.params.id;

        if (!listingId) {
            return res.status(400).json({
                success: false,
                message: "Listing ID is required"
            });
        }

        // Find the listing first   
        const listing = await listingModel.findById(listingId);

        if (!listing) {
            return res.status(404).json({
                success: false,
                message: "Listing not found"
            });
        }

        // Check ownership
        if (!listing.owner.equals(req.user.id)) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to archive this listing"
            });
        }

        // Check occupation
        if (listing.isOccupied === true) {
            return res.status(409).json({
                success: false,
                message: "Archiving is forbidden while the space is occupied"
            });
        }

        // Soft delete / archive
        listing.status = "archived";
        await listing.save();

        return res.status(200).json({
            success: true,
            message: "The space has been archived successfully"
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

export async function getMySpaces(req, res) {
    try {
        const accessToken = req.cookies.accessToken;
        if (!accessToken) {
            return res.status(401).json({
                success: false,
                message: "Access token missing",
            });
        }

        let decoded;

        try {
            decoded = jwt.verify(accessToken, config.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({
                success: false,
                message: "Access token expired or invalid",
            });
        }

        const user = await userModel.findById(decoded.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        const listings = await listingModel
            .find({ owner: decoded.id })
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: listings.length,
            listings,
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}
export async function getAllSpaces(req, res) {
    try {
        const {
            search,
            city,
            pincode,
            category,
            minPrice,
            maxPrice,
            minArea,
            maxArea,
            amenities,
            sort = "newest",
            page = 1,
            limit = 10,
            availableFrom,
        } = req.query;

        // -----------------------------
        // Build filter
        // -----------------------------
        const filter = {};

        // Search
        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } },
                { city: { $regex: search, $options: "i" } },
            ];
        }

        // City
        if (city) {
            filter.city = { $regex: city, $options: "i" };
        }

        // Pincode
        if (pincode) {
            filter.pincode = pincode;
        }

        // Category
        if (category) {
            filter.category = category;
        }

        // Price
        if (minPrice || maxPrice) {
            filter.price = {};

            if (minPrice) {
                filter.price.$gte = Number(minPrice);
            }

            if (maxPrice) {
                filter.price.$lte = Number(maxPrice);
            }
        }

        // Area
        if (minArea || maxArea) {
            filter.area = {};

            if (minArea) {
                filter.area.$gte = Number(minArea);
            }

            if (maxArea) {
                filter.area.$lte = Number(maxArea);
            }
        }

        // Amenities
        if (amenities) {
            const amenityArray = Array.isArray(amenities)
                ? amenities
                : amenities.split(",");

            filter.amenities = {
                $all: amenityArray,
            };
        }

        // Available from
        if (availableFrom) {
            filter.availableFrom = {
                $lte: new Date(availableFrom),
            };
        }

        // -----------------------------
        // Pagination
        // -----------------------------
        const currentPage = Math.max(Number(page), 1);
        const itemsPerPage = Math.max(Number(limit), 1);
        const skip = (currentPage - 1) * itemsPerPage;

        // -----------------------------
        // Sorting
        // -----------------------------
        let sortOption = { createdAt: -1 };

        if (sort === "oldest") {
            sortOption = { createdAt: 1 };
        }

        if (sort === "priceLow") {
            sortOption = { price: 1 };
        }

        if (sort === "priceHigh") {
            sortOption = { price: -1 };
        }

        if (sort === "areaLow") {
            sortOption = { area: 1 };
        }

        if (sort === "areaHigh") {
            sortOption = { area: -1 };
        }

        // -----------------------------
        // Get total count
        // -----------------------------
        const total = await listingModel.countDocuments(filter);

        // -----------------------------
        // Get listings
        // -----------------------------
        const listings = await listingModel
            .find(filter)
            .sort(sortOption)
            .skip(skip)
            .limit(itemsPerPage);

        // -----------------------------
        // Total pages
        // -----------------------------
        const totalPages = Math.ceil(total / itemsPerPage);

        return res.status(200).json({
            success: true,
            listings,
            total,
            totalPages,
            currentPage,
            limit: itemsPerPage,
        });

    } catch (error) {
        console.error("getAllSpaces error:", error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}
export async function getSpaceById(req, res) {
    try {
        const { id } = req.params;

        const listing = await listingModel.findById(id);

        if (!listing) {
            return res.status(404).json({
                success: false,
                message: "Listing not found",
            });
        }

        return res.status(200).json({
            success: true,
            listing,
        });

    } catch (error) {
        console.error("getSpaceById error:", error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}
export async function getFilteredSpaces(req, res) {
    const query = req.query;
    if (query) {
        console.log(query);
    } else {
        console.log("doesn't have");
    }
}