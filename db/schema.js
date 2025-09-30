const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    sid: String,
    uid: String,
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    role: String,
    department: String,
    major: String,
    enrollmentDate: String
});

const userModel = mongoose.model("user", userSchema, "user");



const bookSchema = new mongoose.Schema({
  id: String,
  title: String,
  author: String,
  genre: String,
  description: String,
  publishedYear: Number,
  pages: Number,
  language: String,
  date: {
    type: String,
    default: () => {
      const today = new Date()
      return today.toISOString().split("T")[0] 
    }
  },
  tags: {
    type: [String],
    default: []
  },
  fileUrl: String
})


const bookModel = mongoose.model("book", bookSchema, "books");



const bookmarkSchema = new mongoose.Schema({
    title: String,
    id: String,
    uid: String,
    author: String,
    publishedYear: Number,
    genre: String,
    pages: Number,
    fileUrl: String,
    dateBookmarked: String,
    description: String,
    language: String,
    tags: {
    type: [String],
    default: []
  }
})

const bookmarkModel = mongoose.model("bookmark", bookmarkSchema, "bookmarks");

module.exports = {userModel, bookModel, bookmarkModel};