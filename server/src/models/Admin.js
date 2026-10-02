const { Schema, model } = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
    },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

adminSchema.methods.setPassword = async function (password) {
  this.passwordHash = await bcrypt.hash(password, 12);
};

adminSchema.methods.verifyPassword = function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

module.exports = model('Admin', adminSchema);
