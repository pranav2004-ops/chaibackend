import { asyncHandler } from "../utils/asyncHandler.js";
// A wrapper that catches any errors in async functions and passes them to Express's next() 
// automatically — so you don't need try/catch everywhere.
import {ApiError} from "../utils/ApiError.js"
// A custom error class to send structured error responses with a status code and message.
import { User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";
 
 const generateAccessAndRefereshTokens = async(userId) =>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}

// access token user ko de dete hai but refresh token database me store kar dete hai taki jab access token expire ho jaye to refresh token se naya access token generate kar sake without asking user to login again.
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}
 
const registerUser = asyncHandler( async (req, res) => {

    //   // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res

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

const loginUser = asyncHandler(async (req, res) =>{
    // req body -> data
    // username or email
    //find the user
    //password check
    //access and referesh token
    //send cookie

    const {email, username, password} = req.body
    console.log(email);

    if (!username && !email) {
        throw new ApiError(400, "username or email is required")
    }
    
    // Here is an alternative of above code based on logic discussed in video:
    // if (!(username || email)) {
    //     throw new ApiError(400, "username or email is required")
        
    // }

    // database dusre continent me hota hai issliye awit lagta hai
    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if (!user) {
        throw new ApiError(404, "User does not exist")
    }

   const isPasswordValid = await user.isPasswordCorrect(password)

   if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials")
    }

   const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )

})

const logoutUser = asyncHandler(async(req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // this removes the field from document
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))
})

// When accessToken expires → user sends refreshToken → server verifies + matches with DB → generates brand new pair of tokens → user stays logged in without re-entering password 🔄🔐
const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
            
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken} = await generateAccessAndRefereshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200, 
                {accessToken, refreshToken: newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }

})
 
const changeCurrentPassword = asyncHandler(async(req, res) => {
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))
})

const getCurrentUser = asyncHandler(async(req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(
        200,
        req.user,
        "User fetched successfully"
    ))
})

const updateAccountDetails = asyncHandler(async(req, res) => {
    const {fullName, email} = req.body

    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName: fullName,
                email: email
            }
        },
        {new: true}
        
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
});

const updateUserAvatar = asyncHandler(async(req, res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }

    //TODO: delete old image - assignment

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading on avatar")
        
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Avatar image updated successfully")
    )
})

const updateUserCoverImage = asyncHandler(async(req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image file is missing")
    }

    //TODO: delete old image - assignment


    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading on avatar")
        
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Cover image updated successfully")
    )
})

const getUserChannelProfile = asyncHandler(async(req, res) => {

    const {username} = req.params  //req.params is used to get values from the URL itself
// Example URL:
// http://localhost:8000/api/v1/users/profile/john
//                                             ↑
//                                       this is the param

    if (!username?.trim()) {
        throw new ApiError(400, "username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1

            }
        }
    ])

    if (!channel?.length) {
        throw new ApiError(404, "channel does not exists")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )
})

const getWatchHistory = asyncHandler(async(req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetched successfully"
        )
    )
})

export {registerUser,loginUser, logoutUser,refreshAccessToken,changeCurrentPassword,
    getCurrentUser,updateAccountDetails,updateUserAvatar,updateUserCoverImage,getUserChannelProfile,getWatchHistory}


// Validate inputs → Check duplicates → Save files locally → Upload to Cloudinary 
// → Save user to MongoDB → Return user data ✅
// Complete Data Flow — Registration
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


/*  Register 
req.body contains the text fields sent from Postman/frontend
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


/* login
// ╔══════════════════════════════════════════════════════════════════╗
// ║           GENERATE TOKENS + LOGIN USER — FULL EXPLANATION        ║
// ╚══════════════════════════════════════════════════════════════════╝

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PART 1 — generateAccessAndRefreshTokens(userId)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// const generateAccessAndRefereshTokens = async(userId) => {

//   → This is an async utility function (NOT a route)
//   → It takes userId as input to find the user in DB

//   try {

//     const user = await User.findById(userId)
//     → Finds the user in MongoDB using their _id

//     const accessToken = user.generateAccessToken()
//     → Calls a METHOD defined on the User model (in user.model.js)
//     → Generates a short-lived JWT (e.g. expires in 15 mins)

//     const refreshToken = user.generateRefreshToken()
//     → Also a method on User model
//     → Generates a long-lived JWT (e.g. expires in 7 days)

//     user.refreshToken = refreshToken
//     → Stores the refreshToken INTO the user object (in memory)

//     await user.save({ validateBeforeSave: false })
//     → Saves user back to DB with the refreshToken field updated
//     → validateBeforeSave: false → skips all other validations
//       (like required fields check) so it only saves the token

//     return { accessToken, refreshToken }
//     → Returns BOTH tokens to whoever called this function

//   } catch (error) {
//     throw new ApiError(500, "Something went wrong...")
//     → If anything fails, throws a 500 server error
//   }
// }

//   WHY TWO TOKENS?
//   ┌─────────────────┬────────────────────────────────────────┐
//   │  accessToken    │ Given to user, short life (15 min)     │
//   │                 │ Used to access protected routes        │
//   ├─────────────────┼────────────────────────────────────────┤
//   │  refreshToken   │ Stored in DB + sent as cookie          │
//   │                 │ Used to generate new accessToken       │
//   │                 │ without asking user to login again     │
//   └─────────────────┴────────────────────────────────────────┘

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PART 2 — loginUser (actual route handler)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// const loginUser = asyncHandler(async (req, res) => {

//   → Wrapped in asyncHandler so errors are auto-caught (no try/catch needed)

//   STEP 1 — Extract data from request body
//   ─────────────────────────────────────────
//   const { email, username, password } = req.body
//   → Destructures the 3 fields from what frontend sent

//   STEP 2 — Validate input
//   ─────────────────────────────────────────
//   if (!username && !email)
//     throw new ApiError(400, "username or email is required")

//   → If BOTH are missing → throw error
//   → User must provide at least one (username OR email)

//   NOTE: if (!(username || email)) means the same thing logically

//   STEP 3 — Find user in Database
//   ─────────────────────────────────────────
//   const user = await User.findOne({
//     $or: [{ username }, { email }]
//   })

//   → $or is a MongoDB operator — searches by username OR email
//   → await because DB is on a different server (takes time)

//   if (!user) throw new ApiError(404, "User does not exist")
//   → If no user found → 404 error

//   STEP 4 — Check Password
//   ─────────────────────────────────────────
//   const isPasswordValid = await user.isPasswordCorrect(password)

//   → isPasswordCorrect() is a custom method on User model
//   → Internally uses bcrypt to compare entered password with hashed one in DB
//   → Returns true or false

//   if (!isPasswordValid) throw new ApiError(401, "Invalid user credentials")
//   → Wrong password → 401 Unauthorized error

//   STEP 5 — Generate Tokens
//   ─────────────────────────────────────────
//   const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(user._id)

//   → Calls PART 1 function with the user's _id
//   → Gets back both tokens

//   STEP 6 — Fetch clean user data (without sensitive fields)
//   ─────────────────────────────────────────
//   const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

//   → Fetches user again from DB
//   → .select("-password -refreshToken") → EXCLUDES password and refreshToken
//   → This is the safe user object to send in response

//   STEP 7 — Cookie options
//   ─────────────────────────────────────────
//   const options = {
//     httpOnly: true,   → Cookie cannot be accessed by JavaScript (XSS protection)
//     secure: true      → Cookie only sent over HTTPS
//   }

//   → These two options make cookies safe and tamper-proof from frontend

//   STEP 8 — Send Response
//   ─────────────────────────────────────────
//   return res
//     .status(200)                                  → HTTP 200 = Success
//     .cookie("accessToken", accessToken, options)  → Sets accessToken as cookie
//     .cookie("refreshToken", refreshToken, options)→ Sets refreshToken as cookie
//     .json(
//       new ApiResponse(200, {
//         user: loggedInUser,  → clean user object
//         accessToken,         → also sent in body (for mobile apps that can't use cookies)
//         refreshToken         → same reason
//       },
//       "User logged In Successfully")
//     )
// })

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FULL LOGIN FLOW SUMMARY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

//   Frontend sends { username/email, password }
//             ↓
//   Validate → username or email must exist
//             ↓
//   Find user in DB by username OR email ($or)
//             ↓
//   Compare password using bcrypt
//             ↓
//   Generate accessToken (short) + refreshToken (long)
//             ↓
//   Save refreshToken in DB
//             ↓
//   Send both tokens as secure cookies + in JSON body
//             ↓
//   User is now LOGGED IN ✅  */

