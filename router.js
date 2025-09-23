const {Router} = require("express");
const path = require("path");
require("dotenv").config();
const cookieParser = require("cookie-parser");
const multer = require("multer");
const { ref, uploadBytes, getDownloadURL } = require("firebase/storage");
const { storage } = require(path.join(__dirname, "db", "firebase.js" ));
const {registerUser, signinUser, refreshSignin, authenticateUser, bucket} = require(path.join(__dirname, "utils", "auth.js" ));
const {userModel, bookModel, bookmarkModel} = require(path.join(__dirname, "db", "schema.js"));


const router = Router();

router.use(cookieParser());
const upload = multer({ storage: multer.memoryStorage() });


//Route for registering users

router.post("/register", async (req, res)=>{
    const {idno, email, password} = req.body;
    let userExists = await userModel.findOne({sid: idno});
    console.log('begin');

    if(userExists){
        let response = await registerUser(email, password);

        if(response.success === true){
            try{
                await userModel.findOneAndUpdate(
                    {sid: idno},
                    {$set: {uid: response.user.localId}},
                    { new: true, upsert: false } // don't create new if not found
                );

                return res.status(200).json({success: true, message: "User registered"});
            }catch(err){
                return res.status(500).json({success: false, message: "An error occurred"});
            }
        }
        else{
            return res.status(400).json({success: false, message: response.message});
        }
    }
    else{
        console.log("registration not successful");
        res.status(401).json({success: false, message: "ID number not found"});
    }
})


router.post("/signIn", async (req, res)=>{
   try{
        const {email, password} = req.body;
        console.log('Trying to sign in');
        const response = await signinUser(email, password);

        const{idToken} = response

       res.cookie("token", idToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
        maxAge: 3600000
      });

        res.status(200).json({success: true, message: "signed In"});
   }catch(err){
    console.log(err.message);
    res.status(err.status || 500).json({success: false, message: err.message });
   }
})


router.get("/getUser", authenticateUser, async (req, res)=>{
    try{
        console.log('Trying to get user');
        const {uid} = req.user;
        let user = await userModel.findOne({uid: uid});

        if(!user){
            return res.status(401).json({success: false, message: "User not found, please sign in with correct details"})
        }else{
            return res.status(200).json({success: true, name: user.firstName, role: user.role, id: user.sid, uid: user.uid});
        }
    }catch(err){
        console.log("error in fetching user's details");
        return res.status(500).json({success: false, message: "error, please try again"});
    }
})


router.get("/personalLibrary", authenticateUser, async (req, res)=>{
    try{
        console.log('Trying to get bookmarks');
        const {uid} = req.user;
        let bookmarks = await bookmarkModel.find({uid: uid}).sort({ dateBookmarked: -1 });
        res.json({ success: true, books: bookmarks });
    }catch(err){
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
    }
})


router.get("/browseBooks", authenticateUser, async (req, res)=>{
    try{
        console.log('Browsing books');
        let books = await bookModel.find();
        res.json({ success: true, books: books });
    }catch(err){
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to fetch books" });
    }
})


