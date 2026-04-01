import {v2 as cloudinary} from "cloudinary"
import fs from "fs"


 
console.log("Cloudinary config:", process.env.CLOUDINARY_CLOUD_NAME, process.env.CLOUDINARY_API_KEY)
 
const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null
               cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET
        });
        console.log("Uploading file:", localFilePath) // 👈 add this

        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })
        console.log("Upload success:", response.url) // 👈 add this
        fs.unlinkSync(localFilePath) // delete the local file after uploading
        return response;

    } catch (error) {
        console.log("Cloudinary ERROR:", error.message) // 👈 add this
        fs.unlinkSync(localFilePath) // delete the local file even if upload fails
        return null;
    }
}



export {uploadOnCloudinary}

// important to understand
/*  updateUserAvatar — COMPLETE FLOW (Frontend to Backend)   
╔══════════════════════════════════════════════════════════════════════╗
║         updateUserAvatar — COMPLETE FLOW (Frontend to Backend)       ║
╚══════════════════════════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — FRONTEND SENDS REQUEST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // Frontend sends a PATCH request with image file

  const formData = new FormData()
  formData.append("avatar", imageFile)
  //                  ↑
  //          key name MUST be "avatar"
  //          matches multer upload.single("avatar")

  fetch("http://localhost:8000/api/v1/users/avatar", {
      method: "PATCH",
      headers: {
          Authorization: `Bearer ${accessToken}`
          // NO Content-Type here — browser sets it automatically
          // for FormData with correct boundary
      },
      body: formData
  })

  OR IN POSTMAN:
  ─────────────────────────────────────
  METHOD  → PATCH
  URL     → http://localhost:8000/api/v1/users/avatar
  Headers → Authorization: Bearer <accessToken>
  Body    → form-data
            Key: avatar  Type: FILE  Value: your image


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — REQUEST HITS app.js
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // app.js

  app.use(express.json())
  app.use(cookieParser())
  app.use("/api/v1/users", userRouter)
  //         ↑
  //  request goes to userRouter


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — ROUTER MATCHES ROUTE (user.routes.js)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  router.patch("/avatar", verifyJWT, upload.single("avatar"), updateUserAvatar)
  //               ↑          ↑              ↑                      ↑
  //           matches    runs 1st       runs 2nd               runs 3rd
  //           the URL   checks token  saves file locally     updates avatar


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — verifyJWT MIDDLEWARE RUNS (auth.middleware.js)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  export const verifyJWT = asyncHandler(async(req, _, next) => {

    // GET TOKEN from cookie or header
    const token = req.cookies?.accessToken
               || req.header("Authorization")?.replace("Bearer ", "")
    // → removes "Bearer " → leaves raw token eyJhbGci...

    if (!token) throw new ApiError(401, "Unauthorized request")

    // VERIFY TOKEN — checks if valid and not expired
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
    // decodedToken = { _id: "64abc123", email: "a@b.com" }

    // FIND USER in DB
    const user = await User.findById(decodedToken?._id)
                           .select("-password -refreshToken")

    if (!user) throw new ApiError(401, "Invalid Access Token")

    // ATTACH USER to request
    req.user = user
    //    ↑
    //  now updateUserAvatar can use req.user._id and req.user.avatar

    next() // → move to multer middleware
  })


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — MULTER MIDDLEWARE RUNS (multer.middleware.js)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const storage = multer.diskStorage({

    destination: function (req, file, cb) {
        cb(null, "./public/temp")
        //             ↑
        //   saves file here temporarily
        //   public/temp/myphoto.jpg
    },

    filename: function (req, file, cb) {
        cb(null, file.originalname)
        //              ↑
        //   keeps original file name
        //   "myphoto.jpg"
    }
  })

  export const upload = multer({ storage })

  // AFTER MULTER RUNS:
  // req.file = {
  //     fieldname:    "avatar",
  //     originalname: "myphoto.jpg",
  //     path:         "public/temp/myphoto.jpg",  ← this is what we need
  //     mimetype:     "image/jpeg",
  //     size:         102400
  // }

  // next() → moves to updateUserAvatar controller


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — updateUserAvatar CONTROLLER RUNS (user.controller.js)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const updateUserAvatar = asyncHandler(async(req, res) => {

    // GET LOCAL FILE PATH from multer
    const avatarLocalPath = req.file?.path
    //                           ↑
    //              "public/temp/myphoto.jpg"
    //              multer saved it here in STEP 5
    //              ?. → if no file uploaded dont crash

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
        // → no file sent → block request ❌
    }


    // UPLOAD TO CLOUDINARY (cloudinary.js util)
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    //                            ↑
    //   uploadOnCloudinary does this internally:
    //
    //   const uploadOnCloudinary = async (localFilePath) => {
    //       if (!localFilePath) return null
    //       const response = await cloudinary.uploader.upload(localFilePath)
    //       fs.unlinkSync(localFilePath) → deletes local file after upload
    //       return response
    //   }
    //
    //   avatar = {
    //       url: "https://res.cloudinary.com/demo/image/upload/v123/myphoto.jpg",
    //       public_id: "myphoto",
    //       width: 500,
    //       height: 500,
    //       ...
    //   }

    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading on avatar")
        // → cloudinary upload failed → block ❌
    }


    // UPDATE USER IN DATABASE
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        //     ↑
        //  logged in user's id from verifyJWT

        {
            $set: {
                avatar: avatar.url
                //          ↑
                //  saves cloudinary URL in DB
                //  "https://res.cloudinary.com/..."
                //  only updates avatar field
                //  all other fields stay untouched
            }
        },

        { new: true }
        //     ↑
        //  returns UPDATED document
        //  not the old one

    ).select("-password")
    //         ↑
    //  removes password from result
    //  never send password to frontend


    // SEND RESPONSE
    return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar image updated successfully"))
  })


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 7 — RESPONSE GOES BACK TO FRONTEND
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  {
      "statusCode": 200,
      "data": {
          "_id": "64abc123",
          "fullName": "John Doe",
          "username": "john",
          "email": "john@test.com",
          "avatar": "https://res.cloudinary.com/demo/image/upload/v123/myphoto.jpg",
          "coverImage": "https://cloudinary.com/...",
      },
      "message": "Avatar image updated successfully"
  }


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPLETE VISUAL FLOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  FRONTEND
  sends PATCH /api/v1/users/avatar
  form-data: { avatar: imageFile }
  header: Authorization Bearer token
          ↓
  APP.JS
  routes to userRouter
          ↓
  USER.ROUTES.JS
  PATCH /avatar
  → verifyJWT → upload.single() → updateUserAvatar
          ↓
  VERIFYJWT
  gets token → jwt.verify() → finds user
  req.user = user → next()
          ↓
  MULTER
  receives image file
  saves to public/temp/myphoto.jpg
  req.file.path = "public/temp/myphoto.jpg"
  next()
          ↓
  UPDATEUSERAVATAR CONTROLLER
  avatarLocalPath = req.file.path
  uploadOnCloudinary(avatarLocalPath)
    → uploads to cloudinary
    → deletes local file
    → returns cloudinary URL
  findByIdAndUpdate()
    → $set avatar = cloudinary URL
    → new: true returns updated user
          ↓
  RESPONSE
  200 updated user object ✅
          ↓
  FRONTEND
  shows new avatar image ✅
*/


