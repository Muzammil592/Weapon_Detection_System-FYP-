/**
 * Prune oldest 75% of documents from Alert, Notification, and Detection collections.
 *
 * Dry run:
 *   node scripts/pruneAlertNotificationDetection75.js
 *
 * Apply changes:
 *   node scripts/pruneAlertNotificationDetection75.js --apply
 */

require('dotenv').config();
const mongoose = require('mongoose');

const Alert = require('../models/Alert');
const Notification = require('../models/Notification');
const Detection = require('../models/Detection');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/weapon-detection';
const APPLY_CHANGES = process.argv.includes('--apply') || process.argv.includes('--force');

const TARGETS = [
  { name: 'alerts', Model: Alert },
  { name: 'notifications', Model: Notification },
  { name: 'detections', Model: Detection },
];

async function pruneModel(name, Model) {
  const totalBefore = await Model.countDocuments({});
  const plannedDelete = Math.floor(totalBefore * 0.75);

  if (totalBefore === 0 || plannedDelete <= 0) {
    console.log(`➡️  [${name}] skipped (total=${totalBefore}, plannedDelete=${plannedDelete}).`);
    return {
      name,
      totalBefore,
      plannedDelete,
      selectedForDelete: 0,
      deleted: 0,
      totalAfter: totalBefore,
      mode: APPLY_CHANGES ? 'LIVE' : 'DRY',
    };
  }

  const hasCreatedAt = Boolean(Model.schema?.paths?.createdAt);
  const sort = hasCreatedAt ? { createdAt: 1, _id: 1 } : { _id: 1 };

  const docs = await Model.find({})
    .sort(sort)
    .limit(plannedDelete)
    .select('_id')
    .lean();

  const ids = docs.map((d) => d._id);

  if (!APPLY_CHANGES) {
    console.log(`🔎 [${name}] DRY-RUN total=${totalBefore}, plannedDelete=${plannedDelete}, selected=${ids.length}.`);
    return {
      name,
      totalBefore,
      plannedDelete,
      selectedForDelete: ids.length,
      deleted: 0,
      totalAfter: totalBefore,
      mode: 'DRY',
    };
  }

  const deleteResult = await Model.deleteMany({ _id: { $in: ids } });
  const deleted = deleteResult.deletedCount || 0;
  const totalAfter = await Model.countDocuments({});

  console.log(`✅ [${name}] totalBefore=${totalBefore}, deleted=${deleted}, totalAfter=${totalAfter}.`);

  return {
    name,
    totalBefore,
    plannedDelete,
    selectedForDelete: ids.length,
    deleted,
    totalAfter,
    mode: 'LIVE',
  };
}

async function main() {
  console.log('==============================================');
  console.log(' Prune oldest 75%: alerts, notifications, detections');
  console.log('==============================================');
  console.log(`Mode: ${APPLY_CHANGES ? 'LIVE (WILL DELETE)' : 'DRY-RUN (NO DELETE)'}`);
  console.log(`Mongo URI: ${MONGO_URI}`);

  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
    });

    console.log('✅ Connected to MongoDB.');

    const results = [];
    for (const target of TARGETS) {
      const summary = await pruneModel(target.name, target.Model);
      results.push(summary);
    }

    console.log('\n================ SUMMARY ================');
    for (const r of results) {
      console.log(
        `- ${r.name}: mode=${r.mode}, totalBefore=${r.totalBefore}, plannedDelete=${r.plannedDelete}, selected=${r.selectedForDelete}, deleted=${r.deleted}, totalAfter=${r.totalAfter}`
      );
    }
    console.log('=========================================');
  } catch (err) {
    console.error('❌ Fatal error:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
  }
}

main();
