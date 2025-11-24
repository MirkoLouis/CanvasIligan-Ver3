// server.js - Main Express Server
// This file sets up the Express server, defines middleware, and creates all API endpoints for the application.

// Load environment variables from a .env file into process.env
require('dotenv').config();

// Import necessary modules
const express = require('express');
const bodyParser = require('body-parser'); // Middleware to parse incoming request bodies
const cors = require('cors'); // Middleware to enable Cross-Origin Resource Sharing
const db = require('./db'); // Custom module for database connection
const axios = require('axios'); // Promise-based HTTP client for making requests to the Python service
const rateLimit = require('express-rate-limit'); // Middleware for rate-limiting requests to prevent abuse

// Initialize the Express application
const app = express();
const port = 3000;
app.disable('x-powered-by'); // Disable the X-Powered-By header for security (to not reveal server technology)
const PYTHON_API_URL = 'http://localhost:5000/search'; // URL for the Python machine learning microservice

// --- Rate Limiting Setup ---
// Set up tiered rate limiting to protect the server from brute-force attacks and abuse.

// A global rate limiter for all requests
const globalLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 300, // Limit each IP to 300 requests per 15-minute window
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again after 15 minutes' // Custom message
});

// A stricter rate limiter specifically for the search endpoint
const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Limit each IP to 20 search requests per minute
  standardHeaders: true,
	legacyHeaders: false,
  message: 'Too many search requests from this IP, please try again after a minute' // Custom message
});

// Apply the global rate limiter to all incoming requests
app.use(globalLimiter);

