const mongoose = require('mongoose');
const dotenv = require('dotenv');

const Alert = require('../models/Alert');
const Detection = require('../models/Detection');
const Notification = require('../models/Notification');

dotenv.config();

const DEFAULT_USER_ID = '69a2877f7d60be32de95d611';

const run = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is not set');
  }

  await mongoose.connect(mongoUri);

  const userId = new mongoose.Types.ObjectId(DEFAULT_USER_ID);
  const missingUserQuery = { $or: [{ userId: { $exists: false } }, { userId: null }] };

  const alertResult = await Alert.updateMany(missingUserQuery, { $set: { userId } });
  const detectionResult = await Detection.updateMany(missingUserQuery, { $set: { userId } });
  const notificationResult = await Notification.updateMany(missingUserQuery, { $set: { userId } });

  console.log('Backfill complete');
  console.log('Alerts matched:', alertResult.matchedCount, 'modified:', alertResult.modifiedCount);
  console.log('Detections matched:', detectionResult.matchedCount, 'modified:', detectionResult.modifiedCount);
  console.log('Notifications matched:', notificationResult.matchedCount, 'modified:', notificationResult.modifiedCount);

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error('Backfill failed:', error.message);
  process.exitCode = 1;
});
