// Importing required modules 
const sha256 = require("sha256");
const otpGenerator = require("otp-generator");
const jwt = require("jsonwebtoken");

// Importing models
const userModel = require("../model/userModel");
const otpModel = require("../model/otpModel");
const ForgotPasswordOtpModel = require("../model/ForgotPasswordOtpModel");
const introModel = require("../model/introModel");
const categoryModel = require("../model/categoryModel");
const cuisinesModel = require("../model/cuisinesModel");
const recipeModel = require("../model/recipeModel");
const recommendedRecipeModel = require("../model/recommendedRecipeModel");
const favouriteRecipeModel = require("../model/favouriteRecipeModel");
const reviewModel = require("../model/reviewModel");
const adsModel = require("../model/adsModel");
const faqModel = require("../model/faqModel");
const settingModel = require("../model/settingModel");
const userNotificationModel = require("../model/userNotificationModel");
const notificationModel = require("../model/notificationModel");

// Importing the function to send otp mail
const sendOtpMail = require("../services/sendOtpMail");

// Importing the service function to delete uploaded files
const { deleteImages } = require("../services/deleteImage");

// Importing the function to combine recipe, review information
const combineRecipeReview = require("../services/combineRecipeReview");

//check register user
const CheckRegisterUser = async (req, res) => {

    try {

        // Extract data from the request
        const email = req.body.email;

        // Check if user already exists
        const isExistEmail = await userModel.findOne({ email });

        if (isExistEmail) {
            return res.json({ data: { success: 0, message: "User already exists", error: 1 } });
        }

        return res.json({ data: { success: 1, message: "User does not exist, please sign up", error: 0 } });

    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ data: { success: 0, message: "An error occurred", error: 1 } });
    }
}

//sign up
const SignUp = async (req, res) => {

    try {

        // Extract data from the request
        const firstname = req.body.firstname;
        const lastname = req.body.lastname;
        const email = req.body.email;
        const country_code = req.body.country_code;
        const phone = req.body.phone;
        const password = sha256.x2(req.body.password);

        // Check if user already exists
        const isExistEmail = await userModel.findOne({ email });

        if (isExistEmail) {
            return res.json({ data: { success: 0, message: "User already exists", error: 1 } });
        }

        // generate otp
        const otp = otpGenerator.generate(4, { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false, });

        // Send OTP email
        try {

            await sendOtpMail(otp, email, firstname, lastname);

        } catch (emailError) {
            return res.json({ data: { success: 0, message: "Something went wrong. Please try again...", error: 1 } });
        }

        // Save OTP 
        const otpDoc = await otpModel.findOneAndUpdate({ email: email }, { $set: { email: email, otp: otp, } }, { upsert: true, new: true, });

        // Create a new user 
        const savedUser = await new userModel({ firstname, lastname, email, phone, password, country_code }).save();

        if (!savedUser) {
            return res.json({ data: { success: 0, message: "Sign-up unsuccessful. Please try again later.", error: 1 } });
        }

        return res.json({ data: { success: 1, message: "Successfully signed up! Please check your email to verify OTP.", error: 0 } });

    } catch (error) {
        console.log("Error during user registration:", error.message);
        return res.status(500).json({ data: { success: 0, message: "An error occurred", error: 1 } });
    }
}

// Function to send OTP verification email
const VerifyOtp = async (req, res) => {

    try {

        // Extract data from the request body
        const email = req.body.email;
        const otp = req.body.otp;

        // Validate email and otp
        if (!email || !otp) {
            return res.json({ data: { success: 0, message: "Email and OTP is required", error: 1 } });
        }

        // Check if there is an OTP record for the given email
        const user = await otpModel.findOne({ email: email });

        if (!user) {
            return res.json({ data: { success: 0, message: "Email not found. Please try again...", error: 1 } });
        }

        if (otp !== user.otp) {

            return res.json({ data: { success: 0, message: "Incorrect OTP. Please try again...", error: 1 } });
        }

        // Update the otp verify status
        const updatedUser = await userModel.findOneAndUpdate({ email }, { $set: { isOTPVerified: 1 } });

        // Generate token
        const token = jwt.sign({ id: updatedUser._id, email }, process.env.JWT_SECRET_KEY);

        // Exclude sensitive fields from the user object
        const filteredUser = {
            _id: updatedUser._id,
            firstname: updatedUser.firstname,
            lastname: updatedUser.lastname,
            email: updatedUser.email,
            country_code: updatedUser.country_code,
            phone: updatedUser.phone,
            is_active: updatedUser.is_active
        };

        // Delete otp
        await otpModel.deleteOne({ email });

        // Update user notification data
        const { registrationToken, deviceId } = req.body;

        await userNotificationModel.updateOne({ userId: updatedUser._id, deviceId }, { $set: { registrationToken } }, { upsert: true });

        return res.json({ data: { success: 1, message: "OTP verified successfully", token, user: filteredUser, error: 0 } });

    } catch (error) {
        console.log("Error during otp verify:", error.message);
        return res.status(500).json({ data: { success: 0, message: "An error occurred", error: 1 } });
    }
}

