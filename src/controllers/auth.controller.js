import userModel from "../model/user.model.js";
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import config from "../config/config.js";
import sendEmail from "../services/email.service.js";
import sessionModel from "../model/session.model.js";
import otpModel from "../model/otp.model.js";
import { generateOtp, getOtpHtml, getOtpHtmlForget } from "../utils/utils.js";



export async function register(req, res) {
    try {
        // registration logic
        console.log("Api is working !!")
        const { username, email, password } = req.body;
        console.time("find user")
        const IsAlreadyRegister = await userModel.findOne({
            $or: [
                { username },
                { email }
            ]
        })
        console.timeEnd("find user")

        if (IsAlreadyRegister) {
            return res.status(409).json({
                Message: "User already exist please try to login"
            })
        }

        const hashedPassword = crypto.createHash("sha256").update(password).digest("hex")
        console.log(hashedPassword)

        const user = await userModel.create({
            username,
            email,
            password: hashedPassword
        })


        const verifyToken = jwt.sign({
            email: user.email
        }, config.JWT_SECRET, {
            "expiresIn": "10m"
        })
        const otp = generateOtp()
        console.log(otp)
        const otpHtml = getOtpHtml(otp)
        const otpHashed = crypto.createHash("sha256").update(otp).digest("hex");
        await otpModel.create({
            email,
            user: user._id,
            otpHashed
        })
        await sendEmail(email,"OTP verification",`Your otp code is ${otp}`,otpHtml)
        res.status(201).json({
            Message: "User register successfully !!",
            user: {
                username: user.username,
                email: user.email
            },
            verifyToken
        })

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Internal server error"
        });
    }


}

export async function getMe(req, res) {
    const token = req.cookies.refreshToken
    if (!token) {
        return res.status(401).json({
            Message: "Token not found"
        })
    }
    const decoded = jwt.verify(token, config.JWT_SECRET)
    const user = await userModel.findById(decoded.id)
    res.status(200).json({
        Message: "User found successfully !",
    }, token)
}

export async function login(req, res) {
    const { email, password } = req.body;
    try {

        const user = await userModel.findOne({ email })
        if (!user) {
            return res.status(400).json({
                Message: "Invalid email or password !"
            })
        }
        const hashedPassword = crypto.createHash("sha256").update(password).digest("hex")
        const isValidPassword = hashedPassword === user.password
        if (!isValidPassword) {
            return res.status(400).json({
                Message: "invalid email or password !"
            })
        }
        const refreshToken = jwt.sign({
            id: user._id
        }, config.JWT_SECRET, {
            expiresIn: "7d"
        })

        const refreshTokenHashed = crypto.createHash("sha256").update(refreshToken).digest("hex")
        const session = await sessionModel.create({
            user: user._id,
            refreshTokenHashed,
            ip: req.ip,
            userAgent: req.headers["user-agent"]
        })


        const accessToken = jwt.sign({
            id: user._id,
            sessionId: session._id
        }, config.JWT_SECRET, {
            expiresIn: "15m"
        })
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000 //7days
        })

        res.status(200).json({
            Message: "Logged in successfully",
            user: {
                username: user.username,
                email: user.email
            },
            accessToken,
        })

    } catch (error) {
        console.error(error)
        return res.status(500).json({
            Message: "Internal server error"
        })
    }
}

export async function refreshToken(req, res) {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
        return res.status(401).json({
            Message: "Refresh Token not found !"
        })
    }

    const refreshTokenHashed = crypto.createHash("sha256").update(refreshToken).digest("hex");
    const session = await sessionModel.findOne({
        refreshTokenHashed,
        revoked: false
    })
    if (!session) {
        return res.status(401).json({
            Message: "invalid refresh token !"
        })
    }
    const decoded = jwt.verify(refreshToken, config.JWT_SECRET);
    const accessToken = jwt.sign({
        id: decoded._id
    }, config.JWT_SECRET, {
        expiresIn: "15m"
    })
    const newRefreshToken = jwt.sign({
        id: decoded._id
    }, config.JWT_SECRET, {
        expiresIn: "7d"
    })

    const newRefreshTokenHashed = crypto.createHash("sha256").update(newRefreshToken).digest("hex");
    session.refreshTokenHashed = newRefreshTokenHashed;
    await session.save()

    res.status(200).json({
        Message: "Access token refresh successFully !",
        accessToken
    })
}

