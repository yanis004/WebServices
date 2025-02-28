const soap = require("soap");
const fs = require("fs");
const http = require("http");
const postgres = require("postgres");

const sql = postgres({
  db: "mydb",
  user: "user",
  password: "password",
  host: "localhost",
  port: 5450,
});

const service = {
  ProductsService: {
    ProductsPort: {
      // Opération de création de produit
      CreateProduct: async function ({ name, about, price }, callback) {
        if (!name || !about || !price) {
          return callback({
            Fault: {
              Code: { Value: "soap:Sender" },
              Reason: { Text: "Missing arguments for CreateProduct" },
              statusCode: 400,
            },
          });
        }

        try {
          const product = await sql`
            INSERT INTO products (name, about, price)
            VALUES (${name}, ${about}, ${price})
            RETURNING *;
          `;
          callback(null, product[0]);
        } catch (err) {
          callback({
            Fault: {
              Code: { Value: "soap:Sender" },
              Reason: { Text: "Database error" },
              statusCode: 500,
            },
          });
        }
      },

      // Opération de mise à jour de produit (Patch)
      PatchProduct: async function ({ id, name, about, price }, callback) {
        if (!id) {
          return callback({
            Fault: {
              Code: { Value: "soap:Sender" },
              Reason: { Text: "ID is required for PatchProduct" },
              statusCode: 400,
            },
          });
        }

        const updateFields = [];
        if (name) updateFields.push(`name = ${name}`);
        if (about) updateFields.push(`about = ${about}`);
        if (price) updateFields.push(`price = ${price}`);

        if (updateFields.length === 0) {
          return callback({
            Fault: {
              Code: { Value: "soap:Sender" },
              Reason: { Text: "No fields to update" },
              statusCode: 400,
            },
          });
        }

        try {
          const updateQuery = `UPDATE products SET ${updateFields.join(
            ", "
          )} WHERE id = ${id} RETURNING *`;

          const product = await sql.query(updateQuery);

          if (product.length === 0) {
            return callback({
              Fault: {
                Code: { Value: "soap:Sender" },
                Reason: { Text: "Product not found" },
                statusCode: 404,
              },
            });
          }

          callback(null, product[0]);
        } catch (err) {
          callback({
            Fault: {
              Code: { Value: "soap:Sender" },
              Reason: { Text: "Database error" },
              statusCode: 500,
            },
          });
        }
      },

      // Opération de suppression de produit
      DeleteProduct: async function ({ id }, callback) {
        if (!id) {
          return callback({
            Fault: {
              Code: { Value: "soap:Sender" },
              Reason: { Text: "ID is required for DeleteProduct" },
              statusCode: 400,
            },
          });
        }

        try {
          const product = await sql`
            DELETE FROM products WHERE id = ${id} RETURNING *;
          `;

          if (product.length === 0) {
            return callback({
              Fault: {
                Code: { Value: "soap:Sender" },
                Reason: { Text: "Product not found" },
                statusCode: 404,
              },
            });
          }

          callback(null, { message: "Product deleted successfully" });
        } catch (err) {
          callback({
            Fault: {
              Code: { Value: "soap:Sender" },
              Reason: { Text: "Database error" },
              statusCode: 500,
            },
          });
        }
      },
    },
  },
};

const server = http.createServer(function (request, response) {
  response.writeHead(404, { "Content-Type": "text/plain" });
  response.end("404: Not Found: " + request.url);
});

server.listen(8000, () => {
  console.log("Server running at http://localhost:8000/");
});

const xml = fs.readFileSync("productsService.wsdl", "utf8");

soap.listen(server, {
  path: "/products",
  services: service,
  xml: xml,
});

console.log("SOAP server running at http://localhost:8000/products?wsdl");