//for sign in
const SignIn = async (req, res) => {

    try {

        // Extract data from the request
        const email = req.body.email;
        const password = sha256.x2(req.body.password);

        // Validate email and password
        if (!email || !password) {
            return res.json({ data: { success: 0, message: "Email and password is required", error: 1 } });
        }

        // fetch particular user
        const user = await userModel.findOne({ email });

        if (!user) {
            return res.json({ data: { success: 0, message: "User does not exist, please sign up", error: 1 } });
        }

        // compare password
        if (password !== user.password) {
            return res.json({ data: { success: 0, message: "We’re sorry, something went wrong when attempting to sign in.", error: 1 } });
        }

        // compare password
        if (user.is_active === 0) {
            return res.json({ data: { success: 0, message: "Your account has been banned. Please contact support for more details.", error: 1 } });
        }

        // generate token
        const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET_KEY);

        // Exclude sensitive fields from the user object
        const filteredUser = {
            _id: user._id,
            firstname: user.firstname,
            lastname: user.lastname,
            email: user.email,
            country_code: user.country_code,
            phone: user.phone,
            is_active: user.is_active
        };

        // Update user notification data
        const { registrationToken, deviceId } = req.body;

        await userNotificationModel.updateOne({ userId: user._id, deviceId }, { $set: { registrationToken } }, { upsert: true });

        // response based on user verification status
        if (!user.isOTPVerified) {

            return res.json({ data: { success: 1, message: "Login successful ..., but your account is pending verification. Please check your email to complete the verification process.", token, user: filteredUser, error: 0 } });
        }
        else {

            return res.json({ data: { success: 1, message: "Logged in successfully.", token, user: filteredUser, error: 0 } });
        }

    } catch (error) {
        console.log("Error during user sign in:", error.message);
        return res.status(500).json({ data: { success: 0, message: "An error occurred", error: 1 } });
    }
}

// is verify account
const isVerifyAccount = async (req, res) => {

    try {

        // Extract data from the request body
        const email = req.body.email;

        // Validate email
        if (!email) {
            return res.json({ data: { success: 0, message: "Email is required", error: 1 } });
        }

        // fetch user
        const existingUser = await userModel.findOne({ email: email });

        if (!existingUser) {
            return res.json({ data: { success: 0, message: "User not found", error: 1 } });
        }

        if (!existingUser.isOTPVerified) {
            return res.json({ data: { success: 0, message: "Your account is not verified. Please verify your account...", error: 1 } });
        }
        else {

            return res.json({ data: { success: 1, message: "Your account has been successfully verified.", error: 0 } });
        }

    } catch (error) {
        console.log("Error during is verify account", error.message);
        return res.json({ data: { success: 0, message: "An error occurred", error: 1 } });
    }
}

// resend otp
const resendOtp = async (req, res) => {

    try {

        // Extract data from the request body
        const email = req.body.email;

        // Validate email
        if (!email) {
            return res.json({ data: { success: 0, message: "Email is required", error: 1 } });
        }

        // Check if user already exists
        const existingUser = await userModel.findOne({ email: email });

        if (!existingUser) {
            return res.json({ data: { success: 0, message: "User not found", error: 1 } });
        }

        if (existingUser.isOTPVerified === 1) {
            return res.json({ data: { success: 0, message: "Your account is already verified.", error: 1 } });
        }

        // generate otp
        const otp = otpGenerator.generate(4, {
            upperCaseAlphabets: false,
            specialChars: false,
            lowerCaseAlphabets: false,
        });

        // Save OTP 
        const otpDoc = await otpModel.findOneAndUpdate({ email: email }, { $set: { email: email, otp: otp, } }, { new: true, upsert: true });

        // Send OTP email
        try {

            await sendOtpMail(otp, email, existingUser.firstname, existingUser.lastname);

        } catch (emailError) {
            return res.json({ data: { success: 0, message: "Something went wrong. Please try again...", error: 1 } });
        }

        return res.json({ data: { success: 1, message: "We've sent an OTP to your email. Please check your inbox to verify your account.", error: 0 } });

    } catch (error) {
        console.log("Error during verify Account", error.message);
        return res.json({ data: { success: 0, message: "An error occurred", error: 1 } });
    }
}

