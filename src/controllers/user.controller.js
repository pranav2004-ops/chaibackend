import { asyncHandler } from "../utils/asyncHandler.js";
// A wrapper that catches any errors in async functions and passes them to Express's next() 
// automatically — so you don't need try/catch everywhere.
import {ApiError} from "../utils/ApiError.js"
// A custom error class to send structured error responses with a status code and message.
import { User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
 
 
const registerUser = asyncHandler( async (req, res) => {
    //   console.log("=== DEBUG ===")
    // console.log("body:", req.body)
    // console.log("files:", req.files)
    // console.log("content-type:", req.headers['content-type'])
    // console.log("=============")

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

/* Complete Data Flow — Registration
// export {registerUser}
// POSTMAN
// sends:
//   fullName, email, username, password (in body)
//   avatar, coverImage (as files)
//         ↓
// ROUTE (user.routes.js)
//   receives the request
//   runs multer middleware first
//         ↓
// MULTER MIDDLEWARE
//   takes avatar and coverImage files
//   saves them temporarily to public/temp/
//   puts file info into req.files
//         ↓
// CONTROLLER (user.controller.js)
//   reads text fields from req.body
//   reads file paths from req.files
//   validates everything
//   uploads files to Cloudinary
//   gets back Cloudinary URLs
//         ↓
// MODEL (user.model.js)
//   User.create() is called with all data
//   pre("save") hook runs → hashes password
//   validates against schema (required fields etc)
//         ↓
// MONGODB
//   stores the final document like this:
//   {
//     _id: ObjectId("..."),
//     fullName: "chai aur code",
//     email: "test@test.com",
//     username: "testuser",
//     password: "$2b$10$hashedpassword...",
//     avatar: "https://res.cloudinary.com/...",
//     coverImage: "https://res.cloudinary.com/...",
//     watchHistory: [],
//     createdAt: "2024-...",
//     updatedAt: "2024-..."
//   }
//         ↓
// CONTROLLER (again)
//   fetches created user back WITHOUT password
//   sends response back to Postman
//         ↓
// POSTMAN
//   receives success response with user data
*/


export {registerUser}

/*req.body contains the text fields sent from Postman/frontend
Destructures fullName, email, username, password out of it
Files like avatar and coverImage come from req.files, not req.body
Puts all fields in an array and checks if any of them are empty
field?.trim() removes whitespace — so "  " (spaces only) also counts as empty
!field?.trim() returns true if field is undefined, null, or empty string
If any field is empty → throws 400 Bad Request error
User.findOne() searches MongoDB for a user matching either username OR email
$or is a MongoDB operator — returns a match if ANY condition is true
If a user is found → throws 409 Conflict error
This prevents duplicate accounts
req.files is populated by multer middleware with uploaded files
avatar and coverImage are arrays (because of upload.fields()) so we need [0]
.path gives the local file path where multer saved it e.g. public/temp/pranav.png
?. optional chaining prevents crashes if any value is undefined
Avatar is mandatory — if not provided → throws 400 error
coverImage is optional so no check for it
Uploads both files to Cloudinary using the local temp path
Cloudinary returns a response object containing the hosted image URL
If avatar upload fails → uploadOnCloudinary returns null → throws 400 error
coverImage can be undefined — uploadOnCloudinary handles that gracefully by returning null
Creates a new user document in MongoDB
avatar.url — Cloudinary URL of the uploaded avatar image
coverImage?.url || "" — Cloudinary URL if uploaded, otherwise empty string
username.toLowerCase() — stores username in lowercase always
Before saving, mongoose automatically runs the pre("save") hook which hashes the password using bcrypt
Fetches the newly created user back from MongoDB
.select("-password -refreshToken") excludes password and refreshToken from the result
The - means exclude this field
This ensures we never send sensitive data back to the client\
If somehow the user wasn't found after creation → throws 500 Internal Server Error
res.status(201) — 201 means Created (correct HTTP code for new resource)
new ApiResponse(200, createdUser, "User registered Successfully") — sends back the user data with a success message in a consistent format
*/

