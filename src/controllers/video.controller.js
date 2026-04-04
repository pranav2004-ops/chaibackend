import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { v2 as cloudinary } from "cloudinary"


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy="createdAt", sortType="desc", userId } = req.query
    //TODO: get all videos based on query, sort, pagination
     const pipeline = []

    // filter by userId if provided
    if (userId) {
        if (!isValidObjectId(userId)) throw new ApiError(400, "Invalid userId")
        pipeline.push({
            $match: { owner: new mongoose.Types.ObjectId(userId) }
        })
    }

    // search by title using regex
    if (query) {
        pipeline.push({
            $match: {
                title: { $regex: query, $options: "i" }  // case insensitive search
            }
        })
    }

    // only return published videos
    pipeline.push({ $match: { isPublished: true } })

    // sort stage
    pipeline.push({
        $sort: { [sortBy]: sortType === "asc" ? 1 : -1 }
    })

    // pagination
    pipeline.push({ $skip: (parseInt(page) - 1) * parseInt(limit) })
    pipeline.push({ $limit: parseInt(limit) })

    // join owner details from users collection
    pipeline.push({
        $lookup: {
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "owner",
            pipeline: [
                { $project: { fullName: 1, username: 1, avatar: 1 } }
            ]
        }
    })

    pipeline.push({ $addFields: { owner: { $first: "$owner" } } })

    const videos = await Video.aggregate(pipeline)

    return res
        .status(200)
        .json(new ApiResponse(200, videos, "Videos fetched successfully"))
})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body
    // TODO: get video, upload to cloudinary, create video

    // validate fields
    if ([title, description].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "Title and description are required")
    }

    // get local temp paths from multer
     const videoLocalPath = req.files?.videoFile?.[0]?.path                               
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path

    if (!videoLocalPath) throw new ApiError(400, "Video file is required")
    if (!thumbnailLocalPath) throw new ApiError(400, "Thumbnail is required")

    // upload to cloudinary
    const videoFile = await uploadOnCloudinary(videoLocalPath)
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)



    if (!videoFile) throw new ApiError(500, "Video upload to Cloudinary failed")
    if (!thumbnail) throw new ApiError(500, "Thumbnail upload to Cloudinary failed")

    // save in MongoDB
    const video = await Video.create({
        videoFile: videoFile.url,
         videoFilePublicId: videoFile.public_id,  // save public_id for later deletion
        thumbnail: thumbnail.url,
        thumbnailPublicId: thumbnail.public_id,  // save public_id for later deletion
        title,
        description,
        duration: videoFile.duration,   // cloudinary returns duration automatically
        owner: req.user._id,            // from verifyJWT
        isPublished: true
    })

    const uploadedVideo = await Video.findById(video._id)
    if (!uploadedVideo) throw new ApiError(500, "Error while saving video to DB")

    return res
        .status(201)
        .json(new ApiResponse(201, uploadedVideo, "Video published successfully"))
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id
     if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid videoId")

    const video = await Video.aggregate([
        {
            $match: { _id: new mongoose.Types.ObjectId(videoId) }
        },
        {
            // join owner info
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    { $project: { fullName: 1, username: 1, avatar: 1 } }
                ]
            }
        },
        {
            $addFields: { owner: { $first: "$owner" } }
        }
    ])

    if (!video?.length) throw new ApiError(404, "Video not found")

    return res
        .status(200)
        .json(new ApiResponse(200, video[0], "Video fetched successfully"))
})


const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: update video details like title, description, thumbnail
       const { title, description } = req.body

    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid videoId")

    // find video
    const video = await Video.findById(videoId)
    if (!video) throw new ApiError(404, "Video not found")

    // only owner can update
    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not allowed to update this video")
    }

    // upload new thumbnail if provided
    let thumbnailUrl = video.thumbnail  // keep old one by default
    // // req.file?.path → the "?" means if no file uploaded, it returns undefined
    const thumbnailLocalPath = req.file?.path   // upload.single() puts it in req.file

    if (thumbnailLocalPath) {
         // this block only runs IF new thumbnail was uploaded
    // if no thumbnail in request → this block is SKIPPED
        const newThumbnail = await uploadOnCloudinary(thumbnailLocalPath)
        if (!newThumbnail) throw new ApiError(500, "Thumbnail upload failed")
        thumbnailUrl = newThumbnail.url
    }

    // update in DB
    // if no new thumbnail → thumbnailUrl still = video.thumbnail (old one)
    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                title,
                description,
                thumbnail: thumbnailUrl //  // ← old thumbnail url saved back, nothing changes...if we did not give new thumnail
            }
        },
        { new: true }   // returns updated doc, not old one
    )

    return res
        .status(200)
        .json(new ApiResponse(200, updatedVideo, "Video updated successfully"))

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video
     if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid videoId")

    const video = await Video.findById(videoId)
    if (!video) throw new ApiError(404, "Video not found")

    // only owner can delete
    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not allowed to delete this video")
    }

  // delete video file from cloudinary
    // resource_type: "video" for .mp4 files
    await cloudinary.uploader.destroy(video.videoFilePublicId, {
        resource_type: "video"
    })

    // delete thumbnail from cloudinary
    // resource_type: "image" for jpg/png files
    await cloudinary.uploader.destroy(video.thumbnailPublicId, {
        resource_type: "image"
    })

    
    // delete from DB
    await Video.findByIdAndDelete(videoId)

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Video deleted successfully"))
})

 const togglePublishStatus = asyncHandler(async (req, res) => {

    // Step 1 — get videoId from URL
    // PATCH /videos/toggle/publish/664abc  → videoId = "664abc"
    const { videoId } = req.params

    // Step 2 — validate it is a real MongoDB ObjectId
    // if someone passes garbage like "abc123" → throw 400
    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid videoId")

    // Step 3 — find the video in DB
    const video = await Video.findById(videoId)
    if (!video) throw new ApiError(404, "Video not found")

    // Step 4 — only owner can toggle
    // req.user._id comes from verifyJWT
    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not allowed to toggle this video")
    }

    // Step 5 — THE MAIN LOGIC — just flip the boolean
    // if isPublished = true  → !true  = false (unpublish)
    // if isPublished = false → !false = true  (publish)
    video.isPublished = !video.isPublished
    await video.save()  // save updated value back to MongoDB

    // Step 6 — return the new status
    return res
        .status(200)
        .json(new ApiResponse(200, { isPublished: video.isPublished }, "Publish status toggled"))
})