//forgot password
const ForgotPassword = async (req, res) => {

    try {

        // Extract data from the request
        const email = req.body.email;

        // Check if email already exists or not
        const isExistEmail = await userModel.findOne({ email });

        if (!isExistEmail) {
            return res.json({ data: { success: 0, message: "Incorrect Email, Please try again", error: 1 } });
        }

        // generate otp
        const otp = otpGenerator.generate(4, { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false, });

        // Send OTP email
        try {

            await sendOtpMail(otp, email, isExistEmail.firstname, isExistEmail.lastname);

        } catch (emailError) {
            return res.json({ data: { success: 0, message: "Something went wrong. Please try again...", error: 1 } });
        }

        // save OTP
        let otpRecord = await ForgotPasswordOtpModel.findOneAndUpdate({ email }, { otp }, { upsert: true, new: true });

        return res.json({ data: { success: 1, message: "Please check your email to verify OTP.", error: 0 } });

    } catch (error) {
        console.log("Error during  forgot password:", error.message);
        return res.status(500).json({ data: { success: 0, message: "An error occurred", error: 1 } });
    }
}

//forgot password verification
const ForgotPasswordVerification = async (req, res) => {

    try {

        // Extract data from the request
        const email = req.body.email;
        const otp = req.body.otp;

        // Check if there is an OTP record for the given email
        const isExistEmail = await ForgotPasswordOtpModel.findOne({ email });

        if (!isExistEmail) {
            return res.json({ data: { success: 0, message: "Invalid Email. Please try again.", error: 1 } });
        }

        // Check if the provided OTP matches the stored OTP
        if (otp !== isExistEmail.otp) {
            return res.json({ data: { success: 0, message: "Invalid Otp. Please try again.", error: 1 } });
        }

        // Update the OTP verify status
        const isVerify = await ForgotPasswordOtpModel.findOneAndUpdate({ email: email }, { $set: { isOTPVerified: 1 } });

        return res.json({ data: { success: 1, message: "OTP verified successfully.", error: 0 } });

    } catch (error) {
        console.log("Error during forgot password verification:", error.message);
        return res.status(500).json({ data: { success: 0, message: "An error occurred", error: 1 } });
    }
}

//Reset password
const ResetPassword = async (req, res) => {

    try {

        // Extract data from the request
        const email = req.body.email;
        const newPassword = sha256.x2(req.body.newPassword);

        // Check if there is an OTP record for the given email
        const isExistEmail = await ForgotPasswordOtpModel.findOne({ email });

        if (!isExistEmail) {
            return res.json({ data: { success: 0, message: "Invalid Email. Please try again.", error: 1 } });
        }

        // Check if the user's OTP is not verified
        if (isExistEmail.isOTPVerified !== 1) {
            return res.json({ data: { success: 0, message: "Please Verify Your OTP", error: 1 } });
        }

        //update password
        const updatePassword = await userModel.findOneAndUpdate({ email: email }, { $set: { password: newPassword } });

        // Delete the OTP record from the OTP model after verification
        await ForgotPasswordOtpModel.deleteOne({ email: email });

        return res.json({ data: { success: 1, message: "Successfully Reset Password !!", error: 0 } });

    } catch (error) {
        console.log("Error during reset password:", error.message);
        return res.status(500).json({ data: { success: 0, message: "An error occurred", error: 1 } });
    }
}

//Change password for user
const ChangePassword = async (req, res) => {

    try {

        // Extract data from the request
        const userId = req.user;
        const currentPassword = sha256.x2(req.body.currentPassword);
        const newPassword = sha256.x2(req.body.newPassword);
        const confirmPassword = sha256.x2(req.body.confirmPassword);

        if (newPassword !== confirmPassword) {
            return res.json({ data: { success: 0, message: "Confirm password does not match", error: 1 } });
        }

        const userData = await userModel.findById(userId);

        if (currentPassword !== userData.password) {
            return res.json({ data: { success: 0, message: "Incorrect current password. Please enter the correct password and try again.", error: 1 } });
        }

        // update password
        const updatedPassword = await userModel.findByIdAndUpdate({ _id: userId }, { $set: { password: newPassword } }, { new: true });

        return res.json({ data: { success: 1, message: "Password changed successfully", error: 0 } });

    } catch (error) {
        console.log("Error during change password:", error.message);
        return res.status(500).json({ data: { success: 0, message: "An error occurred", error: 1 } });
    }
}

// delete account for user
const DeleteAccountUser = async (req, res) => {

    try {

        // Extract data from the request
        const userId = req.user;

        // fetch particular user
        const user = await userModel.findOne({ _id: userId });

        if (user.avatar) {
            // delete user avatar
            deleteImages(user.avatar);
        }

        // delete review
        const deletedReview = await reviewModel.deleteMany({ userId: userId });

        //  delete favourite recipe
        const deletedFavouriteRecipe = await favouriteRecipeModel.deleteMany({ userId: userId });

        //  delete notification
        const deletenotification = await userNotificationModel.deleteMany({ userId: userId });

        // delete user
        const deleteUser = await userModel.deleteOne({ _id: userId });

        return res.json({ data: { success: 1, message: "successfully deleted user", error: 0 } });

    } catch (error) {
        console.log("Error during delete account ", error.message);
        return res.status(500).json({ data: { success: 0, message: "An error occurred", error: 1 } });
    }
}

