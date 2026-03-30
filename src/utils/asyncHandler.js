 const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next))
        .catch((err) => next(err))
    }
}

export { asyncHandler }


/*With asyncHandler — no try/catch needed, it handles it automatically! 🎉
// asyncHandler is a function that TAKES another function as input
// const asyncHandler = (requestHandler) => {

//     // It RETURNS a new function with req, res, next (standard Express params)
//     return (req, res, next) => {

//         // Call your async function and wrap it in a Promise
//         Promise.resolve(requestHandler(req, res, next))

//         // If any error occurs inside your async function, catch it here
//         // and pass it to Express error handler via next(err)
//         .catch((err) => next(err))
//     }
// }

// export { asyncHandler }
// ```

// ---

// ## Real World Flow
// ```
// You write an async route function
//         ↓
// Wrap it with asyncHandler(yourFunction)
//         ↓
// asyncHandler calls your function inside Promise.resolve()
//         ↓
// If SUCCESS → res.json() sends response normally
//         ↓
// If ERROR  → .catch() catches it → next(err) → Express error handler */




// const asyncHandler = () => {}
// const asyncHandler = (func) => () => {}
// const asyncHandler = (func) => async () => {}


// const asyncHandler = (fn) => async (req, res, next) => {
//     try {
//         await fn(req, res, next)
//     } catch (error) {
//         res.status(err.code || 500).json({
//             success: false,
//             message: err.message
//         })
//     }
// }


