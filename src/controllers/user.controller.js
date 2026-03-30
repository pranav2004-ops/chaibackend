import { asyncHandler } from "../utils/asyncHandler.js";
// A wrapper that catches any errors in async functions and passes them to Express's next() 
// automatically — so you don't need try/catch everywhere.
import {ApiError} from "../utils/ApiError.js"
// A custom error class to send structured error responses with a status code and message.
import { User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
 
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

export {registerUser,loginUser, logoutUser,refreshAccessToken}

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


