// Importation des modules nécessaires
const express = require("express");
const postgres = require("postgres");
const z = require("zod");
const crypto = require("crypto");

// Initialisation de l'application Express
const app = express();
const port = 8000;

// Configuration de la connexion à PostgreSQL
const sql = postgres({
  host: "localhost",
  port: 5450,
  database: "mydb",
  username: "user",
  password: "password",
  ssl: false,
});

// Middleware pour lire le JSON reçu dans les requêtes
app.use(express.json());

// Schéma de validation pour un utilisateur
const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  password: z.string(),
  email: z.string().email(),
});

const CreateUserSchema = UserSchema.omit({ id: true });
const UpdateUserSchema = UserSchema.omit({ id: true, password: true }).partial();

// Route PUT pour mettre à jour un utilisateur (remplace toute la ressource)
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

// Route PATCH pour mettre à jour partiellement un utilisateur
app.patch("/users/:id", async (req, res) => {
  const userId = req.params.id;
  const result = UpdateUserSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ error: "Données invalides", details: result.error });
  }

  const updates = Object.entries(result.data).map(([key, value]) => `${key} = '${value}'`).join(", ");

  if (updates.length === 0) {
    return res.status(400).json({ error: "Aucune donnée à mettre à jour" });
  }

  try {
    const user = await sql`
      UPDATE users
      SET ${sql.raw(updates)}
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

app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});