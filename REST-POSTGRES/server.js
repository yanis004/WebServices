const express = require("express");
const postgres = require("postgres");
const z = require("zod");

const app = express();
const port = 8000;
const sql = postgres({ db: "mydb", user: "user", password: "password" });

app.use(express.json());

// Schemas
const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  about: z.string(),
  price: z.number().positive(),
});
const CreateProductSchema = ProductSchema.omit({ id: true });

// Route Hello World
app.get("/", (req, res) => {
  res.send("Hello World!");
});

// GET tous les produits (avec pagination)
app.get("/products", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const products = await sql`
      SELECT * FROM products 
      LIMIT ${limit} 
      OFFSET ${offset}
    `;
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET un produit par ID
app.get("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const product = await sql`
      SELECT * FROM products WHERE id = ${id}
    `;
    
    if (product.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    res.json(product[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST nouveau produit
app.post("/products", async (req, res) => {
  const result = await CreateProductSchema.safeParse(req.body);

  try {
    if (result.success) {
      const { name, about, price } = result.data;
      
      const product = await sql`
        INSERT INTO products (name, about, price)
        VALUES (${name}, ${about}, ${price})
        RETURNING *
      `;

      res.status(201).json(product[0]);
    } else {
      res.status(400).json({
        error: "Validation failed",
        details: result.error.errors
      });
    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE un produit
app.delete("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedProduct = await sql`
      DELETE FROM products 
      WHERE id = ${id}
      RETURNING *
    `; 
    
    if (deletedProduct.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});