/*logout
This is the Logout Route Handler — it does 2 things to log a user out:
Removes refreshToken from Database
Clears cookies from Browser
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FUNCTION DEFINITION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const logoutUser = asyncHandler(async(req, res) => {

  → asyncHandler   = auto catches any async errors
  → req            = request object (contains req.user from verifyJWT)
  → res            = response object (used to clear cookies)
  → NO next needed here because this is the final step


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — REMOVE REFRESH TOKEN FROM DATABASE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  await User.findByIdAndUpdate(

  → findByIdAndUpdate() finds a user by ID and updates them
  → await because it is a DB operation (takes time)


  ARGUMENT 1 — WHO to update
  ─────────────────────────────────────
    req.user._id

    → req.user was attached by verifyJWT middleware earlier
    → So we already know WHO is logged in
    → We use their _id to find them in DB


  ARGUMENT 2 — WHAT to update
  ─────────────────────────────────────
    {
      $unset: {
        refreshToken: 1
      }
    }

    → $unset is a MongoDB operator
    → It REMOVES a field from the document completely
    → refreshToken: 1 means "remove this field"
    → After this, the user document has NO refreshToken field
    → So even if someone has an old refreshToken, it is now useless


  WHY NOT SET IT TO NULL?
  ─────────────────────────────────────
    // Bad way ❌
    { $set: { refreshToken: null } }
    → Field still exists, just empty

    // Good way ✅
    { $unset: { refreshToken: 1 } }
    → Field is completely DELETED from document
    → Cleaner and more secure


  ARGUMENT 3 — OPTIONS
  ─────────────────────────────────────
    {
      new: true
    }

    → new: true means return the UPDATED document
    → Without this, MongoDB returns the OLD document (before update)
    → Here we don't use the return value but it's good practice


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — COOKIE OPTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const options = {
    httpOnly: true,   → cookie not accessible by JavaScript
    secure: true      → only sent over HTTPS
  }

  → Same options used during login
  → Must match the original cookie settings to clear properly


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — CLEAR COOKIES AND SEND RESPONSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return res
    .status(200)
    → HTTP 200 = Success

    .clearCookie("accessToken", options)
    → Deletes the accessToken cookie from browser

    .clearCookie("refreshToken", options)
    → Deletes the refreshToken cookie from browser

    .json(new ApiResponse(200, {}, "User logged Out"))
    → Sends back a JSON response
    → {} means empty data object (nothing to return after logout)
    → "User logged Out" is the success message


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW THIS ROUTE IS PROTECTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  router.post("/logout", verifyJWT, logoutUser)
                          ↑             ↑
                    runs FIRST      runs SECOND
                  checks token    does actual logout

  → verifyJWT runs first and attaches req.user
  → Without verifyJWT, req.user would be undefined
  → logoutUser then uses req.user._id to find and update the user

  ONLY clearing cookies ❌
  ──────────────────────────────────────────
  → Browser cookie is gone ✅
  → But refreshToken still in DB ❌
  → Hacker who stole the token can still use it
  → Not fully secure

  ONLY removing from DB ❌
  ──────────────────────────────────────────
  → DB is clean ✅
  → But cookie still in browser ❌
  → Browser keeps sending the old token
  → Not fully logged out

  BOTH together ✅
  ──────────────────────────────────────────
  → Cookie deleted from browser ✅
  → RefreshToken deleted from DB ✅
  → Old tokens are now completely useless
  → User is fully and securely logged out ✅   */

  /*Full Logout Flow Summary
//Logout request comes in
//         ↓
// verifyJWT middleware checks token → attaches req.user
//         ↓
// findByIdAndUpdate → removes refreshToken from DB
//         ↓
// clearCookie → removes accessToken from browser
//         ↓
// clearCookie → removes refreshToken from browser
//         ↓
// 200 response → "User logged Out" ✅ */

/* refreshAccessToken
This route generates a new accessToken when the old one expires — without asking the user to login again.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — GET INCOMING REFRESH TOKEN (from 2 places)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const incomingRefreshToken = req.cookies.refreshToken 
                             || req.body.refreshToken

  SOURCE 1 → req.cookies.refreshToken
  ─────────────────────────────────────
  → Web browsers send it automatically via cookie

  SOURCE 2 → req.body.refreshToken
  ─────────────────────────────────────
  → Mobile apps send it manually in request body

  if (!incomingRefreshToken) {
    throw new ApiError(401, "unauthorized request")
  }
  → If token not found in EITHER place → block request immediately


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — VERIFY & DECODE THE INCOMING TOKEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
  )

  → jwt.verify() checks if token is VALID and NOT EXPIRED
  → Uses REFRESH_TOKEN_SECRET (different from ACCESS_TOKEN_SECRET)
  → If valid, returns decoded data like:
    {
      _id: "64abc123",
      iat: 1710000000,
      exp: 1710090000     ← refresh token has longer expiry (7-10 days)
    }

  NOTE — TWO DIFFERENT SECRETS
  ─────────────────────────────────────
  ACCESS_TOKEN_SECRET  →  used to sign/verify accessToken
  REFRESH_TOKEN_SECRET →  used to sign/verify refreshToken
  → Kept separate for extra security


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — FIND USER IN DATABASE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const user = await User.findById(decodedToken?._id)

  → Uses _id from decoded token to find user in MongoDB
  → ?. safe navigation — if decodedToken is null, don't crash

  if (!user) {
    throw new ApiError(401, "Invalid refresh token")
  }
  → User not found in DB → token is invalid → block ❌


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — MATCH INCOMING TOKEN WITH DB TOKEN (Most Important Step!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  if (incomingRefreshToken !== user?.refreshToken) {
    throw new ApiError(401, "Refresh token is expired or used")
  }

  → Compares the token USER sent  vs  token stored in DB
  → They MUST be exactly the same

  WHY THIS CHECK?
  ─────────────────────────────────────
  SCENARIO 1 — User already logged out
    → DB has no refreshToken (it was deleted on logout)
    → incomingRefreshToken !== null → mismatch → blocked ❌

  SCENARIO 2 — Hacker stole an old refreshToken
    → User already refreshed → DB has NEW refreshToken
    → Hacker sends OLD token → mismatch → blocked ❌

  SCENARIO 3 — Valid user sends correct token
    → incomingRefreshToken === user.refreshToken → match → allowed ✅


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — GENERATE NEW TOKENS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const {accessToken, newRefreshToken} = await generateAccessAndRefereshTokens(user._id)

  → Calls the same utility function from before
  → Generates BOTH a new accessToken AND a new refreshToken
  → New refreshToken is saved in DB (old one is replaced)
  → This is called REFRESH TOKEN ROTATION (more secure)

  REFRESH TOKEN ROTATION
  ─────────────────────────────────────
  → Every time you refresh → you get a BRAND NEW refreshToken
  → Old refreshToken becomes invalid immediately
  → So even if hacker had the old one → useless now ✅


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — SEND NEW TOKENS TO USER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    → Sets new accessToken in browser cookie

    .cookie("refreshToken", newRefreshToken, options)
    → Sets new refreshToken in browser cookie
    → OLD refreshToken cookie is now OVERWRITTEN

    .json(
      new ApiResponse(200,
        { accessToken, refreshToken: newRefreshToken },
        "Access token refreshed"
      )
    )
    → Also sends in body for mobile apps


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CATCH BLOCK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token")
  }

  → Catches ALL errors (expired token, tampered token etc.)
  → Returns clean 401 error response */

