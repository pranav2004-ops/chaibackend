import mongooose  from 'mongoose';
import { DB_NAME } from '../constants.js';

const connectDB= async () => {
    try {
       const connectionInstance= await mongooose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        console.log(`\n MongoDB connected successfully !! DB HOST:${connectionInstance.connection.host} `);
    } catch (error) {
        console.error('Error connecting to MongoDB', error)
         process.exit(1)
    }
}

export default connectDB;

// why we use parsify json in express app.js file
/* Client sends JSON string in request body → express.json() middleware parses it into JS object → Your controllers can access data as req.body.name instead of req.body.name (string) */

/* CLIENT SIDE                          NETWORK                         SERVER SIDE
// ───────────                          ───────                         ───────────

// { name: "John" }                                                    
//     ↓                                                               
// JSON.stringify()                                                    
//     ↓                                                               
// '{"name":"John"}'  ──────────→  '{"name":"John"}'  ──────────→  '{"name":"John"}'
// (String)                        (Travels as String)              (Still a String ❌)
//                                                                       ↓
//                                                                  express.json()
//                                                                  JSON.parse()
//                                                                       ↓
//                                                                  { name: "John" }
//                                                                  (Now a JS Object ✅) */


// // ========================
// // FILE: src/db/index.js
// // ========================

// import mongoose from 'mongoose';          // Mongoose = ODM library to talk to MongoDB
// import { DB_NAME } from '../constants.js'; // e.g constants.js → export const DB_NAME = "myApp"


// // ─────────────────────────────────────────
// // STEP 1: You define your MongoDB URI in .env file
// // ─────────────────────────────────────────

// // .env file (never push this to GitHub)
// // MONGODB_URI = mongodb+srv://username:password@cluster0.mongodb.net

// // Final connection string becomes:
// // mongodb+srv://username:password@cluster0.mongodb.net/myApp
// //                                                      ^^^^^^
// //                                                    DB_NAME appended here


// // ─────────────────────────────────────────
// // STEP 2: connectDB function makes the connection
// // ─────────────────────────────────────────

// const connectDB = async () => {
//     try {
//         // mongoose.connect() returns a connection instance with details about the connection
//         const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);

//         // .connection.host tells you WHICH cluster/server you're connected to
//         // Useful to confirm you're on dev DB and not production DB accidentally
//         console.log(`\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`);

//     } catch (error) {
//         console.error('Error connecting to MongoDB', error);
//         process.exit(1); // Kills the Node process if DB fails → no point running app without DB
//     }
// }

// export default connectDB;


// // ─────────────────────────────────────────
// // STEP 3: Call connectDB in your entry point (index.js / app.js)
// // ─────────────────────────────────────────

// // FILE: src/index.js

// import dotenv from 'dotenv';
// import connectDB from './db/index.js';
// import app from './app.js'; // your express app

// dotenv.config();   // Load .env variables BEFORE connectDB runs

// connectDB()
//     .then(() => {
//         app.listen(process.env.PORT || 3000, () => {
//             console.log(`Server running on port ${process.env.PORT}`);
//         });
//     })
//     .catch((error) => {
//         console.error("MongoDB connection failed !", error);
//     });

// // WHY .then() here?
// // connectDB is async → it returns a Promise
// // So we only start the server AFTER DB is successfully connected ✅


// // ─────────────────────────────────────────
// // STEP 4: How data flows from MongoDB → Your Project
// // ─────────────────────────────────────────

// // MongoDB Atlas (Cloud)
// //        ↓  (mongoose.connect)
// // Mongoose ODM  ←→  Your Models (User.js, Post.js etc.)
// //        ↓
// // Controllers (business logic)
// //        ↓
// // Routes (API endpoints)
// //        ↓
// // Client (Postman / Frontend)


// // ─────────────────────────────────────────
// // STEP 5: After connection, you use Models to talk to DB
// // ─────────────────────────────────────────

// // FILE: src/models/User.js
// import mongoose from 'mongoose';

// const userSchema = new mongoose.Schema({
//     name: String,
//     email: String,
// });

// export const User = mongoose.model('User', userSchema);
// // This creates a 'users' collection in your DB automatically


// // FILE: src/controllers/user.controller.js
// import { User } from '../models/User.js';

// const getUsers = async (req, res) => {
//     const users = await User.find();  // Mongoose talks to MongoDB and fetches all users
//     res.json(users);
// }


// // ─────────────────────────────────────────
// // FULL FLOW SUMMARY
// // ─────────────────────────────────────────

// // 1. .env         → stores your secret MongoDB URI
// // 2. connectDB()  → connects Mongoose to MongoDB Atlas at app startup
// // 3. Model        → defines shape of your data (Schema)
// // 4. Controller   → uses Model to read/write data from MongoDB
// // 5. Route        → exposes controller as an API endpoint
// // 6. index.js     → ties it all together, starts server only after DB connects



