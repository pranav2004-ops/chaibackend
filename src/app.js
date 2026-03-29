import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

// routes import 
import userRouter from './routes/user.routes.js'

const app = express();

//  use app.use(),,, to add middlewares and routes to the app or set the configurations  

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

export {app};




// In ES Modules, import statements are always hoisted — but keeping them at the
//  top is the correct pattern and ensures everything is registered before routes are declared.