/*refreshAccessToken
accessToken expires (after 15 mins)
          ↓
Frontend sends refreshToken to this route
          ↓
Is refreshToken present?          NO  → 401 ❌
          ↓ YES
jwt.verify() — is token valid?    NO  → 401 ❌
          ↓ YES
Find user in DB                   NOT FOUND → 401 ❌
          ↓ FOUND
Does token match DB token?        NO  → 401 ❌
          ↓ YES
Generate NEW accessToken + NEW refreshToken
          ↓
Save new refreshToken in DB (old one replaced)
          ↓
Send both new tokens to user ✅
          ↓
User continues without logging in again ✅ */

/* updateAccountDetails
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — GET DATA FROM REQUEST BODY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const { fullName, email } = req.body

  → User sends new fullName and email from frontend
  → req.body contains the JSON data sent by user


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — VALIDATE FIELDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  if (!fullName || !email) {
      throw new ApiError(400, "All fields are required")
  }

  → checks if BOTH fields are provided
  → if either one is missing → throw 400 error ❌

  CASES THAT FAIL:
  ─────────────────────────────────────
  { fullName: "John" }              → email missing   ❌
  { email: "john@test.com" }        → fullName missing ❌
  {}                                → both missing    ❌

  CASE THAT PASSES:
  ─────────────────────────────────────
  { fullName: "John", email: "john@test.com" }        ✅


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — FIND AND UPDATE USER IN DATABASE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const user = await User.findByIdAndUpdate(

  ARGUMENT 1 — WHO to update
  ─────────────────────────────────────
    req.user?._id
    → logged in user's id
    → attached by verifyJWT middleware
    → ?. safe navigation — dont crash if null


  ARGUMENT 2 — WHAT to update
  ─────────────────────────────────────
    {
      $set: {
        fullName: fullName,
        email: email
      }
    }

    → $set is MongoDB operator
    → ONLY updates the fields mentioned
    → ALL other fields stay UNTOUCHED

    DIFFERENCE BETWEEN $set AND without $set:
    ──────────────────────────────────────────
    WITHOUT $set ❌
    → replaces the ENTIRE document
    → all other fields like avatar, password get DELETED

    WITH $set ✅
    → only updates fullName and email
    → everything else stays as it is


  ARGUMENT 3 — OPTIONS
  ─────────────────────────────────────
    { new: true }

    → returns the UPDATED document
    → without this → returns OLD document before update
    → we need new: true to send updated data back to user


  .select("-password")
  ─────────────────────────────────────
  → removes password field from result
  → never send password back to frontend


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — SEND RESPONSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))

  → 200 = success
  → user = updated user object (without password)
  → "Account details updated successfully" = message   */


/*      getUserChannelProfile — COMPLETE FLOW (Frontend to Backend) 

 TWO USERS INVOLVED:                                         ║
║  ───────────────────                                         ║
║  1. "john"  → the CHANNEL being viewed (from URL)            ║
║  2. Alice   → the VIEWER who is logged in (from token)       ║
║                                                           
 
/*
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DATABASE STRUCTURE — DATA THAT ALREADY EXISTS BEFORE THIS REQUEST
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ╔══════════════════════════════════════════════════════════════╗
// ║                    COLLECTION 1: users                       ║
// ╠══════════════════════════════════════════════════════════════╣
// ║                                                              ║
// ║  Document 1 (John - the channel we want to view):            ║
// ║  {                                                           ║
// ║      _id: "64abc123",          ← MongoDB auto-generated      ║
// ║      username: "john",         ← set during registration     ║
// ║      fullName: "John Doe",     ← set during registration     ║
// ║      email: "john@test.com",   ← set during registration     ║
// ║      password: "$2b$hashed",   ← bcrypt hashed password      ║
// ║      avatar: "https://cloud...",← uploaded during register    ║
// ║      coverImage: "https://...",← uploaded during register     ║
// ║      refreshToken: "eyJhb..."  ← set during login            ║
// ║  }                                                           ║
// ║                                                              ║
// ║  Document 2 (Alice - she is logged in right now):            ║
// ║  {                                                           ║
// ║      _id: "64xyz789",                                        ║
// ║      username: "alice",                                       ║
// ║      fullName: "Alice Smith",                                 ║
// ║      email: "alice@test.com",                                 ║
// ║      password: "$2b$hashed",                                  ║
// ║      avatar: "https://cloud...",                              ║
// ║      refreshToken: "eyJhb..."                                 ║
// ║  }                                                           ║
// ║                                                              ║
// ║  Document 3 (Bob):                                            ║
// ║  {                                                           ║
// ║      _id: "64def456",                                        ║
// ║      username: "bob",                                         ║
// ║      fullName: "Bob Wilson",                                  ║
// ║      ...                                                     ║
// ║  }                                                           ║
// ║                                                              ║
// ║  Document 4 (Charlie):                                        ║
// ║  {                                                           ║
// ║      _id: "64ghi012",                                        ║
// ║      username: "charlie",                                     ║
// ║      ...                                                     ║
// ║  }                                                           ║
// ║                                                              ║
// ╚══════════════════════════════════════════════════════════════╝


// ╔══════════════════════════════════════════════════════════════╗
// ║               COLLECTION 2: subscriptions                    ║
// ╠══════════════════════════════════════════════════════════════╣
// ║                                                              ║
// ║  Created when someone clicks "Subscribe" button              ║
// ║                                                              ║
// ║  Document 1: Alice subscribed to John's channel              ║
// ║  {                                                           ║
// ║      _id: "sub001",                                          ║
// ║      subscriber: "64xyz789",    ← Alice's _id                ║
// ║      channel:    "64abc123"     ← John's _id                 ║
// ║  }                                                           ║
// ║                                                              ║
// ║  Document 2: Bob subscribed to John's channel                ║
// ║  {                                                           ║
// ║      _id: "sub002",                                          ║
// ║      subscriber: "64def456",    ← Bob's _id                  ║
// ║      channel:    "64abc123"     ← John's _id                 ║
// ║  }                                                           ║
// ║                                                              ║
// ║  Document 3: Charlie subscribed to John's channel            ║
// ║  {                                                           ║
// ║      _id: "sub003",                                          ║
// ║      subscriber: "64ghi012",    ← Charlie's _id              ║
// ║      channel:    "64abc123"     ← John's _id                 ║
// ║  }                                                           ║
// ║                                                              ║
// ║  Document 4: John subscribed to Alice's channel              ║
// ║  {                                                           ║
// ║      _id: "sub004",                                          ║
// ║      subscriber: "64abc123",    ← John's _id                 ║
// ║      channel:    "64xyz789"     ← Alice's _id                ║
// ║  }                                                           ║
// ║                                                              ║
// ║  Document 5: John subscribed to Bob's channel                ║
// ║  {                                                           ║
// ║      _id: "sub005",                                          ║
// ║      subscriber: "64abc123",    ← John's _id                 ║
// ║      channel:    "64def456"     ← Bob's _id                  ║
// ║  }                                                           ║
// ║                                                              ║
// ╚══════════════════════════════════════════════════════════════╝
// */
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HOW DID THIS DATA GET INTO DATABASE?
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ╔══════════════════════════════════════════════════════════════╗
// ║         WHERE USER DATA CAME FROM (Registration)             ║
// ╠══════════════════════════════════════════════════════════════╣
// ║                                                              ║
// ║  STEP 1: John registered EARLIER (maybe days ago)            ║
// ║                                                              ║
// ║  POST /api/v1/users/register                                 ║
// ║  Body: {                                                     ║
// ║      fullName: "John Doe",                                   ║
// ║      username: "john",                                       ║
// ║      email: "john@test.com",                                 ║
// ║      password: "john123"                                     ║
// ║  }                                                           ║
// ║  Files: avatar.jpg, coverImage.jpg                           ║
// ║                                                              ║
// ║  What happened inside registerUser controller:               ║
// ║  ─────────────────────────────────────────────                ║
// ║  1. password "john123" → bcrypt → "$2b$10$hashed..."         ║
// ║  2. avatar.jpg → uploaded to Cloudinary → got URL            ║
// ║  3. coverImage.jpg → uploaded to Cloudinary → got URL        ║
// ║  4. User.create({                                            ║
// ║         fullName: "John Doe",                                ║
// ║         username: "john",                                    ║
// ║         email: "john@test.com",                              ║
// ║         password: "$2b$10$hashed...",                        ║
// ║         avatar: "https://res.cloudinary.com/avatar123",      ║
// ║         coverImage: "https://res.cloudinary.com/cover456"    ║
// ║     })                                                       ║
// ║  5. MongoDB automatically added _id: "64abc123"              ║
// ║                                                              ║
// ║  → Document saved in "users" collection ✅                   ║
// ║                                                              ║
// ╚══════════════════════════════════════════════════════════════╝


