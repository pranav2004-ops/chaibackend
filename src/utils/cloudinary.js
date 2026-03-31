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