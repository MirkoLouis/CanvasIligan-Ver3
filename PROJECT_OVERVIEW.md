# A Technical Overview of the CanvasIligan Semantic Search System

## 1. Introduction

The CanvasIligan system is a full-stack web application engineered to provide a semantic search interface for products within a localized, urban marketplace. The system's core objective is to transcend the limitations of traditional lexical search (e.g., keyword matching via SQL `LIKE` clauses) by implementing a natural language understanding (NLU) pipeline. This allows the system to interpret the user's query based on its semantic meaning rather than literal terms, thereby delivering a more intuitive and accurate information retrieval experience.

## 2. System Architecture and Technology Stack

The system is architected as a distributed, multi-service application, comprising a client-side interface, an application server, a machine learning microservice, and a relational database. This decoupled architecture ensures modularity, scalability, and maintainability.

*   **Client-Side Interface:** A lightweight, static frontend constructed with **HTML5, CSS3, and vanilla JavaScript**.
    *   **Rationale:** This choice obviates the need for a complex frontend framework, reducing build times and dependency overhead. The user interface is rendered dynamically via direct DOM manipulation in response to asynchronous API calls, providing a responsive user experience without a virtual DOM.

*   **Application Server and API Gateway:** A **Node.js** server running the **Express.js** framework.
    *   **Rationale:** Node.js was selected for its asynchronous, non-blocking I/O model, which is highly performant for I/O-bound operations such as handling numerous concurrent HTTP requests and proxying them to other services. Express.js provides a minimal, unopinionated layer for building the RESTful API endpoints that serve as the gateway to the system's other components. A new combined API endpoint (`/api/popup-details`) has been added to efficiently fetch all necessary store and product pricing details for the enhanced hover popup in a single request, reducing network latency. Additionally, the Node.js server now hosts offline image placeholder generators (`/api/placeholder/product`, `/api/placeholder/store`, `/api/placeholder/banner`) and intercepts product, store, and banner image URLs from the database to serve these local placeholders, improving standalone capabilities and reducing external dependencies.

*   **Machine Learning Microservice:** A **Python** microservice built with the **Flask** web framework.
    *   **Rationale:** Python is the de facto standard for machine learning applications, providing access to a rich scientific computing stack (e.g., NumPy) and state-of-the-art deep learning libraries. Flask was chosen for its simplicity and low overhead, making it ideal for creating a dedicated, single-purpose microservice to host the embedding and search logic.

*   **Natural Language Processing Model:** The **`sentence-transformers`** library.
    *   **Rationale:** This library provides pre-trained Transformer-based models (e.g., from the BERT family) that are fine-tuned for generating high-quality sentence and paragraph embeddings. These dense vector representations capture the semantic essence of the text, enabling meaningful similarity comparisons.

*   **Vector Similarity Search:** **`Faiss` (Facebook AI Similarity Search)**.
    *   **Rationale:** A brute-force search comparing a query vector to every product vector would result in a linear time complexity (O(n)), which is not scalable. Faiss is a highly optimized C++ library (with Python bindings) that implements algorithms for efficient nearest neighbor search in high-dimensional spaces. It uses techniques such as vector quantization and indexing structures (e.g., Inverted File System - IVF) to dramatically accelerate the search process, achieving sub-linear time complexity.

*   **Data Persistence:** A **MySQL** relational database.
    *   **Rationale:** MySQL provides a robust, reliable, and ACID-compliant database for storing the structured product, category, and store data. The schema has been extended to include store images, office hours (days and times), and product pricing has been refactored to support varied prices per product per store, stored in the `product_availability` join table. The use of parameterized queries at the application server level ensures protection against SQL injection vulnerabilities.

## 3. The Semantic Search Pipeline

The search functionality is divided into two main phases: an offline indexing phase and an online query-processing phase.

### 3.1. Offline Indexing Process

Before the system can serve search requests, a vector index of all products must be generated. This is an offline batch process:

1.  **Data Ingestion:** The `generate_embeddings.py` script connects to the MySQL database and retrieves the textual data (name, descriptions) for all products.
2.  **Embedding Generation:** Each product's textual data is fed into the `sentence-transformers` model, which outputs a high-dimensional vector embedding for that product.
3.  **Index Construction:** These embeddings are aggregated into a matrix and used to build a `Faiss` index. The index is then serialized and saved to disk as a `.faiss` file.
4.  **Embedding Persistence (Optional):** The generated embeddings are also stored as `BLOB` data in the `products` table in the MySQL database for persistence and potential future use without re-computation.

### 3.2. Online Query Processing Pipeline

The following steps describe the real-time process of handling a user's search query:

1.  **HTTP Request Initiation:** A user submits a query through the client-side interface. The browser's JavaScript constructs and dispatches an asynchronous HTTP GET request to the Node.js application server's `/api/search` endpoint, with the query string URL-encoded.

2.  **API Gateway and Proxying:** The Node.js server receives the request. It acts as an API gateway, validating the request and then proxying it by making an HTTP POST request to the Python/Flask machine learning microservice's `/search` endpoint.

3.  **Query Vectorization:** The Flask service receives the query string. It utilizes the loaded `sentence-transformers` model to transform the raw text query into a dense vector embedding, projecting it into the same vector space as the product embeddings.

4.  **Nearest Neighbor Search:** This query vector is then used to perform a k-Nearest Neighbors (k-NN) search against the pre-loaded `Faiss` index. The search identifies the `k` product vectors in the index that have the minimum Euclidean distance (or maximum cosine similarity) to the query vector.

5.  **ID-based Response:** The `Faiss` search returns a ranked list of the product IDs corresponding to the nearest neighbors. The Flask service sends this list of IDs back to the Node.js server in a JSON response.

6.  **Data Hydration:** The Node.js server receives the list of product IDs. To "hydrate" this data, it executes a parameterized SQL query against the MySQL database to retrieve the full records (name, description, image URL, store availability, etc.) for each product ID. Importantly, it now calculates and returns the `MIN(price)` and `MAX(price)` for each product across all its available stores, and the `GROUP_CONCAT` for store availability is ordered by `pa.price` (cheapest to most expensive). An `ORDER BY FIELD(...)` clause is used to maintain the relevance ranking provided by the search service.

7.  **Hover Popup Data Retrieval:** For the interactive store hover popup, the Node.js server exposes a new combined API endpoint (`/api/popup-details`). This endpoint accepts a `product_id` and `store_id`, efficiently querying the database to retrieve both comprehensive store details (name, location, rating, image) and the exact price of the specified product at that particular store in a single optimized network request.

8.  **Client Response:** The Node.js server serializes the hydrated product records into a JSON array and sends it back to the client's browser as the response to the original HTTP GET request.

9.  **Dynamic Rendering:** The client-side JavaScript parses the JSON response and dynamically manipulates the Document Object Model (DOM) to render the search results on the page, populating the product list and pagination controls, including the enhanced hover popup.

## 4. Code Documentation and Maintainability

To enhance the long-term maintainability and developer experience of the project, the codebase has been documented with inline comments.

*   **Frontend JavaScript (`public/script.js`, `public/store.js`):** The client-side JavaScript files, which handle dynamic rendering, user interactions, and API communication, have been commented to explain the purpose of each function, event listener, and state management variable. This clarifies the logic for DOM manipulation, asynchronous data fetching, and UI updates.

*   **Backend Server (`server/server.js`):** The Node.js server code is commented to delineate the roles of different middleware (security, rate limiting, CORS), explain the logic of each API endpoint, and describe the data flow for both search and data retrieval operations. This includes explanations of the interactions with the Python microservice and the database.

This commenting strategy ensures that new developers can more easily understand the system's architecture and internal workings, reducing onboarding time and facilitating future development and debugging efforts.