// ╔══════════════════════════════════════════════════════════════╗
// ║         WHERE TOKEN CAME FROM (Login)                        ║
// ╠══════════════════════════════════════════════════════════════╣
// ║                                                              ║
// ║  STEP 2: Alice logged in (she wants to view john's channel)  ║
// ║                                                              ║
// ║  POST /api/v1/users/login                                    ║
// ║  Body: {                                                     ║
// ║      email: "alice@test.com",                                ║
// ║      password: "alice123"                                    ║
// ║  }                                                           ║
// ║                                                              ║
// ║  What happened inside loginUser controller:                  ║
// ║  ─────────────────────────────────────────                    ║
// ║  1. Found Alice in DB by email                               ║
// ║  2. Compared password → matched ✅                           ║
// ║  3. Generated accessToken:                                   ║
// ║     jwt.sign(                                                ║
// ║         {                                                    ║
// ║             _id: "64xyz789",        ← Alice's _id            ║
// ║             email: "alice@test.com",                         ║
// ║             username: "alice",                               ║
// ║             fullName: "Alice Smith"                          ║
// ║         },                                                   ║
// ║         ACCESS_TOKEN_SECRET,                                 ║
// ║         { expiresIn: "1d" }                                  ║
// ║     )                                                        ║
// ║     → accessToken = "eyJhbGciOiJI..."                        ║
// ║                                                              ║
// ║  4. Generated refreshToken similarly                         ║
// ║  5. Saved refreshToken in Alice's DB document                ║
// ║  6. Sent BOTH tokens to frontend                             ║
// ║                                                              ║
// ║  Response:                                                   ║
// ║  {                                                           ║
// ║      data: {                                                 ║
// ║          user: { _id, username, email... },                  ║
// ║          accessToken: "eyJhbGciOiJI...",  ← THIS TOKEN       ║
// ║          refreshToken: "eyJhbGciOiJS..."                     ║
// ║      }                                                       ║
// ║  }                                                           ║
// ║  + cookies also set                                          ║
// ║                                                              ║
// ║  Frontend stores this accessToken                            ║
// ║  (in variable, localStorage, or cookie)                      ║
// ║                                                              ║
// ╚══════════════════════════════════════════════════════════════╝


// ╔══════════════════════════════════════════════════════════════╗
// ║      WHERE SUBSCRIPTION DATA CAME FROM                       ║
// ╠══════════════════════════════════════════════════════════════╣
// ║                                                              ║
// ║  STEP 3: Alice subscribed to John (maybe yesterday)          ║
// ║                                                              ║
// ║  When Alice clicked "Subscribe" on John's channel:           ║
// ║                                                              ║
// ║  POST /api/v1/subscriptions/toggle/:channelId                ║
// ║                                                              ║
// ║  What happened:                                              ║
// ║  1. Created new document in subscriptions collection:        ║
// ║     {                                                        ║
// ║         subscriber: "64xyz789",   ← Alice (who clicked)      ║
// ║         channel: "64abc123"       ← John (whose channel)     ║
// ║     }                                                        ║
// ║                                                              ║
// ║  Similarly:                                                  ║
// ║  • Bob subscribed to John → another document created         ║
// ║  • Charlie subscribed to John → another document created     ║
// ║  • John subscribed to Alice → another document created       ║
// ║  • John subscribed to Bob → another document created         ║
// ║                                                              ║
// ╚══════════════════════════════════════════════════════════════╝
// */


// /*
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STEP 1 — FRONTEND SENDS REQUEST
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ╔══════════════════════════════════════════════════════════════╗
// ║  Alice is on the website                                     ║
// ║  She clicks on "John's Channel" profile                      ║
// ║  Frontend makes this request:                                ║
 

//   OR IN POSTMAN:
//   ─────────────────────────────────────
//   METHOD  → GET
//   URL     → http://localhost:8000/api/v1/users/c/john
//                                                   ↑
//                                        actual username from DB
//   Headers → Authorization: Bearer <accessToken>
//   Body    → NONE ❌
// */


// // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// // STEP 2 — REQUEST HITS app.js
// // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// // app.js

// import express from "express"
// import cookieParser from "cookie-parser"
// import userRouter from "./routes/user.routes.js"

// const app = express()

// app.use(express.json())
// // parses JSON body → but GET has no body so nothing here

// app.use(cookieParser())
// // parses cookies from request
// // if Alice's browser sent cookie with accessToken,
// // it becomes available as req.cookies.accessToken

// app.use("/api/v1/users", userRouter)
// //      ↑
// //  INCOMING: GET /api/v1/users/c/john
// //  URL starts with /api/v1/users ✅ → forward to userRouter
// //  remaining URL: /c/john → sent to userRouter

// export default app


// // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// // STEP 3 — ROUTER MATCHES ROUTE (user.routes.js)
// // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// // user.routes.js

// import { Router } from "express"
// import { getUserChannelProfile } from "../controllers/user.controller.js"
// import { verifyJWT } from "../middlewares/auth.middleware.js"

// const router = Router()

// /*
//   Remaining URL: /c/john
//   Method: GET

//   Router checks all routes:

//   router.post("/register", ...)         → NO (POST, wrong path)
//   router.post("/login", ...)            → NO (POST, wrong path)
//   router.get("/c/:username", ...)       → YES ✅ matches!

//   :username is a ROUTE PARAMETER
//   ──────────────────────────────
//   Pattern:  /c/:username
//   Actual:   /c/john
//   Express maps: username = "john"
//   Stored in: req.params = { username: "john" }
// */

// router.get("/c/:username", verifyJWT, getUserChannelProfile)
// //              ↑              ↑               ↑
// //    :username is dynamic   runs 1st       runs 2nd
// //    /c/john → username     checks token   fetches channel
// //    = "john"

// // Now Express runs middlewares in ORDER:
// // 1st → verifyJWT (middleware)
// // 2nd → getUserChannelProfile (controller)

// export default router


// // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// // STEP 4 — verifyJWT MIDDLEWARE RUNS (auth.middleware.js)
// // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// // PURPOSE: check WHO is making this request
// //          (is Alice really logged in?)

// // auth.middleware.js

// import { asyncHandler } from "../utils/asyncHandler.js"
// import { ApiError } from "../utils/ApiError.js"
// import jwt from "jsonwebtoken"
// import { User } from "../models/user.model.js"

// export const verifyJWT = asyncHandler(async (req, _, next) => {

//     // ┌─────────────────────────────────────────────────────────┐
//     // │  PART A: GET THE TOKEN                                  │
//     // └─────────────────────────────────────────────────────────┘

//     const token = req.cookies?.accessToken
//     //                 ↑
//     //   Check 1: is token in cookies?
//     //   Browser automatically sends cookies with every request
//     //   cookieParser() in app.js made this available
//     //   If Alice logged in and cookie was set → found here

//                    || req.header("Authorization")?.replace("Bearer ", "")
//     //                       ↑
//     //   Check 2: is token in Authorization header?
//     //   Header value: "Bearer eyJhbGciOiJI..."
//     //   .replace("Bearer ", "") removes "Bearer " prefix
//     //   Result: "eyJhbGciOiJI..." (just the token)
//     //
//     //   WHY TWO CHECKS?
//     //   - Web browser → usually sends via cookies
//     //   - Mobile app → usually sends via header
//     //   - Postman → sends via header
//     //
//     //   If cookie has token → use that
//     //   If not → check header
//     //   If neither → token = undefined


