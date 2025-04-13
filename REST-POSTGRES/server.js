const express = require("express");
const postgres = require("postgres");
const z = require("zod");
const crypto = require("crypto");
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./swaggerConfig');

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const app = express();
const port = 8000;

const sql = postgres({
  host: "localhost",
  port: 5450,
  database: "mydb",
  username: "user",
  password: "password",
  ssl: false,
});

const F2P_API_BASE_URL = "https://www.freetogame.com/api";

app.use(express.json());

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  password: z.string(),
  email: z.string().email(),
});

const CreateUserSchema = UserSchema.omit({ id: true });
const UpdateUserSchema = UserSchema.omit({ id: true, password: true }).partial();

const OrderSchema = z.object({
  id: z.string(),
  userId: z.string(),
  productIds: z.array(z.string()),
  total: z.number(),
  payment: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const CreateOrderSchema = OrderSchema.omit({ 
  id: true, 
  total: true, 
  createdAt: true, 
  updatedAt: true 
});

const UpdateOrderSchema = z.object({
  productIds: z.array(z.string()).optional(),
  payment: z.boolean().optional(),
});

const ReviewSchema = z.object({
  id: z.string(),
  userId: z.string(),
  productId: z.string(),
  score: z.number().min(1).max(5),
  content: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const CreateReviewSchema = ReviewSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

const UpdateReviewSchema = z.object({
  score: z.number().min(1).max(5).optional(),
  content: z.string().optional(),
});

async function calculateTotal(productIds) {

  try {
    const products = await sql`
      SELECT price FROM products 
      WHERE id IN ${sql(productIds)}
    `;
    
    const subtotal = products.reduce((sum, product) => sum + parseFloat(product.price), 0);
    const total = subtotal * 1.2; // TVA 20%
    
    return parseFloat(total.toFixed(2));
  } catch (error) {
    console.error("Erreur lors du calcul du total:", error);
    throw error;
  }
}

app.put("/users/:id", async (req, res) => {
  const userId = req.params.id;
  const result = CreateUserSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ error: "Données invalides", details: result.error });
  }

  const { name, password, email } = result.data;
  const hashedPassword = crypto.createHash("sha512").update(password).digest("hex");

  try {
    const user = await sql`
      UPDATE users
      SET name = ${name}, password = ${hashedPassword}, email = ${email}
      WHERE id = ${userId}
      RETURNING id, name, email
    `;

    if (user.length === 0) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    res.json(user[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur lors de la mise à jour de l'utilisateur" });
  }
});

app.patch("/users/:id", async (req, res) => {
  const userId = req.params.id;
  const result = UpdateUserSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ error: "Données invalides", details: result.error });
  }
  const updateData = result.data;
  
  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ error: "Aucune donnée à mettre à jour" });
  }

  let updateQuery = sql`UPDATE users SET `;
  let setClauses = [];
  
  if (updateData.name !== undefined) {
    setClauses.push(sql`name = ${updateData.name}`);
  }
  
  if (updateData.email !== undefined) {
    setClauses.push(sql`email = ${updateData.email}`);
  }
  
  updateQuery = sql`${updateQuery} ${sql.join(setClauses, sql`, `)} WHERE id = ${userId} RETURNING id, name, email`;

  try {
    const user = await updateQuery;

    if (user.length === 0) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    res.json(user[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur lors de la mise à jour de l'utilisateur" });
  }
});

app.get("/f2p-games", async (req, res) => {
  try {

    const { platform, category, sort } = req.query;
    
    let apiUrl = `${F2P_API_BASE_URL}/games`;
    const params = new URLSearchParams();
    
    if (platform) params.append('platform', platform);
    if (category) params.append('category', category);
    if (sort) params.append('sort-by', sort);
    
    if (params.toString()) {
      apiUrl += `?${params.toString()}`;
    }
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`FreeToGame API responded with status: ${response.status}`);
    }
    
    const games = await response.json();
    
    res.json(games);
  } catch (error) {
    console.error("Erreur lors de la récupération des jeux F2P:", error);
    res.status(500).json({ 
      error: "Erreur lors de la récupération des jeux free-to-play",
      details: error.message
    });
  }
});

app.get("/f2p-games/:id", async (req, res) => {
  const gameId = req.params.id;
  
  try {

    if (isNaN(parseInt(gameId))) {
      return res.status(400).json({ error: "L'ID du jeu doit être un nombre" });
    }

    const response = await fetch(`${F2P_API_BASE_URL}/game?id=${gameId}`);
    
    if (!response.ok) {

      if (response.status === 404) {
        return res.status(404).json({ error: "Jeu non trouvé" });
      }
      throw new Error(`FreeToGame API responded with status: ${response.status}`);
    }
    
    const game = await response.json();
    
    if (!game || game.status === 0) {
      return res.status(404).json({ error: "Jeu non trouvé" });
    }
    
    res.json(game);
  } catch (error) {
    console.error(`Erreur lors de la récupération du jeu F2P #${gameId}:`, error);
    res.status(500).json({ 
      error: "Erreur lors de la récupération du jeu free-to-play",
      details: error.message
    });
  }
});

app.post("/orders", async (req, res) => {
  const result = CreateOrderSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ error: "Données invalides", details: result.error });
  }

  const { userId, productIds } = result.data;

  try {
    const total = await calculateTotal(productIds);
    const createdAt = new Date().toISOString();
    const updatedAt = createdAt;

    const order = await sql`
      INSERT INTO orders (user_id, product_ids, total, payment, created_at, updated_at)
      VALUES (${userId}, ${sql.array(productIds)}, ${total}, false, ${createdAt}, ${updatedAt})
      RETURNING id, user_id, product_ids, total, payment, created_at, updated_at
    `;

    res.status(201).json(order[0]);
  } catch (error) {
    console.error("Erreur lors de la création de la commande:", error);
    res.status(500).json({ error: "Erreur lors de la création de la commande" });
  }
});