// edit user profile
const UserEdit = async (req, res) => {

    try {

        // Extract data from the request
        const id = req.user;
        const firstname = req.body.firstname;
        const lastname = req.body.lastname;
        const country_code = req.body.country_code;
        const phone = req.body.phone;
        const newAvatar = req.body ? req.body.avatar : "";

        // Find the user by ID
        const user = await userModel.findById(id);

        if (user.avatar) {
            // delete user avatar
            deleteImages(user.avatar);
        }

        // update user details
        const updatedUser = await userModel.findOneAndUpdate({ _id: id }, { $set: { firstname, lastname, country_code, phone, avatar: newAvatar } }, { new: true })

        if (!updatedUser) {

            return res.json({ data: { success: 0, message: "User Profile Not Updated", error: 1 } });
        }

        return res.json({ data: { success: 1, message: "User Profile Updated Successfully", error: 0 } });

    } catch (error) {
        console.log("Error during user edit:", error.message);
        return res.status(500).json({ data: { success: 0, message: "An error occurred", error: 1 } });
    }
}

// get user details 
const GetUser = async (req, res) => {

    try {

        // Extract data from the request
        const id = req.user;

        // Find user in the database using the provided ID
        const user = await userModel.findOne({ _id: id }, { token: 0, password: 0, isOTPVerified: 0 });

        // Check if the user is not found
        if (!user) {

            return res.json({ data: { success: 0, message: "User Not Found", user, error: 1 } });
        }

        return res.json({ data: { success: 1, message: "User Found", user, error: 0 } });

    } catch (error) {
        console.log("Error during get user details:", error.message);
        return res.status(500).json({ data: { success: 0, message: "An error occurred", error: 1 } });
    }
}

//upload image
const UploadImage = async (req, res) => {

    try {

        // Extract data from the request
        const avatar = req.file.filename;

        // Checking if the image file exists
        if (avatar) {

            return res.json({ data: { success: 1, message: "Image Uploaded Successfully", image: avatar, error: 0 } });
        }
        else {

            return res.json({ data: { success: 0, message: "Image Not uploaded", error: 1 } });
        }

    } catch (error) {
        console.log("Error during upload image:", error.message);
        return res.status(500).json({ data: { success: 0, message: "An error occurred", error: 1 } });
    }
}

// get all intro
const getAllIntro = async (req, res) => {

    try {

        // fetch all intro
        const intro = await introModel.find();

        if (!intro.length) {

            return res.json({ data: { success: 0, message: "Intro Not Found", intro: intro, error: 1 } });
        }
        else {

            return res.json({ data: { success: 1, message: "Intro Found", intro: intro, error: 0 } })
        }

    } catch (error) {
        console.log("Error during get all intro ", error.message);
        return res.status(500).json({ data: { success: 0, message: "An error occurred", error: 1 } });
    }
}

//Get All Category
const GetAllCategory = async (req, res) => {

    try {

        // fetch all category
        const category = await categoryModel.find({ status: "Publish" }, { status: 0 });

        // Check if the category is not found
        if (!category.length) return res.json({ data: { success: 0, message: "Category Not Found", category: category, error: 1 } });

        return res.json({ data: { success: 1, message: "Category Found", category: category, error: 0 } });

    } catch (error) {
        console.log("Error during get all category:", error.message);
        return res.status(500).json({ data: { success: 0, message: "An error occurred", error: 1 } });
    }
}

//get all cuisines
const GetAllCuisines = async (req, res) => {

    try {

        // fetch all cuisines
        const cuisines = await cuisinesModel.find(req.body);

        // Check if the cuisines is not found
        if (!cuisines || !cuisines.length) {

            return res.json({ data: { success: 0, message: "Cuisines Not Found", cuisines: cuisines, error: 1 } });
        }
        else {

            return res.json({ data: { success: 1, message: "Cuisines Found", cuisines: cuisines, error: 0 } });
        }

    } catch (error) {
        console.log("Error during get all cuisines:", error.message);
        return res.status(500).json({ data: { success: 0, message: "An error occurred", error: 1 } });
    }
}