//     // ┌─────────────────────────────────────────────────────────┐
//     // │  PART B: CHECK IF TOKEN EXISTS                          │
//     // └─────────────────────────────────────────────────────────┘

//     if (!token) {
//         throw new ApiError(401, "Unauthorized request")
//     }
//     //  No token means:
//     //  - User never logged in
//     //  - Token expired and was deleted
//     //  - Someone is trying to access without login
//     //  → BLOCK the request ❌ (401 sent back)
//     //
//     //  Alice sent her token → token EXISTS → continue ✅


//     // ┌─────────────────────────────────────────────────────────┐
//     // │  PART C: VERIFY AND DECODE TOKEN                        │
//     // └─────────────────────────────────────────────────────────┘

//     const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
//     //                          ↑                    ↑
//     //                    Alice's token     secret key from .env file
//     //
//     //  jwt.verify does THREE things:
//     //  1. Checks if token is properly formatted
//     //  2. Checks if token was signed with THIS secret key
//     //     (not tampered/fake)
//     //  3. Checks if token is NOT expired (exp > current time)
//     //
//     //  If ANY check fails → throws error → caught by asyncHandler
//     //
//     //  If ALL checks pass → returns the PAYLOAD that was
//     //  put inside during login:
//     //
//     //  decodedToken = {
//     //      _id: "64xyz789",           ← Alice's MongoDB _id
//     //      email: "alice@test.com",   ← Alice's email
//     //      username: "alice",         ← Alice's username
//     //      fullName: "Alice Smith",   ← Alice's name
//     //      iat: 1710000000,           ← issued at (auto by jwt)
//     //      exp: 1710086400            ← expires at (auto by jwt)
//     //  }
//     //
//     //  Token is VALID → we now know this is Alice ✅


//     // ┌─────────────────────────────────────────────────────────┐
//     // │  PART D: FIND USER IN DATABASE                          │
//     // └─────────────────────────────────────────────────────────┘

//     const user = await User.findById(decodedToken?._id)
//     //                                    ↑
//     //                              "64xyz789" (Alice's id)
//     //
//     //  findById("64xyz789") → searches users collection
//     //  finds Alice's document

//                              .select("-password -refreshToken")
//     //                              ↑
//     //  EXCLUDE these fields from result:
//     //  - password → security risk (never expose)
//     //  - refreshToken → not needed here
//     //
//     //  Result:
//     //  user = {
//     //      _id: "64xyz789",
//     //      username: "alice",
//     //      fullName: "Alice Smith",
//     //      email: "alice@test.com",
//     //      avatar: "https://...",
//     //      coverImage: "https://..."
//     //  }
//     //  (no password, no refreshToken)
//     //
//     //  WHY FIND IN DB AGAIN?
//     //  Token only has _id, email, username, fullName
//     //  But we might need avatar, coverImage etc
//     //  Also: user might have been DELETED after token was made
//     //  DB check confirms user STILL EXISTS


//     // ┌─────────────────────────────────────────────────────────┐
//     // │  PART E: CHECK IF USER STILL EXISTS                     │
//     // └─────────────────────────────────────────────────────────┘

//     if (!user) {
//         throw new ApiError(401, "Invalid Access Token")
//     }
//     //  Scenario: Alice got token, then deleted her account
//     //  Token is still valid (not expired)
//     //  But user doesn't exist in DB anymore
//     //  → BLOCK ❌
//     //
//     //  Alice exists in DB → continue ✅


//     // ┌─────────────────────────────────────────────────────────┐
//     // │  PART F: ATTACH USER TO REQUEST OBJECT                  │
//     // └─────────────────────────────────────────────────────────┘

//     req.user = user
//     //   ↑
//     //  req.user = {
//     //      _id: "64xyz789",       ← THIS IS CRITICAL
//     //      username: "alice",        used later to check
//     //      fullName: "Alice Smith",  "is Alice subscribed
//     //      email: "alice@test.com",   to John's channel?"
//     //      avatar: "https://...",
//     //      coverImage: "https://..."
//     //  }
//     //
//     //  req.user is a CUSTOM property
//     //  Express allows adding anything to req object
//     //  Now ANY middleware/controller after this can access
//     //  req.user to know WHO is making the request


//     // ┌─────────────────────────────────────────────────────────┐
//     // │  PART G: CALL next()                                    │
//     // └─────────────────────────────────────────────────────────┘

//     next()
//     //  ↑
//     //  "I'm done, pass request to NEXT handler"
//     //  Next handler = getUserChannelProfile controller
//     //
//     //  WITHOUT next() → request STOPS here
//     //  Response is never sent → frontend waits forever
// })


// // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// // STEP 5 — getUserChannelProfile CONTROLLER RUNS (user.controller.js)
// // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// /*
//   AT THIS POINT, req object contains:
//   ─────────────────────────────────────
//   req.params = { username: "john" }
//   //  came from URL /c/john (set by Express router)

//   req.user = {
//       _id: "64xyz789",        ← Alice (logged in user)
//       username: "alice",
//       ...
//   }
//   //  came from verifyJWT middleware (set in PART F above)

//   TWO DIFFERENT USERS:
//   req.params.username = "john"  → CHANNEL being viewed
//   req.user._id = "64xyz789"    → PERSON who is viewing (Alice)
// */

// // user.controller.js

// import { asyncHandler } from "../utils/asyncHandler.js"
// import { ApiError } from "../utils/ApiError.js"
// import { ApiResponse } from "../utils/ApiResponse.js"
// import { User } from "../models/user.model.js"

// const getUserChannelProfile = asyncHandler(async (req, res) => {

//     const { username } = req.params
//     //          ↑
//     //  destructuring: same as → const username = req.params.username
//     //  username = "john"
//     //  URL was /c/john → Express extracted "john" from :username

//     if (!username?.trim()) {
//         throw new ApiError(400, "username is missing")
//     }
//     //  trim() removes spaces from both ends
//     //  "  john  " → "john"    ✅ has content → passes
//     //  "    "     → ""        ❌ empty after trim → throws error
//     //  undefined  → ?. prevents crash, returns undefined → falsy → throws error
//     //  /c/   (no username in URL) → throws 400 ❌


//     // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//     // STEP 6 — MONGODB AGGREGATION PIPELINE RUNS
//     // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

//     /*
//       WHY USE AGGREGATION?
//       ────────────────────
//       Normal query: User.findOne({ username: "john" })
//       → only gets data from users collection
//       → gives us john's name, email, avatar etc
//       → BUT cannot give subscriber count!
//       → subscriber data is in subscriptions collection

//       We need data from TWO collections:
//       1. users         → john's profile info
//       2. subscriptions → who subscribed to john
//                        → who john subscribed to

//       Aggregation Pipeline = chain of STAGES
//       Data flows through stages like water through pipes
//       Each stage TRANSFORMS the data
//     */

//     const channel = await User.aggregate([

//         // ─────────────────────────────────────────────────────────────
//         // STAGE 1 — $match (find the user)
//         // ─────────────────────────────────────────────────────────────

//         {
//             $match: {
//                 username: username?.toLowerCase()
//                 //                      ↑
//                 //  "john" or "JOHN" or "John" all become "john"
//             }
//         },

//         /*
//           WHAT HAPPENS IN STAGE 1:
//           ─────────────────────────
//           MongoDB looks at ALL documents in users collection:

//           Document 1: { username: "john", ... }    ← MATCH ✅
//           Document 2: { username: "alice", ... }   ← NO ❌
//           Document 3: { username: "bob", ... }     ← NO ❌
//           Document 4: { username: "charlie", ... } ← NO ❌

//           Only matching documents pass to next stage

//           DATA AFTER STAGE 1:
//           [
//             {
//                 _id: "64abc123",
//                 username: "john",
//                 fullName: "John Doe",
//                 email: "john@test.com",
//                 password: "$2b$10$hashed...",
//                 avatar: "https://res.cloudinary.com/avatar123",
//                 coverImage: "https://res.cloudinary.com/cover456",
//                 refreshToken: "eyJhb..."
//             }
//           ]
//         */


