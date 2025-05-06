import { MongoClient } from "mongodb";

let db;

export async function connectToDB() {
  const uri = process.env.MONGODB_URI;
  console.log("✅ MONGODB_URI from connectToDB:", uri);

  if (!db) {
    const client = new MongoClient(uri);
    await client.connect();
    db = client.db();
  }

  return db;
}
