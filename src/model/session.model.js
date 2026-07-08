import mongoose from "mongoose";

const sessionSchema= new mongoose.Schema({
    user:{
        type:String,
        ref:"user",
        required:[true,"User is required !"]
    },
    refreshTokenHashed:{
        type:String,
        required:[true,"refresh token is required !"]
    },
    ip:{
        type:String,
        required:[true,"IP is required !"]
    },
    userAgent:{
        type:String,
        required:[true,"userAgent  is required !"]
    },
    revoked:{
        type:Boolean,
        default:false
    },
},{timestamps:true})

const sessionModel=mongoose.model("session",sessionSchema)

export default sessionModel

