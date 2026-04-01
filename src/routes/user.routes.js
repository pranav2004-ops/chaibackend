// This file is a mini router — it only handles routes related to users. Instead of defining all routes in app.js, Express lets you split routes into separate files to keep code organized.


import { Router } from "express";
import {loginUser,logoutUser, 
      registerUser,
      refreshAccessToken,
      changeCurrentPassword, 
      getCurrentUser, 
      updateUserAvatar, 
      updateUserCoverImage, 
      updateAccountDetails,
       getUserChannelProfile, 
    getWatchHistory
}

    from '../controllers/user.controller.js';
import {upload} from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

router.route("/register")

// Defines the path /register
// Full path becomes http://localhost:8000/api/v1/users/register
// .route() is used instead of .post() directly because it lets you chain multiple HTTP methods on the same path cleanly:
// router.route("/register")
//     .post(registerUser)   // POST /register
//     .get(getUsers)        // GET /register
//     .put(updateUser)      // PUT /register
 router.route("/register").post(

//  .post(...)
// This route only responds to POST requests
// GET, PUT, DELETE requests to this URL will return 404

// Two arguments inside .post()

    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        }, 
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser
    )   

router.route("/login").post(loginUser)

// secured route, only accessible if you have a valid access token
router.route("/logout").post(verifyJWT, logoutUser)

router.route("/refresh-token").post(refreshAccessToken)

router.route("/change-password").post(verifyJWT, changeCurrentPassword)
router.route("/current-user").get(verifyJWT, getCurrentUser)
router.route("/update-account").patch(verifyJWT, updateAccountDetails)

router.route("/avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar)
router.route("/cover-image").patch(verifyJWT, upload.single("coverImage"), updateUserCoverImage)

router.route("/c/:username").get(verifyJWT, getUserChannelProfile)
router.route("/history").get(verifyJWT, getWatchHistory)


export default router


/*upload.fields([
// { name: "avatar", maxCount: 1 }, 
// { name: "coverImage", maxCount: 1 }
// ]) 
// This is multer middleware that:
// Step 1 — Intercepts the incoming request before it reaches your controller
// Step 2 — Looks for files in the request with field names avatar and coverImage
// Step 3 — Saves those files temporarily to public/temp/ on your server
// Step 4 — Attaches file info to req.files:
// req.files = {
//     avatar: [{
//         fieldname: 'avatar',
//         originalname: 'pranav.png',
//         path: 'public/temp/pranav.png',  // ← saved here
//         size: 764644,
//         // ...
//     }],
//     coverImage: [{
//         fieldname: 'coverImage',
//         originalname: 'virat.png',
//         path: 'public/temp/virat.png',
//         // ...
//     }]
// }
// ```
// **Step 5** — Calls `next()` internally to pass control to `registerUser`
// **`maxCount: 1`** means only 1 file allowed per field. If someone tries to upload 2 avatars, multer rejects it.
// ---
// ## The full request journey through this file
// ```
// POST /api/v1/users/register
//         ↓
// app.js sees "/api/v1/users" 
// → hands off to userRouter
//         ↓
// userRouter sees "/register" with POST method
// → starts processing middleware chain
//         ↓
// upload.fields() runs
// → saves avatar to public/temp/pranav.png
// → saves coverImage to public/temp/virat.png
// → populates req.files with file info
// → calls next()                               
//         ↓
// registerUser() runs
// → reads req.body for text fields
// → reads req.files for file paths
// → uploads to Cloudinary
// → saves user to MongoDB
// → sends response 

*/


// ## Complete Visual Flow for how to change password (protected route example)
// ```
// FRONTEND
//   sends POST /api/v1/users/change-password
//   body: { oldPassword, newPassword }
//   header: Authorization Bearer token
//           ↓
// APP.JS
//   app.use(express.json())     → parses body
//   app.use("/api/v1/users")    → routes to userRouter
//           ↓
// USER.ROUTES.JS
//   POST /change-password
//   → verifyJWT → changeCurrentPassword
//           ↓
// VERIFYJWT MIDDLEWARE
//   gets token from header
//   jwt.verify() → decodes token
//   User.findById() → finds user
//   req.user = user
//   next() → move forward
//           ↓
// CHANGECURRENTPASSWORD CONTROLLER
//   req.body → oldPassword, newPassword
//   User.findById(req.user._id) → get user from DB
//   user.isPasswordCorrect() → bcrypt compare
//   wrong? → 400 error ❌
//   correct? → user.password = newPassword
//   user.save() → pre hook hashes password
//   save to MongoDB ✅
//           ↓
// RESPONSE
//   200 "Password changed successfully" ✅
//           ↓
// FRONTEND
//   receives success response
//  // Frontend receives this:
// {
//     "statusCode": 200,
//     "data": {},
//     "message": "Password changed successfully"
// }
// ```

// ---


