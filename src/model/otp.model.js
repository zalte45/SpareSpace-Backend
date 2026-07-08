import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, "Email is required !"]

    },
    user: {
        type: String,
        required: [true, "User is required !"]
    },
    otpHashed:{
        type:String,
        required:[true,"otp is required !"]
    }
},{
    timestamps:true
})

const otpModel = mongoose.model("otps",otpSchema)
export default otpModel