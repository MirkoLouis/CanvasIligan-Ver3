import mysql.connector
from sentence_transformers import SentenceTransformer
import numpy as np

# This script connects to the database, generates embeddings for products, and stores them in the database.
def generate_embeddings(model=None):
    try:
        # Connect to the database
        connection = mysql.connector.connect(
            host='MirkoLouis',
            port=3306,
            user='MirkoLouis',
            password='One5zero03',
            database='canvasiligan_db'
        )
        cursor = connection.cursor(dictionary=True)

        # --- ENRICHMENT STEP 1: Clear old embeddings to ensure regeneration ---
        print("Clearing all existing product embeddings...")
        cursor.execute("UPDATE products SET product_embedding = NULL")
        connection.commit()
        print(f"{cursor.rowcount} embeddings cleared.")
        # --------------------------------------------------------------------

        # Load the pre-trained model if it's not passed as an argument
        if model is None:
            print("Loading model for embedding generation...")
            model = SentenceTransformer('all-MiniLM-L6-v2')
            print("Model loaded.")

        # --- ENRICHMENT STEP 2: Fetch products with their category names ---
        # The query now joins the category table to get the category_name
        query = """
            SELECT
                p.product_id,
                p.product_name,
                p.product_desc1,
                p.product_desc2,
                p.product_desc3,
                c.category_name
            FROM
                products p
            LEFT JOIN
                category c ON p.category_id = c.category_id
        """
        cursor.execute(query)
        products = cursor.fetchall()

        if not products:
            print("No products found in the database.")
            return

        print(f"Found {len(products)} products. Generating enriched embeddings now...")

        for product in products:
            # --- ENRICHMENT STEP 3: Create a richer text for embedding ---
            # We now include the category name for more context
            category_name = product.get('category_name', '') # Use .get for safety
            text_to_embed = (
                f"Category: {category_name}. "
                f"Name: {product['product_name']}. "
                f"Description: {product['product_desc1']} {product['product_desc2']} {product['product_desc3']}"
            )
            # -------------------------------------------------------------

            # Generate the embedding
            embedding = model.encode(text_to_embed)

            # Convert the embedding to a byte array for storing in the BLOB column
            embedding_bytes = np.array(embedding).tobytes()

            # Update the product record with the new embedding
            cursor.execute(
                "UPDATE products SET product_embedding = %s WHERE product_id = %s",
                (embedding_bytes, product['product_id'])
            )

        connection.commit()
        print(f"Successfully generated and stored enriched embeddings for {len(products)} products.")


    except mysql.connector.Error as err:
        print(f"Error: {err}")
    finally:
        if 'connection' in locals() and connection.is_connected():
            cursor.close()
            connection.close()

if __name__ == '__main__':
    generate_embeddings()