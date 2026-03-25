 

import dotenv from "dotenv";
dotenv.config();

import connectDB from './db/index.js';
 

connectDB();



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
