const { MongoClient } = require('mongodb');

const uri = 'mongodb://localhost:27017';
const client = new MongoClient(uri);

let db;

async function connectDB() {
  await client.connect();
  db = client.db('restapi'); // nom de la base
  console.log('✅ Connexion à MongoDB réussie');
}

function getDB() {
  return db;
}

module.exports = { connectDB, getDB };
