/**
 * Maintenance script to prune old data from MongoDB collections.
 *
 * By default this runs in DRY-RUN mode and only reports how many
 * documents would be deleted from each collection.
 *
 * To actually delete data, run with the --apply flag, e.g.:
 *   node scripts/pruneData.js --apply
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Load models
const Alert = require('../models/Alert');
const Authority = require('../models/Authority');
const Detection = require('../models/Detection');
const Notification = require('../models/Notification');
const Stats = require('../models/Stats');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/weapon-detection';

const APPLY_CHANGES = process.argv.includes('--apply') || process.argv.includes('--force');

const COLLECTIONS = [
  { name: 'Alert', Model: Alert },
  { name: 'Detection', Model: Detection },
  { name: 'Notification', Model: Notification },
  { name: 'User', Model: User },
  { name: 'Authority', Model: Authority },
  { name: 'Stats', Model: Stats },
];

async function pruneCollection({ name, Model }) {
  const total = await Model.estimatedDocumentCount();

  if (!total || total <= 1) {
    console.log(`➡️  [${name}] Skipping (documents: ${total}).`);
    return { name, total, toDelete: 0, deleted: 0 };
  }

  const toDelete = Math.floor(total * 0.75);
  if (toDelete <= 0) {
    console.log(`➡️  [${name}] Nothing to delete (total: ${total}).`);
    return { name, total, toDelete: 0, deleted: 0 };
  }

  // Detect a reasonable sort field for "oldest" documents
  const schema = Model.schema;
  let sortField = '_id';
  if (schema.paths && schema.paths.createdAt) {
    sortField = 'createdAt';
  } else if (schema.paths && schema.paths.updatedAt) {
    sortField = 'updatedAt';
  }

  console.log(`
📊 [${name}] total=${total}, planned delete=${toDelete}, sortField=${sortField}`);

  // Find the oldest documents to delete
  const docs = await Model.find({})
    .sort({ [sortField]: 1 })
    .limit(toDelete)
    .select('_id')
    .lean();

  const ids = docs.map((d) => d._id);

  if (!APPLY_CHANGES) {
    console.log(`🔎 [${name}] DRY-RUN: would delete ${ids.length} documents.`);
    return { name, total, toDelete: ids.length, deleted: 0 };
  }

  if (ids.length === 0) {
    console.log(`➡️  [${name}] No documents selected for deletion.`);
    return { name, total, toDelete: 0, deleted: 0 };
  }

  const result = await Model.deleteMany({ _id: { $in: ids } });
  const deleted = result.deletedCount || 0;
  console.log(`✅ [${name}] Deleted ${deleted} documents.`);

  return { name, total, toDelete: ids.length, deleted };
}

async function main() {
  console.log('==============================================');
  console.log(' MongoDB Prune Script - Remove ~75% old data');
  console.log('==============================================');
  console.log(`Mode: ${APPLY_CHANGES ? 'LIVE (WILL DELETE DATA)' : 'DRY-RUN (NO DATA DELETED)'}`);
  console.log(`Mongo URI: ${MONGO_URI}`);

  if (!APPLY_CHANGES) {
    console.log('\n⚠️  This is a DRY-RUN. To actually delete, re-run with --apply.');
  } else {
    console.log('\n⚠️  LIVE MODE: Data will be deleted from collections listed below.');
  }

  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
    });

    console.log('\n✅ Connected to MongoDB.');

    const summaries = [];
    for (const entry of COLLECTIONS) {
      try {
        const summary = await pruneCollection(entry);
        summaries.push(summary);
      } catch (err) {
        console.error(`❌ Error pruning collection [${entry.name}]:`, err.message);
      }
    }

    console.log('\n================ SUMMARY ================');
    for (const s of summaries) {
      console.log(`- ${s.name}: total=${s.total}, planned=${s.toDelete}, deleted=${s.deleted}`);
    }
    console.log('=========================================');
  } catch (err) {
    console.error('❌ Fatal error in prune script:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB.');
  }
}

main();