//         // ─────────────────────────────────────────────────────────────
//         // STAGE 2 — $lookup (get all SUBSCRIBERS of this channel)
//         // ─────────────────────────────────────────────────────────────

//         {
//             $lookup: {
//                 from: "subscriptions",
//                 //         ↑
//                 //   Go look in subscriptions collection
//                 //   subscription document looks like:
//                 //   { subscriber: userId, channel: channelId }

//                 localField: "_id",
//                 //              ↑
//                 //   Take John's _id from current document = "64abc123"

//                 foreignField: "channel",
//                 //                 ↑
//                 //   Find all subscription docs where channel = "64abc123"
//                 //   These are people who subscribed TO john

//                 as: "subscribers"
//                 //       ↑
//                 //   Store all matching docs as "subscribers" array
//                 //   Add this array as a NEW FIELD to John's document
//             }
//         },

//         /*
//           SEARCHING subscriptions collection:
//           ────────────────────────────────────
//           { subscriber: "64xyz789", channel: "64abc123" }  ← MATCH ✅ (Alice→John)
//           { subscriber: "64def456", channel: "64abc123" }  ← MATCH ✅ (Bob→John)
//           { subscriber: "64ghi012", channel: "64abc123" }  ← MATCH ✅ (Charlie→John)
//           { subscriber: "64abc123", channel: "64xyz789" }  ← NO ❌ (channel≠john)
//           { subscriber: "64abc123", channel: "64def456" }  ← NO ❌ (channel≠john)

//           3 documents matched!

//           DATA AFTER STAGE 2:
//           [
//             {
//                 _id: "64abc123",
//                 username: "john",
//                 fullName: "John Doe",
//                 email: "john@test.com",
//                 avatar: "https://...",
//                 coverImage: "https://...",

//                 subscribers: [                              ← NEW FIELD ADDED
//                     { subscriber: "64xyz789", channel: "64abc123" },  // Alice
//                     { subscriber: "64def456", channel: "64abc123" },  // Bob
//                     { subscriber: "64ghi012", channel: "64abc123" }   // Charlie
//                 ]
//             }
//           ]

//           SIMPLE ENGLISH: "3 people subscribed TO John's channel"
//         */


//         // ─────────────────────────────────────────────────────────────
//         // STAGE 3 — $lookup (get channels THIS user SUBSCRIBED TO)
//         // ─────────────────────────────────────────────────────────────

//         {
//             $lookup: {
//                 from: "subscriptions",
//                 //   Go look in subscriptions collection AGAIN

//                 localField: "_id",
//                 //   Take John's _id = "64abc123"

//                 foreignField: "subscriber",
//                 //                  ↑
//                 //   Find all docs where subscriber = "64abc123"
//                 //   THIS TIME checking "subscriber" field, not "channel"
//                 //   These are channels john subscribed TO

//                 as: "subscribedTo"
//                 //       ↑
//                 //   Store as "subscribedTo" array
//             }
//         },

//         /*
//           SEARCHING subscriptions collection:
//           ────────────────────────────────────
//           { subscriber: "64xyz789", channel: "64abc123" }  ← NO ❌ (subscriber≠john)
//           { subscriber: "64def456", channel: "64abc123" }  ← NO ❌ (subscriber≠john)
//           { subscriber: "64ghi012", channel: "64abc123" }  ← NO ❌ (subscriber≠john)
//           { subscriber: "64abc123", channel: "64xyz789" }  ← MATCH ✅ (John→Alice)
//           { subscriber: "64abc123", channel: "64def456" }  ← MATCH ✅ (John→Bob)

//           2 documents matched!

//           DATA AFTER STAGE 3:
//           [
//             {
//                 _id: "64abc123",
//                 username: "john",
//                 fullName: "John Doe",
//                 email: "john@test.com",
//                 avatar: "https://...",
//                 coverImage: "https://...",

//                 subscribers: [                              ← from Stage 2
//                     { subscriber: "64xyz789", channel: "64abc123" },
//                     { subscriber: "64def456", channel: "64abc123" },
//                     { subscriber: "64ghi012", channel: "64abc123" }
//                 ],

//                 subscribedTo: [                             ← NEW from Stage 3
//                     { subscriber: "64abc123", channel: "64xyz789" },  // John→Alice
//                     { subscriber: "64abc123", channel: "64def456" }   // John→Bob
//                 ]
//             }
//           ]

//           SIMPLE ENGLISH: "John subscribed to 2 channels (Alice and Bob)"
//         */


//         // ─────────────────────────────────────────────────────────────
//         // STAGE 4 — $addFields (calculate counts + isSubscribed)
//         // ─────────────────────────────────────────────────────────────

//         {
//             $addFields: {

//                 // FIELD 1: subscribersCount
//                 subscribersCount: {
//                     $size: "$subscribers"
//                     //          ↑
//                     //   $size counts items in an array
//                     //   $subscribers → refers to "subscribers" field
//                     //   ($ prefix means "this field from the document")
//                     //
//                     //   subscribers array has 3 items
//                     //   $size → 3
//                     //
//                     //   subscribersCount = 3
//                 },

//                 // FIELD 2: channelsSubscribedToCount
//                 channelsSubscribedToCount: {
//                     $size: "$subscribedTo"
//                     //          ↑
//                     //   subscribedTo array has 2 items
//                     //   $size → 2
//                     //
//                     //   channelsSubscribedToCount = 2
//                 },

//                 // FIELD 3: isSubscribed (MOST IMPORTANT)
//                 isSubscribed: {
//                     $cond: {
//                         if: {
//                             $in: [req.user?._id, "$subscribers.subscriber"]
//                             //         ↑                    ↑
//                             //   "64xyz789"         extracts subscriber field
//                             //   (Alice's _id)      from each item in subscribers array
//                             //   (set by verifyJWT)
//                             //
//                             //   "$subscribers.subscriber" extracts:
//                             //   subscribers = [
//                             //     { subscriber: "64xyz789", channel: "64abc123" },
//                             //     { subscriber: "64def456", channel: "64abc123" },
//                             //     { subscriber: "64ghi012", channel: "64abc123" }
//                             //   ]
//                             //   → ["64xyz789", "64def456", "64ghi012"]
//                             //
//                             //   $in checks: is "64xyz789" inside
//                             //   ["64xyz789", "64def456", "64ghi012"] ?
//                             //
//                             //   "64xyz789" = Alice's id
//                             //   First item in array is "64xyz789"
//                             //   YES it's there! ✅ → condition is TRUE
//                         },
//                         then: true,     // YES → Alice IS subscribed to John ✅
//                         else: false     // NO  → would be false if not found ❌
//                     }
//                     //
//                     //  isSubscribed = true (because Alice is subscribed to John)
//                     //
//                     //  OTHER SCENARIOS:
//                     //  IF BOB WAS VIEWING (req.user._id = "64def456"):
//                     //  → "64def456" in ["64xyz789","64def456","64ghi012"]
//                     //  → YES → isSubscribed = true ✅
//                     //
//                     //  IF A NEW USER "dave" WAS VIEWING (req.user._id = "64xxx"):
//                     //  → "64xxx" in ["64xyz789","64def456","64ghi012"]
//                     //  → NO → isSubscribed = false ❌
//                 }
//             }
//         },

//         /*
//           DATA AFTER STAGE 4:
//           [
//             {
//                 _id: "64abc123",
//                 username: "john",
//                 fullName: "John Doe",
//                 email: "john@test.com",
//                 avatar: "https://...",
//                 coverImage: "https://...",
//                 password: "$2b$10$hashed...",       ← still here (removed next stage)
//                 refreshToken: "eyJhb...",           ← still here (removed next stage)

//                 subscribers: [ ...3 items ],        ← still here (removed next stage)
//                 subscribedTo: [ ...2 items ],       ← still here (removed next stage)

//                 subscribersCount: 3,                ← NEW ✅
//                 channelsSubscribedToCount: 2,       ← NEW ✅
//                 isSubscribed: true                  ← NEW ✅
//             }
//           ]
//         */


