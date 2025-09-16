// backend/migrate_dates.js
const mongoose = require("mongoose");

const mongoURL = "mongodb://localhost:27018/noaa_database";

async function migrateDates() {
  await mongoose.connect(mongoURL);
  console.log("✅ Connected to MongoDB");

  const collection = mongoose.connection.collection("forecast_lstm_27day");

  const docs = await collection.find({}).toArray();
  console.log(`Found ${docs.length} documents.`);

  for (const doc of docs) {
    if (typeof doc.date === "string") {
      const newDate = new Date(doc.date);
      if (!isNaN(newDate)) {
        await collection.updateOne(
          { _id: doc._id },
          { $set: { date: newDate } }
        );
        console.log(`Updated ${doc.date} → ${newDate.toISOString()}`);
      }
    }
  }

  console.log("✅ Migration complete!");
  await mongoose.disconnect();
}

migrateDates().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
