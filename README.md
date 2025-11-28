# CanvasIligan - Semantic Product Search

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

A web application that provides a powerful semantic search engine for products available in Iligan City.

## Description

CanvasIligan is a project designed to solve the problem of finding specific products within Iligan City. Instead of relying on simple keyword matching, it uses state-of-the-art machine learning models to understand the *meaning* behind a user's search query. This allows for more intuitive and accurate search results, helping users discover products even if they don't know the exact product name.

For a detailed explanation of the project architecture and the search process, please see the [Project Overview](PROJECT_OVERVIEW.md).

### Screenshots

#### Homepage
<img width="1910" height="880" alt="Homepage" src="https://github.com/user-attachments/assets/5b30513c-3ad2-4a7b-baad-0ca37d5e3968" />

#### Search Results
<img width="1910" height="880" alt="Search Results" src="https://github.com/user-attachments/assets/712eb7ad-ea0d-4001-9753-75284ce7346e" />

#### Store Page
<img width="1910" height="880" alt="Store Page" src="https://github.com/user-attachments/assets/ba0cdcf1-a8e3-4ace-8e47-935d41aeefbd" />

### Key Features

*   **Scalable Semantic Search:** Powered by sentence-transformers models and a Faiss index to provide fast, scalable, and accurate natural language search.
*   **Intelligent Keyword Boosting:** Employs a tiered, stemmer-based, and additive keyword boosting system. It correctly identifies generic terms (e.g., "module," "tool"), sums the boost for each matching keyword, and prioritizes products that match more specific terms in the query. This significantly improves relevance for multi-word searches (e.g., "vibrator module" vs. "vibration motor") over pure semantic similarity.
*   **Conditional Search Logic:** The system can now distinguish between specific product queries and broad, project-based queries (e.g., "materials to build a robot").
*   **Project-Based Result Ordering:** For project-based queries, search results are automatically organized into a "starter kit" format. Products are grouped by relevance (e.g., "The Brain," "Moving Parts," "Tools"), with a limited preview from each category shown first to ensure a diverse initial result set. The full list of all relevant products follows this preview, ensuring no results are omitted. For specific queries, this organizational logic is skipped.
*   **Product Price Ranging:** Products now have varied prices across different stores (with a 1-5% variation), and search results display the price range, while store-specific views show the exact price.
*   **Multi-Store Product Availability:** Products can be associated with multiple stores, and search results clearly display all available locations.
*   **Discover All Stores Feature:** A dropdown list on the main page allows users to quickly navigate to any store page.
*   **Enhanced Store Details:** Store pages now display comprehensive information including contact number, office hours (days and time), and a dedicated store image.
*   **Back Navigation:** A convenient back button on store pages allows users to easily return to their previous search results.
*   **Optimized & Enhanced Hover Popup:** The store hover feature now displays a split view with detailed store information and relevant product details (including product price at that store) in an optimized single API call.
*   **Server-Side Category Filtering:** Filter search results by category on the backend for efficient and accurate refinement of paginated results.
*   **Pagination:** A classic and intuitive pagination system to navigate through search results.
*   **Node.js Backend:** A robust backend built with Express.js to handle API requests.
*   **Python ML Integration:** A persistent Python Flask server that handles all machine learning computations.
*   **Dynamic Frontend:** A simple and clean user interface built with HTML, CSS, and JavaScript.
*   **Offline Image Placeholders:** Dynamically generated SVG placeholder images for products are now served locally, improving offline usability and reducing external dependencies.
*   **Improved Code Readability:** Added detailed comments to the frontend and backend JavaScript files (`public/script.js`, `public/store.js`, and `server/server.js`) to improve code clarity, maintainability, and ease of understanding for developers.

## Table of Contents

*   [Installation](#installation)
*   [Quick Start](#quick-start)
*   [Usage](#usage)
*   [Development](#development)
*   [Scripts](#scripts)
*   [Security](#security)
*   [License](#license)

## Installation

### Prerequisites

*   [Node.js and npm](https://nodejs.org/)
*   [Python 3.x](https://www.python.org/)
*   [MySQL](https://www.mysql.com/)

### Step-by-step Instructions

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd CanvasIligan3
    ```

2.  **Install Node.js dependencies:**
    ```bash
    npm install
    ```

3.  **Set up the Python virtual environment and install dependencies:**
    ```bash
    python -m venv .venv
    .\.venv\Scripts\activate
    pip install sentence-transformers mysql-connector-python numpy Flask faiss-cpu torch nltk
    ```

4.  **Set up the database:**
    *   Create a MySQL database named `canvasiligan_db`.
    *   Execute the `canvasiligan schema.sql` script to create all necessary tables.
    *   Execute the `canvasiligan data.sql` script to populate initial data.
    *   Update the database credentials in `semantic_search_server.py` and `server/db.js`.

5.  **Generate embeddings for the products:**
    Run the `generate_embeddings.py` script to generate and store the embeddings for the products.
    ```bash
    .\.venv\Scripts\python.exe generate_embeddings.py
    ```

## Quick Start

To start the application, you need to run two services in separate terminals.

**Terminal 1: Start the Python Search Service**
```bash
.\.venv\Scripts\activate
.\.venv\Scripts\python.exe semantic_search_server.py
```
This service loads the machine learning model and Faiss index, handling all search computations.
**Note:** For prototyping, this service uses the basic Flask development server. For production deployments, it is highly recommended to use a production-grade WSGI server (e.g., Gunicorn, uWSGI) to handle concurrent requests efficiently.

**Terminal 2: Start the Node.js Backend**
```bash
npm start
```
This will start the Node.js server on `http://localhost:3000`. Open your browser and navigate to this address to use the application.

## Usage

1.  Ensure both the Python and Node.js servers are running as described in the [Quick Start](#quick-start) section.
2.  Open the web application in your browser (`http://localhost:3000`).
3.  Enter a search query in the search bar and press Enter.
4.  Use the pagination controls at the bottom of the page to navigate through results.
5.  Use the category filter to perform a new, filtered search.

## Development

### Running the servers

To run the servers in development mode, follow the [Quick Start](#quick-start) instructions. The `npm start` command uses `nodemon` to automatically restart the Node.js server on file changes.

### Scripts

This project includes several Python scripts for managing the machine learning components:

*   `semantic_search_server.py`: A persistent Flask server that loads the ML model and a Faiss index into memory. It serves search results via a `/search` API endpoint, providing highly scalable and fast responses.
*   `generate_embeddings.py`: Connects to the database, generates embeddings for products, and stores them in the `products` table.
*   `semantic_search.py`: A legacy script that performs a one-off semantic search. It is no longer used by the main application but can be useful for direct testing.

## Security

The application has been hardened against common web vulnerabilities by implementing the following security measures:

*   **Content Security Policy (CSP):** A strict CSP is in place to mitigate Cross-Site Scripting (XSS) and other injection attacks, dynamically adjusted to allow necessary external map resources.
*   **Anti-Clickjacking:** The `X-Frame-Options` header is used to prevent the application from being embedded in iframes, protecting against clickjacking attacks.
*   **CORS Configuration:** Cross-Origin Resource Sharing is restricted to only allow requests from the frontend application.
*   **Header Security:** The `X-Powered-By` header is disabled to avoid leaking information about the server technology.
*   **API Rate Limiting:** A tiered rate-limiting strategy is implemented to protect against abuse and ensure server stability. A global limit of 500 requests per 15 minutes applies to all routes, while the `/api/search` endpoint has a stricter limit of 20 requests per minute.

## License

This project is licensed under the ISC License. See the [LICENSE](LICENSE) file for details.
