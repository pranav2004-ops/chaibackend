import mongoose, {Schema} from 'mongoose';
//  main library to connect and interact with MongoDB
import jwt from "jsonwebtoken"
//  JSON Web Token library to generate access and refresh tokens for authentication
import bcrypt from "bcrypt"
// bcrypt : library to hash passwords before storing them in database

const userSchema=new Schema(
    {
username:{
    type:String,
    required:true,
    unique:true,
    lowercase:true,
    trim:true,
    index:true,
    //  creates a database index on this field making searches faster
    // lowercase: true — so Test@Gmail.com and test@gmail.com are treated the same
},
email: {
    type:String,
    required:true,
    unique:true,
    lowercase:true,
    trim:true,
  
},
fullName:{
    type:String,
    required:true,
    trim:true,
    index:true,
},
avatar:{
    type:String, //cloudinary url
 required:true,
//  Stores the Cloudinary URL of the avatar image as a string
// We don't store the actual image in database, just the URL pointing to Cloudinary where the image is hosted.

},
coverImage:{
   type:String,    //cloudinary url
},
watchHistory:[
    {
        type:Schema.Types.ObjectId,
        ref:"Video"
// Schema.Types.ObjectId — stores the ID of a Video document, not the video itself
// ref: "Video" — tells mongoose this ID refers to the Video model, enabling .populate() to fetch full video data when needed
// 
}
],
password:{
    type:String,
    required:[true,'Password is required']
},
refreshToken:{
    type:String
    // Stores the refresh token string when user logs in or registers, allowing them to get new access tokens without re-authenticating until the refresh token expires or is invalidated.
    // No required — it's empty until user logs in for the first time
}
// A refresh token is a long-lived credential used to generate a new access token when the old one expires.
    },
    {
        timestamps:true
    }
)

 userSchema.pre("save", async function() {
    if(!this.isModified("password")) return;
    this.password = await bcrypt.hash(this.password, 10)

})
// pre("save") — runs automatically before every .save() call
// this refers to the current user document being saved
// this.isModified("password") — checks if password field was changed. If not changed (e.g. updating email), skip hashing and return early — otherwise you'd hash an already hashed password!
//  don't use arrow function here because we need to use 'this' keyword which is not supported 
// in arrow functions. 'this' will refer to the user document that is being saved.
// and also we need to use 'this' keyword in the methods below to access the user document.
// and we don't use next() function here because we are using async/await 
// and we can handle errors using try/catch block.


userSchema.methods.isPasswordCorrect = async function(password){
    return await bcrypt.compare(password, this.password)
}

// Called during login to verify password
// bcrypt.compare() compares the plain text password (from login form) with the hashed password stored in database
// Returns true if they match, false if not
// We can't just use === because the stored password is hashed, so we need bcrypt to do the comparison correctly.
userSchema.methods.generateAccessToken = function(){
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
            fullName: this.fullName
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}
// Generates a short-lived JWT access token when user logs in
// jwt.sign() takes 3 arguments — payload, secret, options
// Payload — data encoded inside the token (_id, email, username, fullName). This data can be decoded on the frontend without the secret
// Secret — a private key used to sign the token. Anyone with this secret can verify the token is genuine
// expiresIn — how long the token is valid (e.g. "1d" = 1 day). After expiry, user must log in again to get a new token. This is why we also have refresh tokens.
userSchema.methods.generateRefreshToken = function(){
    return jwt.sign(
        {
            _id: this._id,
            
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}
// Generates a long-lived refresh token (e.g. "10d" = 10 days)
// Contains only _id in payload — minimal data since it's just used to generate new access tokens
// When access token expires, frontend sends refresh token to get a new access token without making user log in again
// Stored in database so it can be invalidated (logout) by deleting it from the user document
export const User = mongoose.model("User",userSchema)
 
 
// - `mongoose.model("User", userSchema)` creates a Model from the schema
// - MongoDB will store documents in a collection called `users` (mongoose automatically pluralizes and lowercases "User")
// - Exported so it can be imported and used in controllers to do `User.create()`, `User.findOne()` etc.
// ## Summary of the full flow:
// Schema defines structure and rules for User documents in MongoDB
// pre save hook hashes password before storing
// isPasswordCorrect verifies password during login
// generateAccessToken creates short-lived token (1 day)
// generateRefreshToken creates long-lived token (10 days)
// User model exported for use in controllers


/* Frontend/Postman → Route → Middleware → Controller → Model → MongoDB
//                                                      ↑
//     how data flows through the entire system.       user.model.js lives here
// MongoDB is a warehouse that stores boxes (documents)
// user.model.js is the blueprint that describes what goes inside each box
// Controller is the worker who creates, reads, updates boxes
// User.create(), User.findOne() are the tools the worker uses to interact with the warehouse (MongoDB) according to the blueprint (user.model.js) when fulfilling orders (API requests).
*/

//  When you log into a website, it gives your browser two things:
// Access Token – short-lived (minutes to hours), used to verify you're logged in
// Refresh Token – longer-lived, used to silently get a new access token without asking for your password again