//         // ─────────────────────────────────────────────────────────────
//         // STAGE 5 — $project (return only needed fields)
//         // ─────────────────────────────────────────────────────────────

//         {
//             $project: {
//                 fullName: 1,                    // 1 = INCLUDE ✅
//                 username: 1,                    // 1 = INCLUDE ✅
//                 subscribersCount: 1,            // 1 = INCLUDE ✅
//                 channelsSubscribedToCount: 1,   // 1 = INCLUDE ✅
//                 isSubscribed: 1,                // 1 = INCLUDE ✅
//                 avatar: 1,                      // 1 = INCLUDE ✅
//                 coverImage: 1,                  // 1 = INCLUDE ✅
//                 email: 1                        // 1 = INCLUDE ✅
//                 //
//                 //  1 = include this field
//                 //  0 = exclude (or just don't mention it)
//                 //  If you use 1 for some fields, all OTHERS are auto-excluded
//                 //
//                 //  WHAT GETS REMOVED:
//                 //  ❌ password     → REMOVED (security!)
//                 //  ❌ refreshToken → REMOVED (security!)
//                 //  ❌ subscribers  → REMOVED (huge array, not needed)
//                 //  ❌ subscribedTo → REMOVED (huge array, not needed)
//                 //
//                 //  NOTE: _id is included by default
//                 //  unless you explicitly set _id: 0
//                 //
//                 //  subscribers and subscribedTo arrays were only needed
//                 //  to CALCULATE the counts and isSubscribed
//                 //  Frontend doesn't need the raw arrays
//             }
//         }

//         /*
//           FINAL DATA AFTER STAGE 5 (PIPELINE COMPLETE):
//           [
//             {
//                 _id: "64abc123",
//                 fullName: "John Doe",
//                 username: "john",
//                 subscribersCount: 3,
//                 channelsSubscribedToCount: 2,
//                 isSubscribed: true,
//                 avatar: "https://res.cloudinary.com/avatar123",
//                 coverImage: "https://res.cloudinary.com/cover456",
//                 email: "john@test.com"
//             }
//           ]
//           // Clean response — only what frontend needs ✅
//         */

//     ])


//     // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//     // STEP 7 — CHECK IF CHANNEL EXISTS
//     // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

//     if (!channel?.length) {
//         throw new ApiError(404, "channel does not exist")
//     }
//     //  aggregate ALWAYS returns an ARRAY (never null/undefined)
//     //
//     //  THREE SCENARIOS:
//     //  ────────────────
//     //  Scenario 1: User "john" exists
//     //  channel = [{ fullName: "John Doe", ... }]
//     //  channel.length = 1 → truthy → PASS ✅
//     //
//     //  Scenario 2: User "nonexistent" doesn't exist
//     //  $match found nothing → no docs pass through pipeline
//     //  channel = []
//     //  channel.length = 0 → falsy → THROW 404 ❌
//     //
//     //  Scenario 3: Something went wrong
//     //  channel = undefined or null
//     //  channel?.length → undefined → falsy → THROW 404 ❌


//     // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//     // STEP 8 — SEND RESPONSE
//     // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

//     return res
//         .status(200)
//         .json(
//             new ApiResponse(
//                 200,
//                 channel[0],
//                 //      ↑
//                 //  aggregate returns ARRAY: [{ fullName: "John Doe", ... }]
//                 //  channel[0] gets the FIRST (and only) element
//                 //  We send object, not array
//                 //  Only ONE channel matches username (username is unique)
//                 "User channel fetched successfully"
//             )
//         )

//     /*
//       ApiResponse class looks like:
//       class ApiResponse {
//           constructor(statusCode, data, message) {
//               this.statusCode = statusCode
//               this.data = data
//               this.message = message
//               this.success = statusCode < 400
//           }
//       }

//       ACTUAL JSON SENT TO FRONTEND:
//       {
//           "statusCode": 200,
//           "data": {
//               "_id": "64abc123",
//               "fullName": "John Doe",
//               "username": "john",
//               "subscribersCount": 3,
//               "channelsSubscribedToCount": 2,
//               "isSubscribed": true,
//               "avatar": "https://res.cloudinary.com/avatar123",
//               "coverImage": "https://res.cloudinary.com/cover456",
//               "email": "john@test.com"
//           },
//           "message": "User channel fetched successfully",
//           "success": true
//       }
//     */
// })

// export { getUserChannelProfile }


// /*
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STEP 9 — RESPONSE GOES BACK TO FRONTEND
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

//   // Frontend JavaScript receives and displays:

//   const response = await fetch("/api/v1/users/c/john", {
//       headers: { Authorization: `Bearer ${token}` }
//   })
//   const result = await response.json()

//   // result.data contains everything needed to display:

//   ┌────────────────────────────────────────────────┐
//   │  ┌──────────────────────────────────────────┐  │
//   │  │         COVER IMAGE                      │  │
//   │  │   coverImage: "https://..."              │  │
//   │  │                                          │  │
//   │  │    ┌──────┐                              │  │
//   │  │    │AVATAR│  John Doe                    │  │
//   │  │    │      │  @john                       │  │
//   │  │    └──────┘                              │  │
//   │  │                                          │  │
//   │  │    3 Subscribers  •  2 Subscribed        │  │
//   │  │                                          │  │
//   │  │    [SUBSCRIBED ✅]                       │  │
//   │  │    (button shows ✅ because               │  │
//   │  │     isSubscribed = true                   │  │
//   │  │     Alice IS subscribed to John)          │  │
//   │  │                                          │  │
//   │  └──────────────────────────────────────────┘  │
//   └────────────────────────────────────────────────┘


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPLETE DATA ORIGIN SUMMARY — WHERE EVERY PIECE OF DATA CAME FROM
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

//   DATA                      │ ORIGIN                    │ WHEN
//   ──────────────────────────┼───────────────────────────┼──────────────────
//   "john" (username)         │ URL /c/john               │ Alice clicked
//                             │ → req.params.username     │ John's profile
//                             │                           │
//   Alice's token             │ Login response             │ When Alice
//                             │ → stored by frontend      │ logged in
//                             │ → sent in header/cookie   │
//                             │                           │
//   req.user (Alice)          │ verifyJWT decoded          │ Set by
//                             │ token → found in DB       │ middleware
//                             │ → req.user._id="64xyz789" │
//                             │                           │
//   John's profile            │ users collection           │ John
//   (name, email,             │ → $match stage found it   │ registered
//    avatar, cover)           │                           │ earlier
//                             │                           │
//   subscribersCount = 3      │ subscriptions collection   │ People
//                             │ → $lookup stage 2         │ subscribed to
//                             │ → found 3 docs where      │ John over time
//                             │   channel = john's _id    │
//                             │ → $size counted them      │
//                             │                           │
//   channelsSubscribedTo = 2  │ subscriptions collection   │ John subscribed
//                             │ → $lookup stage 3         │ to channels
//                             │ → found 2 docs where      │ over time
//                             │   subscriber = john's _id │
//                             │ → $size counted them      │
//                             │                           │
//   isSubscribed = true       │ req.user._id (Alice)      │ Calculated in
//                             │ checked against           │ $addFields
//                             │ subscribers array         │ stage using
//                             │ using $in operator        │ $cond + $in
//                             │ Alice's id WAS found      │
//                             │ → true                    │


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPLETE VISUAL FLOW DIAGRAM
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

