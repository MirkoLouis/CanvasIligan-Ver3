# semantic_search_server.py
from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer, util
import numpy as np
import mysql.connector
import json
import faiss
import torch
from nltk.stem import PorterStemmer
import os
from dotenv import load_dotenv

load_dotenv()

from generate_embeddings import generate_embeddings

# Define boosting factors for different types of keyword matches
KEYWORD_BOOST_EXACT = 1.0   # High boost for exact, non-generic word matches
KEYWORD_BOOST_PARTIAL = 0.5 # Medium boost for partial matches (e.g., 'solder' in 'soldering')
KEYWORD_BOOST_GENERIC = 0.2 # Low boost for generic words

# List of generic words that should receive a lower boost
GENERIC_WORDS = ['tool', 'kit', 'set', 'supply', 'supplies', 'wire', 'paste', 'wick', 'device', 'instrument', 'apparatus', 'equipment', 'implement', 'module']

# Keywords to detect project-based queries that trigger diversification
PROJECT_KEYWORDS = ['build', 'make', 'project', 'kit', 'materials for', 'starter', 'robot', 'radio', 'construct', 'assemble', 'create', 'fabricate', 'develop', 'design', 'craft', 'implement', 'integrate', 'engineer', 'prototype']
# Max number of items to show from a single category before showing other categories
MAX_ITEMS_PER_CATEGORY = 2

# Define the desired order of categories for project-based queries
PROJECT_CATEGORY_ORDER = [
    [1],  # The Brain (Integrated Circuits)
    [4],  # The Moving Parts (Electromechanical)
    [6, 7], # The Tools (Test Equipment, Tools and Supplies)
    [2, 3, 8, 9, 10, 11], # Extra Components
    [5, 12], # Wires and Cables
    [13, 14] # The Rest
]

app = Flask(__name__)
stemmer = PorterStemmer() # Initialize the stemmer

# --- LOAD ONCE AT STARTUP ---
print("Loading model...")
model = SentenceTransformer('all-MiniLM-L6-v2')
print("Model loaded.")

# Automatically generate embeddings for any products that are missing them
# generate_embeddings(model=model)

print("Loading product data from DB...")
connection = mysql.connector.connect(
    host=os.getenv('DB_HOST'),
    port=os.getenv('DB_PORT'),
    user=os.getenv('DB_USER'),
    password=os.getenv('DB_PASSWORD'),
    database=os.getenv('DB_NAME')
)
cursor = connection.cursor(dictionary=True)
# Fetch category_id along with other product data
cursor.execute("SELECT product_id, product_name, product_embedding, category_id FROM products WHERE product_embedding IS NOT NULL")
products_data = cursor.fetchall()
cursor.close()
connection.close()

product_ids = [product['product_id'] for product in products_data]
product_embeddings = np.array([np.frombuffer(product['product_embedding'], dtype=np.float32) for product in products_data])
product_id_to_category = {product['product_id']: product['category_id'] for product in products_data}
product_id_to_name = {product['product_id']: product['product_name'] for product in products_data}
print(f"{len(product_ids)} products loaded into memory.")

# Initialize Faiss index
if product_embeddings.size > 0:
    dimension = product_embeddings.shape[1]  # Dimension of embeddings
    index = faiss.IndexFlatL2(dimension)  # Using L2 distance for similarity
    index.add(product_embeddings)  # Add all product embeddings to the index
    print(f"Faiss index created with {index.ntotal} embeddings.")
else:
    print("No product embeddings found in the database. Search will be disabled.")
    index = None
# -----------------------------