// --- Security Headers Middleware ---
// Sets important security headers for all responses to mitigate common web vulnerabilities.
app.use((req, res, next) => {
  // Content Security Policy (CSP) helps prevent XSS attacks by defining trusted sources for content.
  res.setHeader(
    'Content-Security-Policy',
    // Defines allowed sources for various types of content
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://tiles.openfreemap.org; connect-src 'self' http://localhost:5000 https://tiles.openfreemap.org; img-src 'self' https://via.placeholder.com https://placehold.co blob: data: https://tiles.openfreemap.org; font-src 'self' https://tiles.openfreemap.org; worker-src 'self' blob:; frame-src 'self';"
  );
  // X-Frame-Options prevents clickjacking attacks by disallowing the page to be embedded in iframes.
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

// --- General Middleware Setup ---
// This block configures middleware for CORS, body parsing, and serving static files.
app.use(cors({
  origin: 'http://localhost:3000' // Restrict requests to the application's own origin
}));
app.use(bodyParser.json()); // Parse JSON-formatted request bodies
app.use(express.static('public')); // Serve static files from the 'public' directory (e.g., HTML, CSS, JS)
app.use('/bootstrap', express.static('node_modules/bootstrap')); // Serve Bootstrap files from node_modules
app.use('/maplibre-gl', express.static('node_modules/maplibre-gl')); // Serve MapLibre GL files from node_modules

// --- API Endpoints ---

/**
 * @route GET /api/categories
 * @description Fetches all product categories from the database.
 */
app.get('/api/categories', (req, res) => {
  db.query('SELECT * FROM category', (error, results) => {
    if (error) {
      console.error('Database categories error:', error);
      return res.status(500).send({ error: 'Internal server error' });
    }
    res.json(results);
  });
});

/**
 * @route GET /api/search
 * @description The main search endpoint. It receives a query, calls the Python ML service
 *              to get relevant product IDs, and then "hydrates" these IDs with full
 *              details from the database.
 * @middleware searchLimiter - Applies a strict rate limit to this endpoint.
 */
app.get('/api/search', searchLimiter, async (req, res) => {
  const startTime = process.hrtime(); // Start timer for performance monitoring
  const { q: query, page = 1, limit = 10, category_id } = req.query;
  
  console.info(`[${new Date().toISOString()}] Received search query: "${query}", page: ${page}, limit: ${limit}, category: ${category_id} from IP: ${req.ip}, User-Agent: ${req.headers['user-agent']}`);

  if (!query) {
    return res.status(400).send({ error: 'Query parameter "q" is required' });
  }

  try {
    // 1. Call the Python service to get a list of semantically relevant product IDs.
    console.info(`[${new Date().toISOString()}] Calling Python search service at ${PYTHON_API_URL}`);
    const response = await axios.post(PYTHON_API_URL, { q: query, page, limit, category_id });

    // Defensive check to ensure the response from the Python service is valid.
    if (!response.data || !Array.isArray(response.data.product_ids)) {
        console.error('Invalid or unexpected response from Python service:', response.data);
        throw new Error('Invalid response from search service');
    }

    const { product_ids, total } = response.data;
    console.info(`[${new Date().toISOString()}] Python service returned ${product_ids.length} product IDs out of ${total} total.`);

    // If no IDs are returned, send an empty response immediately.
    if (product_ids.length === 0) {
      console.info(`[${new Date().toISOString()}] No products found for this page. Sending empty response.`);
      return res.json({ products: [], total: 0 });
    }

    // 2. Hydrate the product IDs with full details from the database.
    const placeholders = product_ids.map(() => '?').join(','); // Create placeholders for the IN clause
    const searchQuery = `
        SELECT 
            p.product_id, 
            p.product_name, 
            MIN(pa.price) as min_price,
            MAX(pa.price) as max_price,
            p.product_desc1, 
            p.product_desc2, 
            p.product_desc3, 
            p.product_image_url,
            c.category_name,
            -- Aggregate store information, ordered by price (cheapest first)
            GROUP_CONCAT(s.store_name ORDER BY pa.price SEPARATOR '||') AS store_names,
            GROUP_CONCAT(s.store_barangay ORDER BY pa.price SEPARATOR '||') AS store_barangays,
            GROUP_CONCAT(s.store_street ORDER BY pa.price SEPARATOR '||') AS store_streets,
            GROUP_CONCAT(s.store_city ORDER BY pa.price SEPARATOR '||') AS store_cities,
            GROUP_CONCAT(s.store_id ORDER BY pa.price SEPARATOR '||') AS store_ids
        FROM products p
        JOIN category c ON p.category_id = c.category_id
        LEFT JOIN product_availability pa ON p.product_id = pa.product_id
        LEFT JOIN store s ON pa.store_id = s.store_id
        WHERE p.product_id IN (${placeholders})
        GROUP BY p.product_id
        -- Maintain the relevance order returned by the semantic search
        ORDER BY FIELD(p.product_id, ${placeholders})
      `;

    const queryParams = [...product_ids, ...product_ids]; // Parameters for both IN and FIELD clauses
    console.info(`[${new Date().toISOString()}] Executing database query to fetch product details.`);

    db.query(searchQuery, queryParams, (error, results) => {
      if (error) {
        console.error(`[${new Date().toISOString()}] Database search error:`, error);
        return res.status(500).send({ error: 'Internal server error' });
      }
      
      const duration = process.hrtime(startTime); // End performance timer
      const durationInMs = (duration[0] * 1000 + duration[1] / 1e6).toFixed(2);
      
      console.info(`[${new Date().toISOString()}] Database query successful. Found ${results.length} products.`);
      console.info(`[${new Date().toISOString()}] Search complete. Total time: ${durationInMs}ms. Sending results.`);
      
      // Send the final hydrated product data and total count back to the client.
      res.json({ products: results, total: total });
    });
  } catch (error) {
    console.error('Error calling Python search service:', error.message);
    if (error.response) {
      console.error('Python service response error:', error.response.data);
    }
    return res.status(500).send({ error: 'Internal server error during search' });
  }
});

/**
 * @route GET /api/popup-details
 * @description Fetches the specific details required for the store hover popup in the search results.
 *              This is an optimized endpoint to get store info and the product-specific price in one call.
 */
app.get('/api/popup-details', async (req, res) => {
    const { store_id, product_id } = req.query;

    if (!store_id || !product_id) {
        return res.status(400).send({ error: 'store_id and product_id are required' });
    }

    try {
        const storeQuery = 'SELECT store_name, store_street, store_barangay, store_city, store_rating, store_image_url FROM store WHERE store_id = ?';
        const priceQuery = 'SELECT price FROM product_availability WHERE product_id = ? AND store_id = ?';

        // Execute both queries concurrently for efficiency
        const [storeResult] = await db.promise().query(storeQuery, [store_id]);
        const [priceResult] = await db.promise().query(priceQuery, [product_id, store_id]);

        if (storeResult.length === 0) {
            return res.status(404).send({ error: 'Store not found' });
        }

        // Combine results into a single JSON response
        res.json({
            storeDetails: storeResult[0],
            priceDetails: priceResult.length > 0 ? priceResult[0] : null // Handle case where price might not be found
        });

    } catch (error) {
        console.error('Database popup details error:', error);
        return res.status(500).send({ error: 'Internal server error' });
    }
});

/**
 * @route GET /api/store-page/:id
 * @description Fetches all data required for a single store's page, including store details
 *              and a paginated list of its products. Supports searching within the store's products.
 */
app.get('/api/store-page/:id', async (req, res) => {
    const storeId = req.params.id;
    const page = parseInt(req.query.page) || 1;
    const search = req.query.q || '';
    const limit = 15;
    const offset = (page - 1) * limit;

    try {
        // Query for store details
        const storeQuery = 'SELECT store_name as name, CONCAT(store_street, ", ", store_city, ", ", store_barangay) as location, store_banner_url as banner_image_url, store_contactnumber, store_latitude, store_longitude, store_image_url, store_opening_days, store_opening_time, store_closing_time FROM store WHERE store_id = ?';
        
        // Base queries for products and total count
        let productsQuery = 'SELECT p.product_name as name, p.product_desc1 as description, pa.price as price, p.product_image_url as image_url FROM products p JOIN product_availability pa ON p.product_id = pa.product_id WHERE pa.store_id = ?';
        let totalProductsQuery = 'SELECT COUNT(*) as total FROM products p JOIN product_availability pa ON p.product_id = pa.product_id WHERE pa.store_id = ?';
        
        const queryParams = [storeId];
        const totalQueryParams = [storeId];

        // Add search condition if a search query is provided
        if (search) {
            productsQuery += ' AND p.product_name LIKE ?';
            totalProductsQuery += ' AND p.product_name LIKE ?';
            queryParams.push(`%${search}%`);
            totalQueryParams.push(`%${search}%`);
        }

        // Add pagination to the product query
        productsQuery += ' LIMIT ? OFFSET ?';
        queryParams.push(limit, offset);

        // Execute all queries
        const [storeResult] = await db.promise().query(storeQuery, [storeId]);
        
        if (storeResult.length === 0) {
            return res.status(404).send({ error: 'Store not found' });
        }

        const [productsResult] = await db.promise().query(productsQuery, queryParams);
        const [totalResult] = await db.promise().query(totalProductsQuery, totalQueryParams);

        const totalProducts = totalResult[0].total;

        // Construct the final response object
        const response = {
            store: storeResult[0],
            products: productsResult,
            totalProducts: totalProducts,
            totalPages: Math.ceil(totalProducts / limit)
        };

        res.json(response);

    } catch (error) {
        console.error('Database store page error:', error);
        return res.status(500).send({ error: 'Internal server error' });
    }
});

// --- Server Startup ---
// This block starts the Express server and performs a health check on the Python service.
app.listen(port, () => {
  console.log(`Node.js server is running on http://localhost:${port}`);
  
  // On startup, check the health of the Python search service to ensure it's connected and up-to-date.
  axios.post(PYTHON_API_URL, { q: 'healthcheck' })
    .then(response => {
      // A successful response with a 'total' key indicates the service is running correctly.
      if (response.data && typeof response.data.total !== 'undefined') {
        console.log('Python search service is connected and responding.');
      } else {
        // Handle case where service is running but might be an old version.
        console.error('---------------------------------------------------------------');
        console.error('ERROR: Python service is running but is out of date.');
        console.error('Please RESTART the Python server to apply recent changes.');
        console.error('---------------------------------------------------------------');
      }
    })
    .catch(error => {
      // Handle connection error, which likely means the Python server isn't running.
      if (error.code === 'ECONNREFUSED') {
        console.error('---------------------------------------------------------------');
        console.error('CRITICAL: Cannot connect to Python search service.');
        console.error(`Please ensure the Python server is running on ${PYTHON_API_URL.replace('/search', '')}`);
        console.error('---------------------------------------------------------------');
      } else {
        console.error('An unknown error occurred while checking the Python service:', error.message);
      }
    });
});