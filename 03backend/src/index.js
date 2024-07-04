// APPROACH 2: Recommended- Create connection func in seperate db folder
import dotenv from "dotenv"
import connectDB from "./db/index.js";
import { app } from "./app.js";

dotenv.config({
    path: './.env'
})

connectDB()
.then(()=>{

    app.on("errror", (error) => {
        console.log("ERRR: ", error);
        throw error
    })
    
    app.listen(process.env.PORT || 8000, ()=>{
        console.log(`Server is running at: ${process.env.PORT}`);
    })
})
.catch((err)=>{
    console.log(`MONGODB connection failed!! ${err}`);
})


/*

APPROACH 1

import express from "express"
const app = express()
( async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("errror", (error) => {
            console.log("ERRR: ", error);
            throw error
        })

        app.listen(process.env.PORT, () => {
            console.log(`App is listening on port ${process.env.PORT}`);
        })

    } catch (error) {
        console.error("ERROR: ", error)
        throw err
    }
})()

*/