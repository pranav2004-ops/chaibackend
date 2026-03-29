//  use app.use(),,, to add middlewares and routes to the app or set the configurations  

import connectDB from './db/index.js';
 import {app} from './app.js';
 
import dotenv from "dotenv";
 dotenv.config({
    path: './.env'
})
 


connectDB()

.then(() => {
app.listen(process.env.PORT || 8000, () => {
  console.log(`Server is running on port ${process.env.PORT}`)
})
})
.catch((err) =>{
  console.error(' Mongo DB connection failed !!', err);
})






/*
import express from 'express';
const app = express();

  (async () => {
    try {
    await mongooose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
    app.on('error', (err) => {  
      console.error('Error starting the server', err)
        throw err
    })
    app.listen(process.env.PORT, () => {console.log(`Server is running on port ${process.env.PORT}`)
    })
}
    catch (error) {
        console.error('Error connecting to MongoDB', error)
        throw err
    } 
  })()





*/