//get all recipe
const GetAllRecipe = async (req, res) => {

    try {

        // Extract data from the request body
        const userId = req.body.userId || undefined;
        const categoryId = req.body.categoryId;
        const page = req.body.page || 1;
        const per_page_item = req.body.per_page_item || 10;

        // Calculate the number of documents to skip
        const skip = (page - 1) * per_page_item;

        let filters = {};

        if (categoryId) { filters.categoryId = categoryId; }

        filters.status = "Publish"

        // fetch all recipe
        const recipe = await recipeModel.find(filters).select({ status: 0 })
            .populate("categoryId cuisinesId", "_id name").skip(skip).limit(per_page_item);

        // fetch all review
        const review = await reviewModel.find().populate({ path: 'userId', select: 'firstname lastname email -_id' });

        // fetch all favourite recipe 
        const favouriteRecipe = await favouriteRecipeModel.find({ userId });

        const updatedRecipe = await combineRecipeReview(recipe, review, favouriteRecipe);

        // Check if the recipe is not found
        if (!updatedRecipe.length) {

            return res.json({ data: { success: 0, message: "Recipe Not Found", recipe: updatedRecipe, error: 1 } });
        }
        else {
            return res.json({ data: { success: 1, message: "Recipe Found", recipe: updatedRecipe, error: 0 } });
        }

    } catch (error) {
        console.log("Error during get all recipe:", error.message);
        return res.status(500).json({ data: { success: 0, message: "An error occurred", error: 1 } });
    }
}

//popular recipe
const popularRecipe = async (req, res) => {

    try {

        // Extract data from the request body
        const userId = req.body.userId || undefined;
        const page = req.body.page || 1;
        const per_page_item = req.body.per_page_item || 10;

        // Calculate the number of documents to skip
        const skip = (page - 1) * per_page_item;

        // fetch all recipe
        const recipe = await recipeModel.find({ status: "Publish" }, { status: 0 })
            .populate("categoryId cuisinesId", "_id name").skip(skip).limit(per_page_item);

        // fetch all review
        const review = await reviewModel.find().populate({ path: 'userId', select: 'firstname lastname email -_id' });

        // fetch all favourite recipe
        const favouriteRecipe = await favouriteRecipeModel.find({ userId });

        const updatedRecipe = await combineRecipeReview(recipe, review, favouriteRecipe);

        // Sorting in descending order of totalRating
        updatedRecipe.sort((a, b) => b.totalRating - a.totalRating);

        // Check if the recipe is not found 
        if (!updatedRecipe.length) {

            return res.json({ data: { success: 0, message: "Recipe Not Found", recipe: updatedRecipe, error: 1 } });
        }
        else {
            return res.json({ data: { success: 1, message: "Recipe Found", recipe: updatedRecipe, error: 0 } });
        }

    } catch (error) {
        console.log("Error during popular recipe:", error.message);
        return res.status(500).json({ data: { success: 0, message: "An error occurred", error: 1 } });
    }
}

// recommended recipe
const recommendedRecipe = async (req, res) => {

    try {

        // Extract data from the request body
        const userId = req.body.userId;
        const deviceId = req.body.deviceId;
        const page = req.body.page || 1;
        const per_page_item = req.body.per_page_item || 10;

        // Calculate the number of documents to skip
        const skip = (page - 1) * per_page_item;

        let remainingRecipes;

        // Find recommended recipe and extract filters
        const filterdata = await recommendedRecipeModel.findOne({ $or: [{ deviceId }, { userId }] });

        // Check if filterdata is not empty
        if (!filterdata) {
            // If no filters are present, fetch all recipes
            remainingRecipes = await recipeModel.find({ status: "Publish" }, { status: 0 })
                .populate("categoryId cuisinesId", "_id name").sort({ createdAt: -1 }).skip(skip).limit(per_page_item);
        } else {
            // If filters are present, apply them
            remainingRecipes = await recipeModel.find({ $or: [{ categoryId: filterdata.categoryId }, { cuisinesId: filterdata.cuisinesId }], status: "Publish" }, { status: 0 })
                .populate("categoryId cuisinesId", "_id name").skip(skip).limit(per_page_item);;
        }

        // fetch all review
        const review = await reviewModel.find().populate({ path: 'userId', select: 'firstname lastname email -_id' });

        // fetch all favourite recipe
        const favouriteRecipe = await favouriteRecipeModel.find({ userId });

        const updatedRecipe = await combineRecipeReview(remainingRecipes, review, favouriteRecipe);

        // Check if the recipe is not found
        if (!updatedRecipe.length) {

            return res.json({ data: { success: 0, message: "Recipe Not Found", recipe: updatedRecipe, error: 1 } });
        }
        else {
            return res.json({ data: { success: 1, message: "Recipe Found", recipe: updatedRecipe, error: 0 } });
        }

    } catch (error) {
        console.log("Error during recommended recipe:", error.message);
        return res.status(500).json({ data: { success: 0, message: "An error occurred", error: 1 } });
    }
}

