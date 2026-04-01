// This is the heart of your Express application. It creates the app, registers all middleware,
//  and connects routes. Think of it like the main pipeline that every request passes through
//   before reaching your controller.

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

// routes import 
import userRouter from './routes/user.routes.js'

const app = express();

//  use app.use(),,, to add middlewares and routes to the app or set the configurations  

// app.use() registers middleware — runs on every incoming request
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}
));

app.use(express.json({limit: '16kb'}));
app.use(express.urlencoded({extended: true, limit: "16kb"}));
app.use(express.static("public"))
app.use(cookieParser());

//http://localhost:8000/api/v1/users/register

 
//router declaration
app.use("/api/v1/users",userRouter)

// //        ↑
//   this prefix is added to ALL routes in this file
// So /register in this file becomes /api/v1/users/register in the full URL.

export {app};

// Middleware must be registered before the routes that depend on it,
//  because Express processes them top to bottom in the order they are registered. ✅
// If you put routes before middleware, the middleware won't run for those routes and things like req.body will be undefined in your controllers! ❌
// Always register global middleware (like CORS, JSON parsing) at the top, before any routes.


// In ES Modules, import statements are always hoisted — but keeping them at the
//  top is the correct pattern and ensures everything is registered before routes are declared.


/*express — the main framework that handles HTTP requests/responses
cors — Cross Origin Resource Sharing — controls which domains can access your API
cookieParser — reads cookies from incoming requests and puts them in req.cookies
userRouter — your user routes file, imported to be mounted on the app

const app = express();
Creates the main Express application instance
Everything — middleware, routes, settings — gets attached to this app object
This is what listens for incoming HTTP requests

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));

app.use() registers middleware — runs on every incoming request

CORS is a browser security feature. By default browsers block requests from different domains
Example: your frontend is on http://localhost:3000 but your backend is on http://localhost:8000 — without CORS this request would be blocked

origin: process.env.CORS_ORIGIN — only allows requests from this domain (set to * in your .env which means all domains allowed)

credentials: true — allows cookies and auth headers to be sent cross-origin

app.use(express.json({ limit: '16kb' })); // JSON middleware
Tells Express to parse incoming requests with JSON body
Without this, req.body would be undefined for JSON requests
limit: '16kb' — rejects requests larger than 16kb to prevent attacks
Example — when frontend sends:
fetch('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'test@test.com' })
})This middleware parses that JSON and puts it in req.body

app.use(express.urlencoded({ extended: true, limit: "16kb" }));
`` URL encoded middleware
- Parses requests where data is sent as URL encoded format
- This is what HTML forms send by default:
```
fullName=chai+aur+code&email=test%40test.com
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
```extended: true — allows nested objects in the URL encoded data
limit: "16kb" — same size limit as JSON
Note: for multipart/form-data (file uploads), multer handles parsing — not this middleware

Static files middleware
app.use(express.static("public"))
```
- Serves files from the `public` folder directly over HTTP
- Example: if you have `public/temp/image.png`, it's accessible at:
```
http://localhost:8000/temp/image.png
This is why your temp folder is inside public/ — multer saves files there and they can be served if needed

cookieParser middleware
app.use(cookieParser());
Parses cookies from incoming requests
Without this, req.cookies would be undefined
After this middleware, you can do:
req.cookies.accessToken  // ← read cookie
res.cookie("accessToken", token)  // ← set cookie
res.clearCookie("accessToken")    // ← delete cookie

 Used in authentication — access tokens are often stored in cookies

//  // ❌ Wrong — routes before middleware
// app.use("/api/v1/users", userRouter)  // routes first
// app.use(express.json())               // middleware after
// // req.body will be undefined in controllers!

// // ✅ Correct — middleware before routes
// app.use(express.json())               // middleware first
// app.use("/api/v1/users", userRouter)  // routes after
// // req.body is properly parsed ✅ */

