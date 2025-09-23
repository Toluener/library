const axios = require("axios");
require("dotenv").config();
const path = require("path");
const admin = require("firebase-admin");
const serviceAccount =  require(path.join(__dirname, "serviceAccountKey.json"));


if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_SB
  });
  console.log("Admin initialised");
}else{
    console.log("Error initialising Admin");
}

const bucket = admin.storage().bucket();



const registerUser = async (email, password)=>{
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${process.env.FIREBASE_APIKEY}`;

    try{
        const response = await axios.post(url, {
        email: email,
        password: password,
        returnSecureToken: true
    });

    return {
      success: true,
      user: response.data
    };
    }catch(err){
        if (err.response && err.response.data && err.response.data.error) {
            const errorMessage = err.response.data.error.message;

            console.error("Error registering user:", errorMessage);

            // Map Firebase errors to user-friendly messages
            let friendlyMessage;
            switch (errorMessage) {
                case "INVALID_EMAIL":
                    friendlyMessage = "Invalid email format.";
                break;
                case "EMAIL_EXISTS":
                    friendlyMessage = "Email is already registered.";
                break;
                case "WEAK_PASSWORD : Password should be at least 6 characters":
                    friendlyMessage = "Password should be at least 6 characters long.";
                break;
                default:
                    friendlyMessage = "Something went wrong. Please try again.";
            }

            return {
                success: false,
                message: friendlyMessage,
                error: errorMessage,
            };
    } else {
      console.error("Unexpected error:", err.message);
      return {
        success: false,
        message: "Unexpected error occurred.",
        error: err.message,
      };
    }
    }
}


const signinUser = async (email, password)=>{
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_APIKEY}`;

    try{
        const response = await axios.post(url,{
            email: email,
            password: password,
            returnSecureToken: true
        });
        return response.data;
    }catch(err){
        if (err.response && err.response.data && err.response.data.error) {
            const errorCode = err.response.data.error.message;

            switch (errorCode) {
                    case "EMAIL_NOT_FOUND":
                    throw { status: 404, message: "Email not registered" };
                    case "INVALID_PASSWORD":
                    throw { status: 401, message: "Incorrect password" };
                    case "INVALID_EMAIL":
                    throw { status: 400, message: "Invalid email format" };
                    case "USER_DISABLED":
                    throw { status: 403, message: "User account disabled" };
                    default:
                    throw { status: 500, message: "Something went wrong" };
            }
        } else {
      throw { status: 500, message: "Unexpected error" };
        }
    }
}

const refreshSignin = async (refreshToken)=>{
    const url = `https://securetoken.googleapis.com/v1/token?key=${process.env.FIREBASE_APIKEY}`;

    try{
        const response = await axios.post(url, {
            grant_type: "refresh_token",
            refresh_token: refreshToken
        });

        console.log("Refresh sucessful");
        return response;
    }catch(err){
        console.log("Error with refreshing sign-in: " + err);
    }
}

const authenticateUser = async (req, res, next) => {
    try {
        const token = req.cookies.token;

        if (!token) {
        return res.status(401).json({ success: false, message: "No token, unauthorized" });
        }

        // verify with Firebase
        const decoded = await admin.auth().verifyIdToken(token);
        req.user = decoded; // attach user info to request
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
};


module.exports = {registerUser, signinUser, refreshSignin, authenticateUser, bucket};