import * as spaceListing from '../controllers/spaceListing.controller.js'
import { Router } from "express";
import { upload } from '../middleware/upload.js';
import {protect} from '../middleware/auth.middleware.js'

const listingRouter = Router()

listingRouter.post("/listing", protect, upload.array("images", 10), spaceListing.Listing);
listingRouter.get("/my-spaces", protect, spaceListing.getMySpaces);
listingRouter.get("/listing", spaceListing.getAllSpaces);
listingRouter.get("/listing/:id", spaceListing.getSpaceById);
listingRouter.delete("/listing/:id", protect, spaceListing.deleteListing);
listingRouter.patch("/listing/:id", protect, upload.array("images", 10), spaceListing.updateListing);



export default listingRouter

