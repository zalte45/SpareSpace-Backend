import multer from "multer";
import fileFilter from "../utils/multerFileFilter.js";

const storage = multer.memoryStorage()



export const upload=multer({
    storage,
    fileFilter,
    limits:{
        fileSize:5 * 1024 * 1024
    }
})

