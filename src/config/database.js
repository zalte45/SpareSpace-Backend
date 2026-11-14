
import mongoose from "mongoose";
import config from "./config.js";
import dns from "node:dns";

// Use public DNS resolvers to resolve MongoDB Atlas SRV records
dns.setServers(["1.1.1.1", "8.8.8.8"]);

async function connectDB() {
  try {
    await mongoose.connect(config.MONGO_URI);
    console.log("✅ MongoDB Connected");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error.message || error);
    process.exit(1);
  }
}

export default connectDB;


