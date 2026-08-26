import cloudinary from "../services/cloudinary.js";
import { Readable } from "stream";
import jwt from 'jsonwebtoken';
import crypto from 'crypto'
import config from "../config/config.js";
import userModel from "../model/user.model.js";
import listingModel from "../model/listing.model.js"

export async function Listing(req, res) {
    
    try {
        const accessToken = req.cookies.accessToken;
        if (!accessToken) {
            return res.status(401).json({
                message: "Invalid or token expires !"
            })
        }
        const bookingPrefs = JSON.parse(req.body.bookingPrefs);
        const amenities = JSON.parse(req.body.amenities);
        let decoded = jwt.verify(accessToken, config.JWT_SECRET)
        let user = await userModel.findById(decoded.id)
        if (user) {
            const uploadedImages = [];
            for (const file of req.files) {
                const result = await new Promise((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        {
                            folder: "SpareSpace",
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
                    public_id: result.public_id,
                });
            }
            const bookingPrefs = JSON.parse(req.body.bookingPrefs);
            const amenities = JSON.parse(req.body.amenities);

            const listing = await listingModel.create({
                owner: decoded.id,
                images: uploadedImages,

                title: req.body.title,
                description: req.body.description,
                category: req.body.category,

                street: req.body.street,
                city: req.body.city,
                state: req.body.state,
                pincode: req.body.pincode,

                availableImmediately: req.body.availableImmediately === "true",
                availableFrom: req.body.availableFrom,
                availableUntil: req.body.availableUntil,

                minDuration: req.body.minDuration,
                maxDuration: req.body.maxDuration,

                price: Number(req.body.price),
                securityDeposit: Number(req.body.securityDeposit),
                lateFee: Number(req.body.lateFee),

                cancellationPolicy: req.body.cancellationPolicy,
                bookingPrefs,

                area: Number(req.body.area),
                unit: req.body.unit,
                accessHours: req.body.accessHours,
                rules: req.body.rules,

                amenities,
            });
            
            res.status(201).json({
                success: true,
                images: uploadedImages,
            });
        }

       
    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message,
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