const soap = require("soap");

soap.createClient("http://localhost:8000/products?wsdl", {}, function (err, client) {
  if (err) {
    console.error("Error creating SOAP client:", err);
    return;
  }

  // Exemple pour créer un produit
  const createProductData = {
    name: "New Product",      // Nom du produit
    about: "This is a new product", // Description du produit
    price: 29.99,            // Prix du produit
  };

  client.CreateProduct(createProductData, function (err, result) {
    if (err) {
      console.error("Error creating product:", err);
      return;
    }
    console.log("Product created successfully:", result);

    // Exemple pour mettre à jour un produit avec l'ID du produit créé
    const updateProductData = {
      id: result.id,  // ID du produit que l'on veut mettre à jour
      name: "Updated Product Name", // Nouveau nom (optionnel)
      about: "Updated product description", // Nouvelle description (optionnel)
      price: 49.99,   // Nouveau prix (optionnel)
    };

    client.PatchProduct(updateProductData, function (err, updateResult) {
      if (err) {
        console.error("Error updating product:", err);
        return;
      }
      console.log("Product updated successfully:", updateResult);

      // Exemple pour supprimer le produit
      const deleteProductData = {
        id: result.id,  // ID du produit à supprimer
      };

      client.DeleteProduct(deleteProductData, function (err, deleteResult) {
        if (err) {
          console.error("Error deleting product:", err);
          return;
        }
        console.log("Product deleted successfully:", deleteResult);
      });
    });
  });
});