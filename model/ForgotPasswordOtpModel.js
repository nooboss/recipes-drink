const mongoose = require("mongoose");

const ForgotPasswordOtpSchema = new mongoose.Schema({

    email: {
        type: String,
        required: true
    },
    otp: {
        type: Number,
        required: true
    },
    isOTPVerified: {
        type: Number,
        default: 0
    }
},
    { timestamps: true }
);

module.exports = mongoose.model("ForgotPasswordOpt", ForgotPasswordOtpSchema);