//get recipe by id
const GetRecipeById = async (req, res) => {

    try {

        // Extract data from the request
        const userId = req.body.userId || undefined;
        const recipeId = req.body.recipeId;
        const deviceId = req.body.deviceId;

        // fetch all recipe
        const recipe = await recipeModel.findById({ _id: recipeId, status: "Publish" }, { status: 0 })
            .populate("categoryId cuisinesId", "_id name");

        if (!recipe) return res.json({ data: { success: 0, message: "Recipe Not Found", recipe: {}, error: 1 } });

        // fetch all review
        const reviews = await reviewModel.find({ recipeId: recipe._id }).populate({ path: 'userId', select: 'firstname lastname email -_id' });

        // fetch all favourite recipe
        const favouriteRecipes = await favouriteRecipeModel.find({ userId });

        const updatedRecipe = await combineRecipeReview(recipe, reviews, favouriteRecipes);

        // upadate recommended recipe
        const updateRecommendedRecipe = await recommendedRecipeModel.updateOne(
            { $or: [{ deviceId: deviceId }, { userId: userId }] },
            {
                $set: { deviceId, userId, categoryId: recipe.categoryId._id, cuisinesId: recipe.cuisinesId._id }
            },
            { upsert: true }
        );

        // Check if the recipe is not found
        if (!updatedRecipe) {

            return res.json({ data: { success: 0, message: "Recipe Not Found", recipe: updatedRecipe, error: 1 } });
        }
        else {
            return res.json({ data: { success: 1, message: "Recipe Found", recipe: updatedRecipe, error: 0 } });
        }

    } catch (error) {
        console.log("Error during get recipe by id:", error.message);
        return res.status(500).json({ data: { success: 0, message: "An error occurred", error: 1 } });
    }
}

//get recipe by category id
const GetRecipeByCategoryId = async (req, res) => {

    try {

        // Extract data from the request
        const userId = req.body.userId || undefined;
        const categoryId = req.body.categoryId;

        // fetch all recipe
        const recipe = await recipeModel.find({ categoryId: categoryId, status: "Publish" }, { status: 0 })
            .populate("categoryId cuisinesId", "_id name");

        // fetch all review
        const review = await reviewModel.find().populate({ path: 'userId', select: 'firstname lastname email -_id' });

        // fetch all favourite recipe
        const favouriteRecipe = await favouriteRecipeModel.find({ userId });

        const updatedRecipe = await combineRecipeReview(recipe, review, favouriteRecipe);

        // Check if the recipe is not found
        if (!updatedRecipe.length) {
            return res.json({ data: { success: 0, message: "Recipe Not Found", recipe: updatedRecipe, error: 1 } });
        }
        else {
            return res.json({ data: { success: 1, message: "Recipe Found", recipe: updatedRecipe, error: 0 } });
        }

    } catch (error) {
        console.log("Error during get recipe by category id:", error.message);
        return res.status(500).json({ data: { success: 0, message: "An error occurred", error: 1 } });
    }
}

//Filter Recipe
const FilterRecipe = async (req, res) => {

    try {

        // Extracting data from the request body
        const userId = req.body.userId || undefined;
        const category = req.body.categoryId;
        const cuisines = req.body.cuisinesId;

        // fetch all recipe
        const recipe = await recipeModel.find({ status: "Publish" }, { status: 0 }).populate("categoryId cuisinesId", "_id name");

        //  fetch all review
        const review = await reviewModel.find().populate({ path: 'userId', select: 'firstname lastname email -_id' });

        // fetch all favourite recipe
        const favouriteRecipe = await favouriteRecipeModel.find({ userId });

        const updatedRecipe = await combineRecipeReview(recipe, review, favouriteRecipe);

        //filter recipe
        function filterRecipes(recipes, filters) {

            const { category, cuisines } = filters;

            return recipes.filter(recipe => {

                // Check category
                if (category && recipe.categoryId._id != category) {
                    return false;
                }

                // Check cuisines
                if (cuisines && cuisines.length > 0) {
                    // Check if the recipe's cuisine ID is one of the specified cuisines
                    if (!cuisines.includes(recipe.cuisinesId._id.toString())) {
                        return false;
                    }
                }

                // All filters passed
                return true;
            });
        }

        const filteredRecipes = filterRecipes(updatedRecipe, { category, cuisines });

        if (!filteredRecipes || !filteredRecipes.length) {

            return res.json({ data: { success: 0, message: "Recipe Not Found", filteredRecipes: filteredRecipes, error: 1 } });
        }
        else {

            return res.json({ data: { success: 1, message: "Recipe Found", filteredRecipes: filteredRecipes, error: 0 } });
        }

    } catch (error) {
        console.log("Error during  filter recipe:", error.message);
        return res.status(500).json({ data: { success: 0, message: "An error occurred", error: 1 } });
    }
}

