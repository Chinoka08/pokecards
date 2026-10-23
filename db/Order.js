const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  debtId: { type: String, unique: true, index: true },
  status: { type: String, enum: ['pending', 'paid', 'cancelled', 'expired', 'error'], default: 'pending' },
  total:  Number,
  label:  String,
  buyer:  { name: String, email: String },
  items:  [{ prodId: String, pokeId: Number, price: Number, qty: Number }],
  paidAt: Date,
  lastNotifyId: String,
}, { timestamps: true });

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);