const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/abb_digital_twin';
    await mongoose.connect(uri);
    console.log('[DB] MongoDB Connected Successfully');
  } catch (err) {
    console.error('[DB] MongoDB Connection Error:', err.message);
    // Don't exit, allow the app to run in-memory if DB fails
  }
};

module.exports = connectDB;
