import * as spaceListing from '../controllers/spaceListing.controller.js'
import { Router } from "express";
import { upload } from '../middleware/upload.js';

const listingRouter = Router()

console.log("Listing router loaded");
// listingRouter.post("/listing",spaceListing.Listing);

listingRouter.post("/listing", upload.array("images", 10),spaceListing.Listing);

export default listingRouter

