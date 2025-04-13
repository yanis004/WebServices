CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  about VARCHAR(500),
  price FLOAT
);
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  password VARCHAR(500),
  email VARCHAR(100)
);

INSERT INTO products (name, about, price) VALUES
  ('My first game', 'This is an awesome game', '60')