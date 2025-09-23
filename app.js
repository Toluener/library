const express = require("express");
const path = require("path");
const router = require(path.join(__dirname, "router.js"));
const connectDB = require(path.join(__dirname, "db", "connection.js"));
const cors = require("cors");



const app = express();

//setting up cors
app.use(cors({
    origin: "http://localhost:3000",
    credentials: true
}));

app.options("*", cors({
  origin: "http://localhost:3000",
  credentials: true
}));

app.use(express.json());


//Using router
app.use(router);

//connecting to mongoDB database
connectDB();

const PORT = process.env.PORT || 6001;



//assigning the server a port to listen for requests
app.listen(PORT, ()=>{
    console.log("Server is running");
})