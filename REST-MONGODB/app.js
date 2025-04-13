const express = require('express');
const { connectDB, getDB } = require('./db/mongo');
const app = express();

app.use(express.json());

// Exemple de route GET all
app.get('/products', async (req, res) => {
  const db = getDB();
  const products = await db.collection('products').find().toArray();
  res.json(products);
});

// Lancer le serveur
connectDB().then(() => {
  app.listen(3000, () => {
    console.log('🚀 Serveur lancé sur http://localhost:3000');
  });
}).catch((err) => {
  console.error('Erreur de connexion MongoDB', err);
});
