// This is a JWT Authentication Middleware — it acts like a security guard that checks if a user is logged in before allowing access to protected routes.


import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken"
import { User } from "../models/user.model.js";

//  JWT token is NOT encrypted — it is only signed. Both DB and user have the same raw token. Security comes from the signature (which needs your secret key to forge), not from hiding the token content. 🔐
export const verifyJWT = asyncHandler(async(req, _, next) => {
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")
        
        // console.log(token);
        if (!token) {
            throw new ApiError(401, "Unauthorized request")
        }
    
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
    
        if (!user) {
            
            throw new ApiError(401, "Invalid Access Token")
        }
    
        req.user = user;
        next()
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid access token")
    }
    
})

/* explanantion of the code above:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTS 
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { ApiError }     → custom error class to throw proper HTTP errors
import { asyncHandler } → wrapper to auto-catch async errors
import jwt              → jsonwebtoken library to verify the token
import { User }         → User model to find user from DB


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FUNCTION DEFINITION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const verifyJWT = asyncHandler(async(req, _, next) => {

  → export        = making it available to other files
  → asyncHandler  = wraps it so errors are auto-caught
  → req           = incoming request (contains cookies, headers)
  → _             = response object (not needed here, so named _ to ignore)
  → next          = function to move to the next middleware


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — GET THE TOKEN (from 2 possible places)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const token = req.cookies?.accessToken 
             || req.header("Authorization")?.replace("Bearer ", "")

  TWO SOURCES of token:

  SOURCE 1 → req.cookies?.accessToken
  ─────────────────────────────────────
  → Reads token from browser COOKIE
  → Used by WEB BROWSERS (cookie is auto-sent)
  → ?. means optional chaining — if cookies is null, don't crash

  SOURCE 2 → req.header("Authorization")?.replace("Bearer ", "")
  ─────────────────────────────────────
  → Reads token from request HEADER
  → Used by MOBILE APPS / POSTMAN
  → Header looks like:  Authorization: Bearer eyJhbGci...
  → .replace("Bearer ", "") removes the "Bearer " prefix
  → leaving just the raw token:  eyJhbGci...

  || means → try SOURCE 1 first, if not found try SOURCE 2


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — CHECK IF TOKEN EXISTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  if (!token) {
    throw new ApiError(401, "Unauthorized request")
  }

  → If no token found in EITHER place
  → Throw 401 Unauthorized error
  → Request is BLOCKED here itself — user is not logged in


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — VERIFY & DECODE THE TOKEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

  → jwt.verify() does TWO things at once:
      1. Checks if token is VALID (not fake or tampered)
      2. DECODES it and returns the data hidden inside

  → ACCESS_TOKEN_SECRET is the secret key (stored in .env file)
    used to verify the token was created by YOUR server only

  → decodedToken will contain something like:
    {
      _id: "64abc123...",   ← user's id
      email: "a@b.com",
      iat: 1710000000,      ← issued at (timestamp)
      exp: 1710003600       ← expires at (timestamp)
    }


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — FIND USER IN DATABASE USING DECODED _ID
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const user = await User.findById(decodedToken?._id)
                         .select("-password -refreshToken")

  → Uses the _id from decoded token to find user in MongoDB
  → .select("-password -refreshToken") removes sensitive fields
  → ?. safe navigation — if decodedToken is null, don't crash

  if (!user) {
    throw new ApiError(401, "Invalid Access Token")
  }
  → If no user found with that ID → token is invalid → block request


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — ATTACH USER TO REQUEST & MOVE FORWARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  req.user = user;
  → Attaches the found user object to the request
  → Now ANY route after this middleware can access req.user
  → Example: req.user._id, req.user.email etc.

  next()
  → Tells Express "verification done, move to the actual route now"


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CATCH BLOCK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid access token")
  }

  → If ANYTHING goes wrong above (token expired, tampered, etc.)
  → Catches the error and throws a clean 401 ApiError
  → error?.message → uses jwt's own error message if available */

/*
// Without verifyJWT — anyone can access ❌
router.get("/profile", getProfile)

// With verifyJWT — only logged in users can access ✅
router.get("/profile", verifyJWT, getProfile)
//                      ↑
//               runs FIRST as security check
//               if passed → getProfile runs
//               if failed → 401 error returned
```

---

## Full Flow Summary
```
Request comes in
      ↓
Token found in cookie OR Authorization header?
      ↓ NO  → 401 Unauthorized ❌
      ↓ YES
jwt.verify() — is token valid & not expired?
      ↓ NO  → 401 Invalid Token ❌
      ↓ YES
Find user in DB using decoded _id
      ↓ NOT FOUND → 401 Invalid Token ❌
      ↓ FOUND
Attach user to req.user
      ↓
next() → proceed to actual route ✅  */


// JSON is just a STRING format. It looks like an object, but it's NOT an object until it's parsed.

// A Node.js framework used to build servers and APIs.
// Main uses in backend:
// create server
// define routes
// handle requests/responses
// parse JSON and form data
// use middleware
// connect database
// build APIs
// implement authentication
// handle errors