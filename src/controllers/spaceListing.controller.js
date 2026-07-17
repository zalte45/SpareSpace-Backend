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
            const listing = await listingModel.create({
                owner: decoded.id,

                title: req.body.title,
                description: req.body.description,
                category: req.body.category,

                location: {
                    street: req.body.street,
                    city: req.body.city,
                    state: req.body.state,
                    pincode: req.body.pincode,
                },

                availability: {
                    availableImmediately: req.body.availableImmediately,
                    availableFrom: req.body.availableFrom,
                    availableUntil: req.body.availableUntil,
                },

                rental: {
                    price: req.body.price,
                    securityDeposit: req.body.securityDeposit,
                    lateFee: req.body.lateFee,
                    minDuration: req.body.minDuration,
                    maxDuration: req.body.maxDuration,
                },

                images:uploadedImages,
            });
            console.log(uploadedImages);
            res.status(201).json({
                success: true,
                images: uploadedImages,
            });
        }

        if (!user) {
            console.log("User not founded")
        }
    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message,
        });

    }
}