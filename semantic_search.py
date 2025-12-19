import mysql.connector
from sentence_transformers import SentenceTransformer, util
import numpy as np
import sys
import json
import os
from dotenv import load_dotenv

# This script performs a semantic search on the products in the database.
def semantic_search(query):
    try:
        # Connect to the database
        connection = mysql.connector.connect(
            host=os.getenv('DB_HOST'),
            port=os.getenv('DB_PORT'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            database=os.getenv('DB_NAME')
        )
        cursor = connection.cursor(dictionary=True)

        # Load the pre-trained model
        model = SentenceTransformer('all-MiniLM-L6-v2')

        # Generate an embedding for the query
        query_embedding = model.encode(query)

        # Fetch all product embeddings from the database
        cursor.execute("SELECT product_id, product_embedding FROM products WHERE product_embedding IS NOT NULL")
        products = cursor.fetchall()

        if not products:
            print("No products with embeddings found in the database.", file=sys.stderr)
            return []

        product_ids = [product['product_id'] for product in products]
        product_embeddings = np.array([np.frombuffer(product['product_embedding'], dtype=np.float32) for product in products])

        # Calculate cosine similarity between the query embedding and all product embeddings
        similarities = util.pytorch_cos_sim(query_embedding, product_embeddings)[0]

        # Create a list of (product_id, similarity) tuples
        results = zip(product_ids, similarities)

        # Sort the results by similarity in descending order
        sorted_results = sorted(results, key=lambda x: x[1], reverse=True)

        # Return the sorted list of product IDs
        return [int(product_id) for product_id, similarity in sorted_results]

    except mysql.connector.Error as err:
        print(f"Error: {err}", file=sys.stderr)
        return []
    finally:
        if 'connection' in locals() and connection.is_connected():
            cursor.close()
            connection.close()

if __name__ == '__main__':
    if len(sys.argv) > 1:
        query = sys.argv[1]
        results = semantic_search(query)
        print(json.dumps(results))