@app.route('/search', methods=['POST'])
def search():
    if index is None:
        return jsonify({"error": "Search is disabled because no product embeddings are loaded."}), 503
    try:
        query = request.json.get('q')
        category_id = request.json.get('category_id') # Get optional category_id

        print(f"Received search query from user: '{query}'")

        if not query:
            return jsonify({"error": "Query 'q' is required"}), 400

        page = int(request.json.get('page', 1))
        limit = int(request.json.get('limit', 10))
        offset = (page - 1) * limit

        # Generate embedding for the query
        query_embedding = model.encode(query)

        # Use Faiss to find the top K nearest neighbors
        K = 250 # Increased for better diversification
        # Ensure query_embedding is a 2D numpy array of float32
        query_embedding_np = np.array([query_embedding]).astype('float32')
        
        # Perform Faiss search
        distances, faiss_indices = index.search(query_embedding_np, K)
        
        # faiss_indices contains the indices of the top K products in our original product_embeddings array
        # distances contains the L2 distances (lower is better)
        
        # Filter out invalid indices (Faiss might return -1 if K > index.ntotal)
        valid_faiss_indices = [idx for idx in faiss_indices[0] if idx != -1]

        # Get the actual embeddings for these top K products
        top_k_embeddings = product_embeddings[valid_faiss_indices]
        
        # Re-compute cosine similarity for these top K products to get accurate ranking
        # util.pytorch_cos_sim expects 2D arrays
        query_embedding_tensor = torch.from_numpy(query_embedding_np)
        top_k_embeddings_tensor = torch.from_numpy(top_k_embeddings)
        
        top_k_similarities = util.pytorch_cos_sim(query_embedding_tensor, top_k_embeddings_tensor)[0].cpu().numpy()
        
        # Map back to product_ids
        top_k_product_ids = [product_ids[i] for i in valid_faiss_indices]
        
        # Create sorted_results from these top K items, sorted by similarity
        sorted_results = sorted(zip(top_k_product_ids, top_k_similarities), key=lambda x: x[1], reverse=True)

        # --- KEYWORD BOOSTING LOGIC (Additive, Stemmer-based) ---
        boosted_results = []
        query_words = query.lower().split()
        for product_id, similarity in sorted_results:
            product_name = product_id_to_name.get(product_id, "").lower()
            product_name_words = product_name.split()
            
            total_boost = 0
            # Iterate through each word in the query
            for q_word in query_words:
                # Check for a match in the product name words, and boost only once per query word
                for p_word in product_name_words:
                    # 1. Stemmed Match Boost
                    if stemmer.stem(q_word) == stemmer.stem(p_word):
                        if q_word in GENERIC_WORDS:
                            total_boost += KEYWORD_BOOST_GENERIC
                        else:
                            total_boost += KEYWORD_BOOST_EXACT
                        break # Move to the next query word
                    # 2. Partial Match Boost (as a fallback)
                    elif q_word in p_word or p_word in q_word:
                        total_boost += KEYWORD_BOOST_PARTIAL
                        break # Move to the next query word
            
            boosted_results.append((product_id, similarity + total_boost))
        
        # Re-sort after applying boosts
        sorted_results = sorted(boosted_results, key=lambda x: x[1], reverse=True)
        # --- END KEYWORD BOOSTING LOGIC ---
        
        # Filter by category if category_id is provided
        if category_id:
            try:
                # Ensure category_id is an integer for comparison
                cat_id_int = int(category_id)
                sorted_results = [res for res in sorted_results if product_id_to_category.get(res[0]) == cat_id_int]
            except (ValueError, TypeError):
                # Handle cases where category_id is not a valid integer
                pass
        else:
            # --- CONDITIONAL & REFINED DIVERSIFICATION LOGIC ---
            is_project_query = any(keyword in query.lower() for keyword in PROJECT_KEYWORDS)
            
            if is_project_query:
                print("Project-based query detected. Applying category-based ordering with limits.")
                
                # Bucket all results by their category ID
                results_by_category = {}
                for pid, sim in sorted_results:
                    cat_id = product_id_to_category.get(pid)
                    if cat_id not in results_by_category:
                        results_by_category[cat_id] = []
                    results_by_category[cat_id].append((pid, sim))

                top_results = []
                seen_product_ids = set()
                
                # 1. Add the top N items from each ordered category group for the preview
                for category_group in PROJECT_CATEGORY_ORDER:
                    for category_id in category_group:
                        products_in_cat = results_by_category.get(category_id, [])
                        # Take the top N items
                        for i, (product_id, similarity) in enumerate(products_in_cat):
                            if i < MAX_ITEMS_PER_CATEGORY:
                                if product_id not in seen_product_ids:
                                    top_results.append((product_id, similarity))
                                    seen_product_ids.add(product_id)

                # 2. Add all remaining products, preserving the original semantic sort order
                remaining_products = []
                for product_id, similarity in sorted_results:
                    if product_id not in seen_product_ids:
                        remaining_products.append((product_id, similarity))
                
                # Combine the lists: the curated top results first, followed by all other relevant products
                sorted_results = top_results + remaining_products
            else:
                print("Specific query detected. Skipping diversification.")
            # --- END DIVERSIFICATION LOGIC ---

        total_results = len(sorted_results)

        # Paginate results
        paginated_results = sorted_results[offset : offset + limit]

        # Get IDs for the current page
        paginated_ids = [int(product_id) for product_id, similarity in paginated_results]
        
        print(f"Sending {len(paginated_ids)} results for query: '{query}'")
        return jsonify({
            "product_ids": paginated_ids,
            "total": total_results
        })
    except Exception as e:
        print(f"[ERROR] An error occurred during search: {e}")
        return jsonify({"error": "An internal error occurred in the search service"}), 500