router.post("/addBookmark", authenticateUser, async (req, res) => {
  const { uid } = req.user;
  const { id, title, author, genre, pages, rating, description, fileUrl} = req.body;
  console.log(req.body);

  try {
    const existing = await bookmarkModel.findOne({ uid, id });
    if (existing) {
      return res.json({ success: true, message: "Already bookmarked" });
    }

    const bookmark = new bookmarkModel({
      uid,
      id,
      title,
      author,
      genre,
      pages,
      rating,
      description,
      dateBookmarked: new Date().toISOString(),
      fileUrl
    });

    await bookmark.save();

    res.json({ success: true, message: "Book bookmarked", bookmark });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
})


router.post("/removeBookmark", authenticateUser, async (req, res) => {
  try {
    const { uid } = req.user;
    const { id } = req.body; 

    await bookmarkModel.findOneAndDelete({ uid, id });
    res.json({ success: true, message: "Book removed from bookmarks" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.put("/editBooks", async (req, res) => {
  try {
    const { id, ...updateData } = req.body; 

    if (!id) return res.status(400).json({ message: "Book ID is required" });

    const updatedBook = await bookModel.findOneAndUpdate(
      { id: id },
      updateData,    
      { new: true, runValidators: true }
    );

    if (!updatedBook) return res.status(404).json({ message: "Book not found" });

    res.json(updatedBook);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


router.delete("/deleteBooks", async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: "Book ID is required" });
    }

    const deletedBook = await bookModel.findOneAndDelete({ id: id });

    if (!deletedBook) {
      return res.status(404).json({ success: false, message: "Book not found" });
    }

    res.json({ success: true, message: "Book deleted successfully", deletedBook });
  } catch (err) {
    console.error("Error deleting book:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/upload", upload.single("file"), 
async (req, res) => {
   try {
      const { id, title, author, genre, publishedYear, language, pages, description, tags } = req.body;


      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const existing = await bookModel.findOne({ title });
      
      if (existing) {
        return res.json({ success: true, message: "This file already exists" });
      }

      const blob = bucket.file(`books/${Date.now()}-${req.file.originalname}`);
      const blobStream = blob.createWriteStream({
        metadata: {
          contentType: req.file.mimetype,
        },
      });

      blobStream.on("error", (err) => {
        console.error("Upload error:", err);
        res.status(500).json({ error: "Failed to upload file" });
      });

      blobStream.on("finish", async () => {
        // Make file public OR generate signed URL
        const [fileUrl] = await blob.getSignedUrl({
          action: "read",
          expires: "03-09-2030",
        });

        // Save metadata in MongoDB
        const newBook = new bookModel({
          id,
          title,
          author,
          genre,
          publishedYear,
          language,
          pages,
          description,
          tags: tags ? tags.split(",") : [],
          fileUrl,
        });

        await newBook.save();
        console.log(newBook);

        res.status(201).json({ message: "Book uploaded successfully", book: newBook });
      });
      blobStream.end(req.file.buffer);
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to upload book" });
    }
  }
);



router.post("/addUser", async (req, res) => {
  try {
    console.log('adding user')
    console.log(req.body);
    const user = new userModel(req.body)
    await user.save()
    res.status(201).json({success: true, user: user})
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})



router.get("/users", async (req, res) => {
  try {
    const users = await userModel.find();

    // Normalize each user
    const normalizedUsers = users.map(userData => ({
      sid: userData.sid?.toString() ?? Date.now().toString(),
      role: (userData.role ?? "student").toLowerCase(),  // always string
      firstName: userData.firstName ?? userData.name?.split(" ")[0] ?? " ",
      lastName: userData.lastName ?? userData.name?.split(" ")[1] ?? " ",
      email: userData.email ?? "@",
      phone: userData.phone ?? "",
      department: userData.department ?? " ",
      major: userData.major ?? " ",
      enrollmentDate: userData.enrollmentDate ?? new Date().toISOString(),
      lastLogin: userData.lastLogin ?? "not available",
    }));

    res.status(200).json(normalizedUsers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
})



router.put("/updateUser", async (req, res) => {
  try {
    console.log("updating");
    const { sid, ...updates } = req.body
    if (!sid) {
      return res.status(400).json({ error: "sid is required" })
    }

    console.log(updates);

    const user = await userModel.findOneAndUpdate(
      { sid },         // find by sid
      updates,         // apply updates
      { new: true }    // return the updated user
    )

    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    res.json(user)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})



router.delete("/deleteUser", async (req, res) => {
  try {
    const { sid } = req.body;
    if (!sid) {
      return res.status(400).json({ error: "sid is required" });
    }

    const deletedUser = await userModel.findOneAndDelete({ sid });
    if (!deletedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ success: true, message: "User deleted", user: deletedUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router; 

      