const mongoose = require("mongoose");
require("dotenv").config();



const connectDB = async ()=>{
    try{
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("MongoDB cluster connected successfully");
    }catch(err){
        console.log("An error occured: " + err);
    }
}

module.exports = connectDB;