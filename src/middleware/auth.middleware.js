import jwt from 'jsonwebtoken';
import config from '../config/config.js';

export const protect = (req, res, next) => {
    try {
        const accessToken = req.cookies.accessToken;

        if (!accessToken) {
            return res.status(401).json({
                success: false,
                message: "Authentication token missing. Please sign in."
            });
        }

        const decoded = jwt.verify(accessToken, config.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired session. Please sign in again."
        });
    }
};