app.get("/orders", async (req, res) => {
  try {
    const orders = await sql`
      SELECT * FROM orders
    `;
    res.json(orders);
  } catch (error) {
    console.error("Erreur lors de la récupération des commandes:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des commandes" });
  }
});

app.get("/orders/:id", async (req, res) => {
  const orderId = req.params.id;

  try {
    const order = await sql`
      SELECT * FROM orders WHERE id = ${orderId}
    `;

    if (order.length === 0) {
      return res.status(404).json({ error: "Commande non trouvée" });
    }

    res.json(order[0]);
  } catch (error) {
    console.error("Erreur lors de la récupération de la commande:", error);
    res.status(500).json({ error: "Erreur lors de la récupération de la commande" });
  }
});

app.put("/orders/:id", async (req, res) => {
  const orderId = req.params.id;
  const result = UpdateOrderSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ error: "Données invalides", details: result.error });
  }

  const updateData = result.data;
  const updatedAt = new Date().toISOString();

  try {
    const order = await sql`
      UPDATE orders
      SET product_ids = COALESCE(${sql.array(updateData.productIds)}, product_ids),
          payment = COALESCE(${updateData.payment}, payment),
          updated_at = ${updatedAt}
      WHERE id = ${orderId}
      RETURNING id, user_id, product_ids, total, payment, created_at, updated_at
    `;

    if (order.length === 0) {
      return res.status(404).json({ error: "Commande non trouvée" });
    }

    res.json(order[0]);
  } catch (error) {
    console.error("Erreur lors de la mise à jour de la commande:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour de la commande" });
  }
});

app.delete("/orders/:id", async (req, res) => {
  const orderId = req.params.id;

  try {
    const result = await sql`
      DELETE FROM orders WHERE id = ${orderId}
      RETURNING id
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: "Commande non trouvée" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Erreur lors de la suppression de la commande:", error);
    res.status(500).json({ error: "Erreur lors de la suppression de la commande" });
  }
});

app.post("/reviews", async (req, res) => {
  const result = CreateReviewSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ error: "Données invalides", details: result.error });
  }

  const { userId, productId, score, content } = result.data;
  const createdAt = new Date().toISOString();
  const updatedAt = createdAt;

  try {
    const review = await sql`
      INSERT INTO reviews (user_id, product_id, score, content, created_at, updated_at)
      VALUES (${userId}, ${productId}, ${score}, ${content}, ${createdAt}, ${updatedAt})
      RETURNING id, user_id, product_id, score, content, created_at, updated_at
    `;

    await sql`
      UPDATE products
      SET review_ids = array_append(review_ids, ${review[0].id}),
          total_score = total_score + ${score}
      WHERE id = ${productId}
    `;

    res.status(201).json(review[0]);
  } catch (error) {
    console.error("Erreur lors de la création de l'avis:", error);
    res.status(500).json({ error: "Erreur lors de la création de l'avis" });
  }
});

app.get("/reviews", async (req, res) => {
  try {
    const reviews = await sql`
      SELECT * FROM reviews
    `;
    res.json(reviews);
  } catch (error) {
    console.error("Erreur lors de la récupération des avis:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des avis" });
  }
});

app.get("/reviews/:id", async (req, res) => {
  const reviewId = req.params.id;

  try {
    const review = await sql`
      SELECT * FROM reviews WHERE id = ${reviewId}
    `;

    if (review.length === 0) {
      return res.status(404).json({ error: "Avis non trouvé" });
    }

    res.json(review[0]);
  } catch (error) {
    console.error("Erreur lors de la récupération de l'avis:", error);
    res.status(500).json({ error: "Erreur lors de la récupération de l'avis" });
  }
});

app.put("/reviews/:id", async (req, res) => {
  const reviewId = req.params.id;
  const result = UpdateReviewSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ error: "Données invalides", details: result.error });
  }

  const updateData = result.data;
  const updatedAt = new Date().toISOString();

  try {
    const review = await sql`
      UPDATE reviews
      SET score = COALESCE(${updateData.score}, score),
          content = COALESCE(${updateData.content}, content),
          updated_at = ${updatedAt}
      WHERE id = ${reviewId}
      RETURNING id, user_id, product_id, score, content, created_at, updated_at
    `;

    if (review.length === 0) {
      return res.status(404).json({ error: "Avis non trouvé" });
    }

    res.json(review[0]);
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'avis:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour de l'avis" });
  }
});

app.delete("/reviews/:id", async (req, res) => {
  const reviewId = req.params.id;

  try {
    const result = await sql`
      DELETE FROM reviews WHERE id = ${reviewId}
      RETURNING id
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: "Avis non trouvé" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Erreur lors de la suppression de l'avis:", error);
    res.status(500).json({ error: "Erreur lors de la suppression de l'avis" });
  }
});

app.get("/products/:id", async (req, res) => {
  const productId = req.params.id;

  try {
    const product = await sql`
      SELECT * FROM products WHERE id = ${productId}
    `;

    if (product.length === 0) {
      return res.status(404).json({ error: "Produit non trouvé" });
    }

    const reviews = await sql`
      SELECT * FROM reviews WHERE product_id = ${productId}
    `;

    res.json({ ...product[0], reviews });
  } catch (error) {
    console.error("Erreur lors de la récupération du produit:", error);
    res.status(500).json({ error: "Erreur lors de la récupération du produit" });
  }
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});