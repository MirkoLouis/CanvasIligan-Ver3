document.addEventListener('DOMContentLoaded', () => {
    // Get URL parameters to extract store ID
    const urlParams = new URLSearchParams(window.location.search);
    const storeId = urlParams.get('store_id'); // Extract the store_id from the URL

    // DOM elements
    // Get references to various elements in the DOM to be manipulated later.
    const productsContainer = document.getElementById('products-container'); // Container for displaying products in the store
    const paginationContainer = document.getElementById('pagination-container'); // Container for product pagination controls
    const storeName = document.getElementById('store-name'); // Element to display the store's name
    const storeLocation = document.getElementById('store-location'); // Element to display the store's location
    const storeContact = document.getElementById('store-contact'); // Element to display the store's contact number
    const storeBanner = document.getElementById('store-banner'); // Image element for the store banner
    const storeHours = document.getElementById('store-hours'); // Element to display store operating hours
    const storeSearchForm = document.getElementById('store-search-form'); // Form for searching products within the store
    const storeSearchInput = document.getElementById('store-search-input'); // Input field for store product search

    let currentSearchQuery = ''; // Stores the current search query specific to the store's products

    // Check if a store ID is provided in the URL
    if (!storeId) {
        productsContainer.innerHTML = '<p>No store ID provided.</p>'; // Display error if no store ID
        return; // Exit script if no store ID
    }

    // Event Listener for Store Product Search Form Submission
    storeSearchForm.addEventListener('submit', (e) => {
        e.preventDefault(); // Prevent default form submission
        currentSearchQuery = storeSearchInput.value.trim(); // Get and store the search query
        fetchAndDisplayStore(1, currentSearchQuery); // Perform a new search starting from page 1
    });

    /**
     * @async
     * @function fetchAndDisplayStore
     * @param {number} [page=1] - The page number to fetch products for.
     * @param {string} [searchQuery=''] - Optional search query for products within the store.
     * @description Fetches and displays store details and its products, including pagination and map initialization.
     */
    async function fetchAndDisplayStore(page = 1, searchQuery = '') {
        try {
            // Construct API URL for fetching store details and products
            let apiUrl = `/api/store-page/${storeId}?page=${page}`;
            if (searchQuery) {
                apiUrl += `&q=${encodeURIComponent(searchQuery)}`; // Add search query if present
            }

            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();

            // Log the fetched store data for debugging
            console.log('Fetched store data:', data.store);

            // Display store information only on initial load (page 1 and no search query)
            if (page === 1 && !searchQuery) {
                storeName.textContent = data.store.name;
                storeLocation.textContent = data.store.location;
                // Populate contact number with a prefix
                storeContact.textContent = `Contact: 0${data.store.store_contactnumber}`; 
                storeBanner.src = data.store.banner_image_url || 'https://via.placeholder.com/200'; // Set banner image
                const storeImage = document.getElementById('store-image'); // Get the main store image element
                if (storeImage) {
                    storeImage.src = data.store.store_image_url || 'https://via.placeholder.com/300'; // Set main store image
                }

                // Format and display store operating hours
                if (storeHours && data.store.store_opening_days && data.store.store_opening_time && data.store.store_closing_time) {
                    const formatTime = (timeString) => {
                        const [hours, minutes] = timeString.split(':');
                        const h = parseInt(hours, 10);
                        const ampm = h >= 12 ? 'PM' : 'AM';
                        const formattedHours = h % 12 || 12; // Convert 0 (midnight) to 12 AM, and 12 (noon) to 12 PM
                        return `${formattedHours}:${minutes} ${ampm}`;
                    };

                    storeHours.textContent = `Open: ${data.store.store_opening_days}, ${formatTime(data.store.store_opening_time)} - ${formatTime(data.store.store_closing_time)}`;
                }

                // Initialize map with store's coordinates if available
                if (data.store.store_latitude && data.store.store_longitude) {
                    const longitude = parseFloat(data.store.store_longitude);
                    const latitude = parseFloat(data.store.store_latitude);

                    // Check if maplibregl library is loaded
                    if (typeof maplibregl !== 'undefined') {
                        // Initialize map only once
                        if (!window.storeMap) {
                            window.storeMap = new maplibregl.Map({
                                style: 'https://tiles.openfreemap.org/styles/liberty', // Map style
                                center: [longitude, latitude], // Center map on store location
                                zoom: 16, // Zoom level
                                container: 'map', // HTML element ID for the map
                            });

                            // Add a marker at the store's location
                            new maplibregl.Marker()
                                .setLngLat([longitude, latitude])
                                .addTo(window.storeMap);
                        } else {
                            // If map already exists, just update its center
                            window.storeMap.setCenter([longitude, latitude]);
                            // A more robust solution might remove old markers and add new ones
                        }
                    }
                }
            }

            displayProducts(data.products); // Render the fetched products for the store
            renderPagination(data.totalPages, page, searchQuery); // Render pagination controls

        } catch (error) {
            console.error('Error fetching store details:', error);
            productsContainer.innerHTML = '<p>Error loading store details.</p>'; // Display error message
        }
    }

    /**
     * @function displayProducts
     * @param {Array<Object>} products - An array of product objects to display.
     * @description Renders the list of products available at the current store into the productsContainer.
     */
    function displayProducts(products) {
        productsContainer.innerHTML = ''; // Clear previous products
        if (products.length > 0) {
            // Create a card for each product
            products.forEach(product => {
                const productCard = document.createElement('div');
                productCard.className = 'product-card';
                productCard.innerHTML = `
                    <img src="${product.image_url || 'https://via.placeholder.com/150'}" alt="${product.name}">
                    <h3>${product.name}</h3>
                    <p>${product.description}</p>
                    <p class="product-price">₱${product.price}</p>
                `;
                productsContainer.appendChild(productCard);
            });
        } else {
            productsContainer.innerHTML = '<p>No products found for this store.</p>'; // Message if no products
        }
    }

    /**
     * @function renderPagination
     * @param {number} totalPages - The total number of pages available.
     * @param {number} currentPage - The currently active page number.
     * @param {string} searchQuery - The current search query, if any, to persist across pagination.
     * @description Renders pagination controls for products within the store.
     */
    function renderPagination(totalPages, currentPage, searchQuery) {
        paginationContainer.innerHTML = ''; // Clear existing pagination
        if (totalPages <= 1) {
            return; // No pagination needed if only one or no pages
        }

        const ul = document.createElement('ul');
        ul.className = 'pagination';

        /**
         * @function createPageLink
         * @param {number} page - The page number for the link.
         * @param {string|number} text - The display text for the link (defaults to page number).
         * @param {boolean} disabled - Whether the link should be disabled.
         * @param {boolean} active - Whether the link should be marked as active.
         * @returns {HTMLElement} The created list item (li) element containing the page link.
         * @description Helper function to create individual page link elements for pagination.
         */
        const createPageLink = (page, text = page, disabled = false, active = false) => {
            const li = document.createElement('li');
            li.className = `page-item ${disabled ? 'disabled' : ''} ${active ? 'active' : ''}`;
            const a = document.createElement('a');
            a.className = 'page-link';
            a.href = '#'; // Use hash to prevent full page reload
            a.textContent = text;
            if (!disabled) {
                // Attach click event listener to fetch and display products for the selected page
                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    if(page > 0 && page <= totalPages) { // Ensure page number is valid
                        fetchAndDisplayStore(page, searchQuery);
                    }
                });
            }
            li.appendChild(a);
            return li;
        };

        // Page numbers to display, including first, last, and around current page
        const pages = [];
        const pagesAround = 2; // Number of pages to show around the current page

        pages.push(1); // Always include the first page
        if (totalPages > 1) {
            pages.push(totalPages); // Always include the last page if more than one
        }

        // Add pages around the current page, ensuring they are within bounds
        for (let i = Math.max(2, currentPage - pagesAround); i <= Math.min(totalPages - 1, currentPage + pagesAround); i++) {
            pages.push(i);
        }
        
        // Remove duplicates and sort the page numbers for correct display order
        const uniquePages = [...new Set(pages)].sort((a, b) => a - b);
        
        // Append all unique page links to the pagination unordered list
        for (const page of uniquePages) {
            ul.appendChild(createPageLink(page, page, false, page === currentPage));
        }

        paginationContainer.appendChild(ul); // Add the pagination ul to the container
    }

    // Initial load: Fetch and display store details and products when the page loads
    fetchAndDisplayStore();

    // Back button functionality
    const backButton = document.getElementById('back-button');
    if (backButton) {
        backButton.addEventListener('click', () => {
            window.history.back(); // Navigate back to the previous page in history
        });
    }
});