//search recipes
const SearchRecipes = async (req, res) => {

    try {

        // Extracting data from the request body
        const userId = req.body.userId || undefined;
        const recipeName = req.body.recipeName.replace(/\s+/g, '').toLowerCase();

        // fetch all recipe
        const recipe = await recipeModel.find({ status: "Publish" }, { status: 0 }).populate("categoryId cuisinesId", "_id name");

        // fetch all review
        const review = await reviewModel.find().populate({ path: 'userId', select: 'firstname lastname email -_id' });

        //  fetch favourite recipe  particular user id
        const favouriteRecipe = await favouriteRecipeModel.find({ userId });

        const updatedRecipe = await combineRecipeReview(recipe, review, favouriteRecipe);

        const searchRecipes = updatedRecipe.filter((recipe) => {
            // Remove spaces and convert to lowercase for comparison
            const formattedRecipeName = recipe.name.replace(/\s+/g, '').toLowerCase();

            return recipeName ? formattedRecipeName.includes(recipeName) : true;
        });

        if (!searchRecipes.length) {

            return res.json({ data: { success: 0, message: "Recipe Not Found", recipe: searchRecipes, error: 1 } });

        } else {

            return res.json({ data: { success: 1, message: "Recipe Found", recipe: searchRecipes, error: 0 } });
        }

    } catch (error) {
        console.log("Error during search recipe:", error.message);
        return res.status(500).json({ data: { success: 0, message: "An error occurred", error: 1 } });
    }
};


//add favouritr recipe
const AddFavouriteRecipe = async (req, res) => {

    try {

        // Extracting data from the request body
        const userId = req.user._id;
        const recipeId = req.body.recipeId;

        const existingRecipe = await favouriteRecipeModel.findOne({ userId, recipeId });

        if (!existingRecipe) {

            // save favourite recipe
            const newfavouriteRecipe = await new favouriteRecipeModel({ userId, recipeId }).save();

            return res.json({ data: { success: 1, message: "Favorite recipe added successfully", error: 0 } });

        } else {

            return res.json({ data: { success: 0, message: "Recipe is already a favorite for this user", error: 1 } });
        }

    } catch (error) {
        console.log("Error during add favourite recipe:", error.message);
        return res.status(500).json({ data: { success: 0, message: "An error occurred", error: 1 } });
    }
}

//get all favourite recipe
const GetAllFavouriteRecipes = async (req, res) => {

    try {

        // Extracting data from the request body
        const userId = req.user;

        // fetch recipe
        const recipe = await recipeModel.find().populate("categoryId cuisinesId");

        // fetch review
        const review = await reviewModel.find().populate({ path: 'userId', select: 'firstname lastname email -_id' });

        // fetch all favourite recipe
        const favouriteRecipe = await favouriteRecipeModel.find({ userId });

        const updatedRecipe = await combineRecipeReview(recipe, review, favouriteRecipe);

        const favouriteRecipes = updatedRecipe.filter((item) => {
            return item.isFavourite === true
        })

        // Check if the favourite recipe is not found
        if (!favouriteRecipes || !favouriteRecipes.length) {

            return res.json({ data: { success: 0, message: "Favourite Recipe Not Found", favouriteRecipe: favouriteRecipes, error: 1 } });
        }
        else {

            return res.json({ data: { success: 1, message: "Favourite Recipe Found", favouriteRecipe: favouriteRecipes, error: 0 } });
        }

    } catch (error) {
        console.log("Error during get all favourite recipes:", error.message);
        return res.status(500).json({ data: { success: 0, message: "An error occurred", error: 1 } });
    }
}

//delete favourite recipe
const DeleteFavouriteRecipe = async (req, res) => {

    try {

        // Extracting data from the request body
        const userId = req.user;
        const recipeId = req.body.recipeId;

        // delete favourite recipe
        const deletedFavouriteRecipe = await favouriteRecipeModel.deleteOne({ userId, recipeId });

        return res.json({ data: { success: 1, message: "Favorite recipe deleted successfully", error: 0 } });

    } catch (error) {
        console.log("Error during delete favourite recipe:", error.message);
        return res.status(500).json({ data: { success: 0, message: "An error occurred", error: 1 } });
    }
}

//add review
const AddReview = async (req, res) => {

    try {

        // Extracting data from the request body
        const userId = req.user;
        const recipeId = req.body.recipeId;
        const rating = req.body.rating;
        const comment = req.body.comment

        // Check if a review with the same comment already exists
        const existingReview = await reviewModel.findOne({ userId, recipeId, comment });

        if (existingReview) {
            // A review with the same comment already exists
            return res.json({ data: { success: 0, message: "Review not added successfully. Duplicate comment.", error: 1 } });
        }

        //save review
        const addNewReview = await new reviewModel({ userId, recipeId, rating, comment }).save();

        if (!addNewReview) {

            return res.json({ data: { success: 0, message: "Review not added successfully", error: 1 } });

        } else {

            return res.json({ data: { success: 1, message: "Review added successfully", error: 0 } });
        }

    } catch (error) {
        console.log("Error during add review:", error.message);
        return res.status(500).json({ data: { success: 0, message: error.message, error: 1 } });
    }
}

