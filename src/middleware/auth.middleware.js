import jwt from 'jsonwebtoken';
import config from '../config/config.js';
import sessionModel from '../model/session.model.js';

export const protect = async (req, res, next) => {
    try {
        const accessToken = req.cookies.accessToken;

        if (!accessToken) {
            return res.status(401).json({
                success: false,
                message: "Authentication token missing. Please sign in."
            });
        }

        const decoded = jwt.verify(accessToken, config.JWT_SECRET);

        // 1. Validate sessionId is embedded in access token
        if (!decoded || !decoded.id || !decoded.sessionId) {
            return res.status(401).json({
                success: false,
                message: "Invalid session token. Please sign in again."
            });
        }

        // 2. Validate session exists, is not revoked, and belongs to authenticated user
        const session = await sessionModel.findById(decoded.sessionId);
        if (!session || session.revoked || session.user.toString() !== decoded.id.toString()) {
            return res.status(401).json({
                success: false,
                message: "Session has been revoked or expired. Please sign in again."
            });
        }

        req.user = decoded;
        req.session = session;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired session. Please sign in again."
        });
    }
};