export async function Logout(req, res) {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
        return res.status(400).json({
            Message: "Token not found !"
        })
    }
    const refreshTokenHashed = crypto.create("sha256").update(refreshToken).digest("hex");
    const session = await sessionModel.findOne({
        refreshTokenHashed,
        revoked: false
    })

    if (!session) {
        return res.status(200).json({
            Message: "Invalid refresh token !!"
        })
    }
    session.revoked = true;
    await session.save()

    res.clearCookie("refreshToken");

    res.status(200).json({
        Message: "Logout SuccessFull"
    })

}

export async function verifyOtp(req, res) {
    try {
        const { otp, verifyToken } = req.body;
        if (!otp || !verifyToken) {
            return res.status(401).json({
                Message: "Invalid otp or verifyToken"
            })
        }
        console.log(verifyToken)
        const decoded = jwt.verify(verifyToken, config.JWT_SECRET)
        console.log(otp)
        const otpHashed = crypto.createHash("sha256").update(otp).digest("hex");
        console.log(otpHashed)
        const otpDoc = await otpModel.findOne({
            email: decoded.email,
            otpHashed
        })
        console.log(otpDoc)
        if (!otpDoc) {
            return res.status(401).json({
                message: "user not found"
            })
        }

        const user = await userModel.findByIdAndUpdate(
            otpDoc.user,
            {
                verified: true
            },
            {
                new: true
            }
        )

        await otpModel.deleteMany({
            user: otpDoc.user
        })
        console.log("")

        return res.status(200).json({
            message: "Email verified successfully !",
            user: {
                username: user.username,
                email: user.email,
                verified: user.verified
            }
        })

    } catch (err) {
        return res.status(401).json({
            message: "Verify token is invalid or expired"
        });
    }
}

export async function forgotOtp(req, res) {
    const email = req.body.email;
    if (!email) {
        return res.status(401).json({
            Message: "Invalid email"
        })
    }

    const user = await userModel.findOne({ email })
    if (!user) {
        return res.status(401).json({
            Message: "User not found"
        })
    }
    console.log(user._id)

    const otp = generateOtp()
    const otpHashed = crypto.createHash("sha256").update(otp).digest("hex")
    const getOtpHtml = getOtpHtmlForget(otp)
    // await sendEmail(email, "Rest Otp", getOtpHtml)
    await sendEmail(email,"Rest Otp",`Your otp code is ${otp}`,getOtpHtml)


    await otpModel.create({
        email,
        user: user._id,
        otpHashed
    })
    res.status(201).json({
        Message: "User found !"
    })

}
export async function forgotOtpVerify(req, res) {
    const { otp, email } = req.body;
    if (!otp || !email) {
        return res.status(400).json({
            Message: "Invalid otp or email"
        })
    }
    const otpHashed = crypto.createHash("sha256").update(otp).digest("hex")
    const otpDoc = await otpModel.findOne({
        email,
        otpHashed
    })
    if (!otpDoc) {
        return res.status(401).json({
            Message: "User not found"
        })
    }
    const resetToken = jwt.sign({
        user: otpDoc.user,
        email: otpDoc.email
    }, config.JWT_SECRET, {
        expiresIn: "10m"
    })

    res.status(201).json({
        Message: "User find ",
        resetToken
    })
}
export async function newPassword(req, res) {
    const { password, resetToken } = req.body;
    console.log(password)
    console.log(resetToken)
    if (!password || !resetToken) {
        return res.status(400).json({
            Message: "Invalid credential"
        })
    }
    console.log(password)
    const passwordHash = crypto.createHash("sha256").update(password).digest("hex")
    const decoded = jwt.verify(resetToken, config.JWT_SECRET);
    const user = await userModel.findById(decoded.user)
    const isPasswordExist = await userModel.findById(decoded.user)

    if (user.password === passwordHash) {
        return res.status(400).json({
            Message: "can't send old password again plz try new !"
        })
    }

    await userModel.findByIdAndUpdate(
        decoded.user,
        {
            password: passwordHash
        }
    )
    res.status(201).json({
        Message: "Password rest successFull !"
    })
}

