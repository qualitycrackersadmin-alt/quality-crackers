const mongoose = require('mongoose');
const { mongoUri } = require('./env');

async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
  console.log(`MongoDB connected: ${mongoose.connection.name}`);
}

module.exports = connectDB;
