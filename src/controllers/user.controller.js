import { asyncHandler } from "../utils/asyncHandler.js";
// A wrapper that catches any errors in async functions and passes them to Express's next() 
// automatically — so you don't need try/catch everywhere.
import {ApiError} from "../utils/ApiError.js"
// A custom error class to send structured error responses with a status code and message.
import { User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
 
 
const registerUser = asyncHandler( async (req, res) => {
      console.log("=== DEBUG ===")
    // console.log("body:", req.body)
    // console.log("files:", req.files)
    console.log("content-type:", req.headers['content-type'])
    console.log("=============")

    const {fullName, email, username, password } = req.body

    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }
// Puts all fields in an array and checks if any of them are empty
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }

     const avatarLocalPath = req.files?.avatar?.[0]?.path;

    const coverImageLocalPath = req.files?.coverImage?.[0]?.path; //or
    
    //     let coverImageLocalPath;
    // if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
    //     coverImageLocalPath = req.files.coverImage[0].path
    // }
  
    // .path gives the local file path where multer saved it e.g. public/temp/pranav.png

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }
   
//  create user in database with avatar and coverImage url from cloudinary
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email, 
        password,
        username: username.toLowerCase()
    })

// Before saving, mongoose automatically runs the pre("save") hook which hashes the
//  password using bcrypt

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )

} )

// Validate inputs → Check duplicates → Save files locally → Upload to Cloudinary 
// → Save user to MongoDB → Return user data ✅

export {registerUser}
