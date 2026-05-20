require('dotenv').config();
const mongoose = require('mongoose');
const Alert = require('../models/Alert');

async function main() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/weapon-detection';
  await mongoose.connect(uri);

  const counts = await Alert.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  console.log('Status counts:', counts);

  const recent = await Alert.find({ status: { $in: ['accepted', 'dismissed', 'resolved'] } })
    .sort({ updatedAt: -1 })
    .limit(3)
    .lean();

  console.log('Recent handled:', recent.map(a => ({
    id: a._id,
    status: a.status,
    assignedTo: a.assignedTo,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  })));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
