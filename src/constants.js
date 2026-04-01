export const DB_NAME = 'youtube'

// Mongoose is a popular JavaScript library used with MongoDB in Node.js applications.
// It helps you:
// Define schemas (structure of your data)
// Validate data before saving
// Interact with MongoDB using objects instead of raw queries


/* Why use Mongoose?
// // HOW mongoose.model('User', userSchema) AUTO-CREATES A COLLECTION
// // ─────────────────────────────────────────


// // ─────────────────────────────────────────
// // STEP 1: You write this line
// // ─────────────────────────────────────────

// export const User = mongoose.model('User', userSchema);
// //                                 ^^^^^^
// //                            Model name = 'User'  (Singular, Capital)


// // ─────────────────────────────────────────
// // STEP 2: Mongoose internally does this automatically
// // ─────────────────────────────────────────

// // Mongoose takes your model name → converts it to lowercase + plural
// //
// //   'User'    →   'users'      ✅
// //   'Post'    →   'posts'      ✅
// //   'Category'→   'categories' ✅  (handles irregular plurals too)
// //
// // This 'users' becomes your COLLECTION NAME inside MongoDB
// // Think of collection = Table in SQL


// // ─────────────────────────────────────────
// // STEP 3: But when does the collection actually get CREATED?
// // ─────────────────────────────────────────

// // Writing mongoose.model() does NOT immediately create the collection
// // MongoDB is LAZY → it creates the collection only when you INSERT first document

// const newUser = await User.create({ name: 'Arjun', email: 'arjun@gmail.com' });
// //                         ^^^^^^
// //               This is the moment MongoDB ACTUALLY creates:
// //               1. The 'users' collection  (if it doesn't exist)
// //               2. Inserts this document into it


// // ─────────────────────────────────────────
// // STEP 4: What gets stored in MongoDB
// // ─────────────────────────────────────────

// // Your userSchema:
// const userSchema = new mongoose.Schema({
//     name: String,
//     email: String,
// });

// // What MongoDB actually stores (Mongoose adds _id automatically):
// // {
// //     "_id"  : ObjectId("64abc123..."),   ← auto generated unique ID by MongoDB
// //     "name" : "Arjun",
// //     "email": "arjun@gmail.com",
// //     "__v"  : 0                          ← version key, added by Mongoose internally
// // }


// // ─────────────────────────────────────────
// // STEP 5: What if you want a CUSTOM collection name?
// // ─────────────────────────────────────────

// // By default → 'User' becomes 'users'
// // To override this:

// const userSchema = new mongoose.Schema({
//     name: String,
//     email: String,
// }, { collection: 'myCustomName' });  // ← MongoDB will use THIS name instead
// //                ^^^^^^^^^^^^^^
// //             collection in DB will be 'myCustomName' not 'users'


// // ─────────────────────────────────────────
// // FULL PICTURE
// // ─────────────────────────────────────────

// //  mongoose.model('User', userSchema)
// //          │
// //          │  Mongoose does internally:
// //          │
// //          ├─ 1. Registers model with name 'User'
// //          ├─ 2. Pluralizes + lowercases → 'users' (collection name)
// //          ├─ 3. Attaches schema rules (validation, types)
// //          └─ 4. Gives you methods → .find() .create() .findById() etc.
// //                        │
// //                        │  When you actually CALL these methods:
// //                        │
// //                        └─ MongoDB creates collection 'users' if not exists
// //                           and performs the operation (insert/find/update/delete) */

