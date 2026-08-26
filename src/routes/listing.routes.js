import * as spaceListing from '../controllers/spaceListing.controller.js'
import { Router } from "express";
import { upload } from '../middleware/upload.js';

const listingRouter = Router()

listingRouter.post("/listing", upload.array("images", 10),spaceListing.Listing);
listingRouter.post("/my-spaces",spaceListing.getMySpaces);
listingRouter.get("/listing",spaceListing.getAllSpaces);
listingRouter.get("/listing/:id",spaceListing.getSpaceById);


export default listingRouter