//Get Review By RecipeId
const GetReviewByRecipeId = async (req, res) => {

    try {

        // Extracting data from the request body
        const recipeId = req.body.recipeId;

        // fetch review particular recipe id
        const review = await reviewModel.find({ recipeId });

        if (!review || !review.length) {

            return res.json({ data: { success: 0, message: "Favourite Recipe Not Found", review: review, error: 1 } });
        }
        else {
            return res.json({ data: { success: 1, message: "Favourite Recipe Found", review: review, error: 0 } });
        }

    } catch (error) {
        console.log("Error during Get Review By RecipeId:", error.message);
        return res.status(500).json({ data: { success: 0, message: "An error occurred", error: 1 } });
    }
}

// get all faq
const getAllFaq = async (req, res) => {

    try {

        // fetch all faq
        const faq = await faqModel.find({ status: "Publish" }, { status: 0 });

        if (!faq.length) return res.json({ data: { success: 0, message: "FAQ Not Found", faq: faq, error: 1 } });

        return res.json({ data: { success: 1, message: "FAQ Found", faq: faq, error: 0 } });

    } catch (error) {
        console.log("Error during get all faq", error.message);
        return res.status(500).json({ data: { success: 0, message: "An error occured", error: 1 } });
    }
}

// get admob
const getAdmob = async (req, res) => {

    try {

        const ads = await adsModel.findOne();

        const adsData = {
            "andriod": {
                android_is_enable: ads.android_is_enable,
                android_app_ad_id: ads.android_app_ad_id,
                android_banner_ad_id_is_enable: ads.android_banner_ad_id_is_enable,
                android_banner_ad_id: ads.android_banner_ad_id,
                android_interstitial_ad_id_is_enable: ads.android_interstitial_ad_id_is_enable,
                android_interstitial_ad_id: ads.android_interstitial_ad_id,
                android_rewarded_ads_is_enable: ads.android_rewarded_ads_is_enable,
                android_rewarded_ads: ads.android_rewarded_ads
            },
            "ios": {
                ios_is_enable: ads.ios_is_enable,
                ios_app_ad_id: ads.ios_app_ad_id,
                ios_banner_ad_id_is_enable: ads.ios_banner_ad_id_is_enable,
                ios_banner_ad_id: ads.ios_banner_ad_id,
                ios_interstitial_ad_id_is_enable: ads.ios_interstitial_ad_id_is_enable,
                ios_interstitial_ad_id: ads.ios_interstitial_ad_id,
                ios_rewarded_ads_is_enable: ads.ios_rewarded_ads_is_enable,
                ios_rewarded_ads: ads.ios_rewarded_ads
            }
        }

        if (!ads) {

            return res.json({ data: { success: 0, message: "Ads Not Found", ads: ads, error: 1 } });
        }
        else {
            return res.json({ data: { success: 1, message: "Ads Found", ads: adsData, error: 0 } });
        }

    } catch (error) {
        console.log("Error during get admob", error.message);
        return res.status(500).json({ data: { success: 0, message: "An error occured", error: 1 } });
    }
}

// get private policy
const GetPolicyAndTerms = async (req, res) => {

    try {

        const settingData = await settingModel.find();

        if (!settingData || !settingData.length) return res.json({ data: { success: 0, message: "Not Found", setting: settingData, error: 1 } });

        return res.json({ data: { success: 1, message: "Found", setting: settingData, error: 0 } });

    } catch (error) {
        console.log("Error during get private policy:", error.message);
        return res.status(500).json({ data: { success: 0, message: "An error occurred", error: 1 } });
    }
}

//get all notification
const GetAllNotification = async (req, res) => {

    try {

        // fetch all notification
        const notification = await notificationModel.find().sort({ createdAt: -1 });

        if (!notification.length)
            return res.json({ data: { success: 0, message: "Recipe Notification Not Found", notification: notification, error: 1 } });

        return res.json({ data: { success: 1, message: "Recipe Notification Found", notification: notification, error: 0 } });

    } catch (error) {
        console.log("Error during get all notification:", error.message);
        return res.status(500).json({ data: { success: 0, message: "An error occurred", error: 1 } });
    }
}

module.exports = {

    CheckRegisterUser,
    SignUp,
    VerifyOtp,
    SignIn,
    isVerifyAccount,
    resendOtp,
    ForgotPassword,
    ForgotPasswordVerification,
    ResetPassword,
    ChangePassword,
    DeleteAccountUser,
    UserEdit,
    GetUser,
    UploadImage,
    getAllIntro,
    GetAllCategory,
    GetAllCuisines,
    GetAllRecipe,
    popularRecipe,
    recommendedRecipe,
    GetRecipeById,
    GetRecipeByCategoryId,
    FilterRecipe,
    SearchRecipes,
    AddFavouriteRecipe,
    GetAllFavouriteRecipes,
    DeleteFavouriteRecipe,
    AddReview,
    GetReviewByRecipeId,
    getAllFaq,
    getAdmob,
    GetPolicyAndTerms,
    GetAllNotification

}