// $lookup always returns owner as an array [{...}]
// $first pulls out the first element so owner becomes a clean object {...}

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}

/* get all videos controller explanation:
// Initialize an empty array that will hold all the MongoDB aggregation stages
const pipeline = []

// CONDITIONAL FILTER: Check if userId parameter was provided in the request
if (userId) {
    // Validate if the userId string is a valid MongoDB ObjectId format (24 hex characters)
    if (!isValidObjectId(userId)) throw new ApiError(400, "Invalid userId")
    
    // Add a $match stage to filter documents where the 'owner' field equals the provided userId
    // Convert userId string to MongoDB ObjectId type for proper comparison
    pipeline.push({
        $match: { owner: new mongoose.Types.ObjectId(userId) }
    })
}

// CONDITIONAL SEARCH: Check if a search query string was provided
if (query) {
    // Add another $match stage to filter videos by title using pattern matching
    pipeline.push({
        $match: {
            title: { 
                $regex: query,        // Create a regex pattern from the query string
                $options: "i"         // 'i' flag makes the search case-insensitive (e.g., "Test" matches "test")
            }
        }
    })
}

// PUBLISHED FILTER: Add a $match stage to only include videos where isPublished is true
// This filters out draft/unpublished videos from results
pipeline.push({ $match: { isPublished: true } })

// SORTING: Add a $sort stage to order the results
pipeline.push({
    $sort: { 
        [sortBy]: sortType === "asc" ? 1 : -1  // Use bracket notation for dynamic field name
                                                 // sortBy could be "createdAt", "views", etc.
                                                 // 1 = ascending order, -1 = descending order
    }
})

// PAGINATION - SKIP: Skip the first N documents based on page number
// Formula: (page - 1) * limit
// Example: page=2, limit=10 → skip 10 documents to start from page 2
pipeline.push({ $skip: (parseInt(page) - 1) * parseInt(limit) })

// PAGINATION - LIMIT: Restrict the number of documents returned to the limit value
// parseInt ensures the value is a number (converts string to integer)
pipeline.push({ $limit: parseInt(limit) })

// JOIN OPERATION: Lookup related data from the 'users' collection
pipeline.push({
    $lookup: {
        from: "users",              // The collection to join with (users collection)
        localField: "owner",        // Field from videos collection (the foreign key)
        foreignField: "_id",        // Field from users collection to match against (primary key)
        as: "owner",                // Name of the new array field that will contain matched user documents
        pipeline: [                 // Sub-pipeline to transform the joined user documents
            { 
                $project: {         // Only include specific fields from user document
                    fullName: 1,    // Include fullName field (1 means include)
                    username: 1,    // Include username field
                    avatar: 1       // Include avatar field
                }                   // _id is included by default unless explicitly excluded with _id: 0
            }
        ]
    }
})

// ARRAY TO OBJECT: Convert the 'owner' array (created by $lookup) to a single object
// $lookup returns an array, but we know each video has only one owner
// $first extracts the first element from the array
pipeline.push({ 
    $addFields: { 
        owner: { $first: "$owner" }  // Replace owner array with just the first (and only) element
    } 
})

// EXECUTE AGGREGATION: Run the entire pipeline against the Video collection
// Returns a promise that resolves to an array of video documents matching all criteria
const videos = await Video.aggregate(pipeline)

// SEND RESPONSE: Return HTTP 200 success response with the fetched videos
return res
    .status(200)                                              // Set HTTP status code to 200 (OK)
    .json(new ApiResponse(200, videos, "Videos fetched successfully"))  
    // ApiResponse is likely a custom class that formats the response as:
    // { statusCode: 200, data: videos, message: "Videos fetched successfully" }
*/

/*  togglePublishStatus controller explanation:
YouTube creator flow:

1. publishAVideo → uploads video → isPublished: true by default
   everyone can see it

2. Creator finds a mistake in video
   → hits toggle → isPublished: false
   → video disappears from getAllVideos (because we filter isPublished: true)
   → but video still EXISTS in DB, not deleted

3. Creator fixes the mistake, reuploads thumbnail via updateVideo
   → hits toggle again → isPublished: true
   → video visible again to everyone

Compare with deleteVideo:
   deleteVideo    → gone forever from DB, can't recover
   togglePublish  → just hidden, can bring back anytime



   what it affects :
   // in getAllVideos you have this filter:
pipeline.push({ $match: { isPublished: true } })

// so when isPublished = false
// that video completely disappears from getAllVideos response
// but getVideoById still works if you know the exact _id
// → only the owner can still access it directly

*/

