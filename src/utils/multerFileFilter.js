const fileFilter = (req, file, cb) => {
    const allowed = [
        "image/png",
        "image/jpeg",
        "image/webp",
    ];
    if (allowed.includes(file.mimetype)) {
        cb(null,true);
    }
    else{
        cb(new Error("Only images are allowed"),false)
    }
}

export default fileFilter