//   Alice's Browser
//        │
//        │  GET /api/v1/users/c/john
//        │  Header: Authorization Bearer eyJhb...(Alice's token)
//        │
//        ▼
//   ┌─────────────┐
//   │   app.js     │
//   │  express()   │──→ parses JSON, cookies
//   │  routes to   │
//   │  userRouter  │
//   └──────┬───────┘
//          │
//          ▼
//   ┌──────────────────┐
//   │ user.routes.js    │
//   │ GET /c/:username  │──→ username = "john" stored in req.params
//   │ ↓                 │
//   │ 1st: verifyJWT    │
//   │ 2nd: controller   │
//   └──────┬────────────┘
//          │
//          ▼
//   ┌──────────────────────────────────────┐
//   │         verifyJWT middleware          │
//   │                                      │
//   │  1. Get token from cookie/header     │
//   │  2. jwt.verify(token, secret)        │
//   │     → decoded: { _id: "64xyz789" }   │
//   │  3. User.findById("64xyz789")        │
//   │     → Alice's document from DB       │
//   │  4. req.user = Alice's data          │
//   │  5. next() → go to controller        │
//   └──────────────┬───────────────────────┘
//                  │
//                  ▼
//   ┌──────────────────────────────────────┐
//   │   getUserChannelProfile controller    │
//   │                                      │
//   │  username = req.params.username      │
//   │           = "john"                   │
//   │                                      │
//   │  ┌──────── AGGREGATION ────────────┐ │
//   │  │                                 │ │
//   │  │  Stage 1: $match               │ │
//   │  │  find username "john" in users  │ │
//   │  │         ↓                       │ │
//   │  │  Stage 2: $lookup               │ │
//   │  │  get subscribers of john        │ │
//   │  │  (subscriptions.channel = john) │ │
//   │  │  → found 3 docs                │ │
//   │  │         ↓                       │ │
//   │  │  Stage 3: $lookup               │ │
//   │  │  get channels john subscribed to│ │
//   │  │  (subscriptions.subscriber=john)│ │
//   │  │  → found 2 docs                │ │
//   │  │         ↓                       │ │
//   │  │  Stage 4: $addFields            │ │
//   │  │  subscribersCount = 3           │ │
//   │  │  channelsSubscribedToCount = 2  │ │
//   │  │  isSubscribed = true            │ │
//   │  │  (Alice IS in subscribers list) │ │
//   │  │         ↓                       │ │
//   │  │  Stage 5: $project              │ │
//   │  │  return only needed fields      │ │
//   │  │  remove password, arrays etc    │ │
//   │  │                                 │ │
//   │  └─────────────────────────────────┘ │
//   │                                      │
//   │  channel found?   NO  → 404 ❌      │
//   │         ↓ YES                        │
//   │  return channel[0] ✅               │
//   └──────────────┬───────────────────────┘
//                  │
//                  ▼
//   ┌──────────────────────────────────────┐
//   │         JSON RESPONSE                │
//   │  {                                   │
//   │    statusCode: 200,                  │
//   │    data: {                           │
//   │      fullName: "John Doe",           │
//   │      username: "john",               │
//   │      subscribersCount: 3,            │
//   │      channelsSubscribedToCount: 2,   │
//   │      isSubscribed: true,             │
//   │      avatar: "https://...",          │
//   │      coverImage: "https://...",      │
//   │      email: "john@test.com"          │
//   │    },                                │
//   │    message: "User channel fetched"   │
//   │  }                                   │
//   └──────────────┬───────────────────────┘
//                  │
//                  ▼
//          Alice's Browser
//          displays John's channel profile
//          with subscriber count and
//          "Subscribed ✅" button
// */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPLETE VISUAL FLOW
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

//   FRONTEND
//   GET /api/v1/users/c/john
//   header: Authorization Bearer token
//           ↓
//   APP.JS
//   routes to userRouter
//           ↓
//   USER.ROUTES.JS
//   GET /c/:username
//   → verifyJWT → getUserChannelProfile
//           ↓
//   VERIFYJWT
//   token verified → req.user = loggedInUser → next()
//           ↓
//   CONTROLLER
//   req.params.username = "john"
//           ↓
//   MONGODB AGGREGATION
//   Stage 1 → $match      find user "john"
//   Stage 2 → $lookup     get all subscribers of john
//   Stage 3 → $lookup     get all channels john subscribed to
//   Stage 4 → $addFields  count subscribers + check isSubscribed
//   Stage 5 → $project    return only needed fields
//           ↓
//   channel found?   NO  → 404 ❌
//           ↓ YES
//   return channel[0] ✅
//           ↓
//   FRONTEND
//   shows channel profile with subscriber count ✅
// */
// */


//  A cookie is a small data file stored in your browser by a website — used to remember you, keep you logged in, and track your preferences across visits. 🍪

// const options = {
//     httpOnly: true,
//     //→ JavaScript CANNOT read this cookie
//     //→ Protects from hackers stealing it via JS (XSS attack)

//     secure: true,
//     //→ Cookie only sent over HTTPS (encrypted connection)
//     //→ NOT sent on HTTP (unsafe connection)

//     expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
//     //→ Cookie lives for 7 days
//     //→ After that it auto-deletes itself
// }
// ```

// ---

// ## Real Life Uses of Cookies
// ```
// 1. AUTHENTICATION 🔐
//    ──────────────────
//    Stores your login token
//    So you stay logged in even after closing browser
//    Example: You don't login to YouTube every day

// 2. REMEMBER ME ✅
//    ──────────────────
//    Stores your username/email
//    Auto fills login form next time
//    Example: Gmail remembers your email

// 3. SHOPPING CART 🛒
//    ──────────────────
//    Stores items you added to cart
//    Even before you create an account
//    Example: Amazon cart saves items

// 4. USER PREFERENCES 🎨
//    ──────────────────
//    Stores dark/light mode setting
//    Stores language preference
//    Example: YouTube remembers dark mode

// 5. TRACKING & ADS 📊
//    ──────────────────
//    Websites track what you browse
//    Show you related ads
//    Example: You search "shoes" → see shoe ads everywhere
// ```

// ---

// ## Types of Cookies
// ```
// ┌──────────────────┬─────────────────────────────────────────┐
// │  Session Cookie  │ Dies when browser closes                │
// │                  │ No expiry date set                      │
// │                  │ Example: bank login                     │
// ├──────────────────┼─────────────────────────────────────────┤
// │  Persistent      │ Lives until expiry date                 │
// │  Cookie          │ Survives browser close & PC shutdown    │
// │                  │ Example: YouTube stay logged in         │
// ├──────────────────┼─────────────────────────────────────────┤
// │  HttpOnly        │ JS cannot read it                       │
// │  Cookie          │ Only sent to server                     │
// │                  │ Used for auth tokens (secure)           │
// ├──────────────────┼─────────────────────────────────────────┤
// │  Third Party     │ Set by OTHER websites (ads/tracking)    │
// │  Cookie          │ Example: Google Ads tracking you        │
// │                  │ Browsers now blocking these             │
// └──────────────────┴─────────────────────────────────────────┘
// ```

// ---

// ## Cookie vs localStorage vs sessionStorage
// ```
// ┌──────────────────┬───────────┬──────────────┬────────────────┐
// │                  │  Cookie   │ localStorage │ sessionStorage │
// ├──────────────────┼───────────┼──────────────┼────────────────┤
// │ Sent to server   │ ✅ Auto   │ ❌ No        │ ❌ No          │
// │ JS readable      │ ⚠️ Depends│ ✅ Yes       │ ✅ Yes         │
// │ Survives close   │ ✅ Yes    │ ✅ Yes       │ ❌ No          │
// │ Survives shutdown│ ✅ Yes    │ ✅ Yes       │ ❌ No          │
// │ Expiry           │ ✅ Custom │ ❌ Never     │ Tab close      │
// │ Size             │ 4KB       │ 5MB          │ 5MB            │
// └──────────────────┴───────────┴──────────────┴────────────────┘


/* .cookie("accessToken", accessToken, options)
// .cookie("refreshToken", refreshToken, options)
// This is for Web Browsers
// Browser automatically stores the cookie
// Browser automatically sends the cookie on every request
// You don't need to do anything manually
// httpOnly: true means JavaScript cannot read it → safe from XSS attacks

// .json({
//     user: loggedInUser,
//     accessToken,        // ← also here
//     refreshToken        // ← also here
// })
// This is for Mobile Apps (Android / iOS) and other clients
// Mobile apps cannot use cookies the same way browsers do
// So they take the token from JSON response and store it themselves
// They manually attach it in headers on every request like:*/


