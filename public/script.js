document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    // Get references to various elements in the DOM to be manipulated later.
    const searchForm = document.getElementById('search-form'); // The search form element
    const searchInput = document.getElementById('search-input'); // The input field for search queries
    const productList = document.getElementById('product-list'); // Container for displaying product search results
    const loadingSpinner = document.getElementById('loading-spinner'); // Element to show/hide during loading
    const categoryFilter = document.getElementById('category-filter'); // Dropdown for filtering results by category
    const resultsFilter = document.getElementById('results-filter'); // Container for search filters (e.g., category filter)
    const paginationContainer = document.getElementById('pagination-container'); // Container for pagination controls

    // State variables
    let currentQuery = ''; // Stores the current search query entered by the user
    const limit = 10; // Number of search results to display per page

    /**
     * @async
     * @function initializeCategories
     * @description Fetches all available product categories from the backend API
     *              and populates the category filter dropdown.
     */
    async function initializeCategories() {
        try {
            const response = await fetch('/api/categories');
            if (!response.ok) throw new Error('Failed to fetch categories');
            const categories = await response.json();
            
            // Add each fetched category as an option in the dropdown
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.category_id; // Category ID as the option value
                option.textContent = category.category_name; // Category name as display text
                categoryFilter.appendChild(option);
            });
        } catch (error) {
            console.error('Error initializing categories:', error);
        }
    }

    // Event Listener for Search Form Submission
    // Prevents default form submission and initiates a new search
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault(); // Prevent the browser from reloading the page
        const query = searchInput.value.trim(); // Get the search query, remove leading/trailing whitespace
        if (query) {
            currentQuery = query; // Update the current query state
            document.body.classList.add('search-active'); // Add a class to body to indicate search is active
            // Reset category filter to "All Categories" for a new search to ensure broad initial results
            categoryFilter.value = ""; 
            performSearch(1); // Perform search starting from the first page
        }
    });

    // Event Listener for Category Filter Change
    // Triggers a new search when the user selects a different category
    categoryFilter.addEventListener('change', () => {
        if (currentQuery) { // Only perform a search if there's an active query
            performSearch(1); // Perform search with the selected category, starting from the first page
        }
    });

    /**
     * @async
     * @function performSearch
     * @param {number} page - The page number to fetch search results for.
     * @description Executes the search query against the backend API,
     *              displays loading indicators, and renders results and pagination.
     */
    async function performSearch(page) {
        // Clear previous results and pagination
        productList.innerHTML = '';
        paginationContainer.innerHTML = '';
        loadingSpinner.classList.remove('d-none'); // Show loading spinner
        resultsFilter.classList.remove('d-none'); // Ensure filter is visible after first search

        // Construct API URL with query, pagination, and optional category filter
        const selectedCategoryId = categoryFilter.value;
        let apiUrl = `/api/search?q=${encodeURIComponent(currentQuery)}&page=${page}&limit=${limit}`;
        if (selectedCategoryId) {
            apiUrl += `&category_id=${selectedCategoryId}`; // Add category filter if selected
        }

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const { products, total } = await response.json(); // Destructure products and total count from response
            
            displayResults(products); // Render the fetched products
            renderPagination(total, page); // Render pagination controls based on total results

        } catch (error) {
            console.error('Error fetching search results:', error);
            // Display an error message to the user
            productList.innerHTML = '<p class="text-danger text-center">Failed to fetch results. Please try again later.</p>';
        } finally {
            loadingSpinner.classList.add('d-none'); // Hide loading spinner regardless of success or failure
        }
    }

    /**
     * @function displayResults
     * @param {Array<Object>} products - An array of product objects to display.
     * @description Renders the product search results dynamically into the productList container.
     *              Includes product details, store availability, price ranges, and hover popups.
     */
    function displayResults(products) {
        if (products.length === 0) {
            productList.innerHTML = '<p class="text-center col-12">No products found.</p>';
            return;
        }

        const fragment = document.createDocumentFragment(); // Use a DocumentFragment for efficient DOM updates
        products.forEach(product => {
            const productElement = document.createElement('div');
            productElement.className = 'result-item mb-4';
            
            // Concatenate product descriptions
            const descriptions = [product.product_desc1, product.product_desc2, product.product_desc3];
            const fullDescription = descriptions.filter(desc => desc).join(' ');

            // Generate HTML for stores where the product is available
            let storesHtml = '<p class="result-stores-title mt-2">Available at:</p><ul class="list-unstyled">';
            if (product.store_names) {
                // Split concatenated store details into arrays
                const storeNames = (product.store_names || '').split('||');
                const storeBarangays = (product.store_barangays || '').split('||');
                const storeStreets = (product.store_streets || '').split('||');
                const storeCities = (product.store_cities || '').split('||');
                const storeIds = (product.store_ids || '').split('||');

                // Iterate through each store to create a list item
                storeNames.forEach((name, index) => {
                    storesHtml += `
                        <li class="store-item">
                            <a style="text-decoration: none;" href="store.html?store_id=${storeIds[index]}">
                                <span class="store-name" 
                                      data-store-id="${storeIds[index]}" 
                                      data-product-id="${product.product_id}"
                                      data-product-name="${product.product_name}"
                                      data-product-image="${product.product_image_url || ''}"
                                      data-product-desc="${product.product_desc1 || ''}">${name}</span>
                            </a>
                            <span class="store-location">- ${storeStreets[index]}, ${storeCities[index]}, ${storeBarangays[index]}</span>
                        </li>`;
                });
            } else {
                storesHtml += '<li class="store-item">Not available in any store.</li>';
            }
            storesHtml += '</ul>';

            // Determine and format price display (range or single price)
            let priceHtml = '';
            if (product.min_price && product.max_price) {
                if (parseFloat(product.min_price) === parseFloat(product.max_price)) {
                    priceHtml = `₱${parseFloat(product.min_price).toFixed(2)}`;
                } else {
                    priceHtml = `₱${parseFloat(product.min_price).toFixed(2)} - ₱${parseFloat(product.max_price).toFixed(2)}`;
                }
            } else if (product.min_price) {
                priceHtml = `₱${parseFloat(product.min_price).toFixed(2)}`;
            } else {
                priceHtml = 'Price not available';
            }

            // Construct the full HTML for a single product item
            productElement.innerHTML = `
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <p class="result-title">${product.product_name}</p>
                        <p class="result-price mb-0"><span class="product-price">${priceHtml}</span></p>
                        <p class="result-description">${fullDescription}</p>
                        ${storesHtml}
                    </div>
                    <div class="result-image-placeholder ms-3">
                        <img src="${product.product_image_url || 'https://via.placeholder.com/100x100?text=No+Image'}" alt="Product Image" class="img-fluid">
                    </div>
                </div>`;
            fragment.appendChild(productElement);
        });
        productList.appendChild(fragment); // Append all product elements to the DOM in one go

        // Add event listeners for store names to show/hide popup on hover
        document.querySelectorAll('.store-name').forEach(storeNameElement => {
            storeNameElement.addEventListener('mouseenter', showStorePopup);
            storeNameElement.addEventListener('mouseleave', hideStorePopup);
        });
    }

    // Store Popup functionality
    const storePopup = document.getElementById('store-popup'); // The popup element for store details
    let popupTimeout; // Timeout variable to control popup hiding delay

    /**
     * @async
     * @function fetchPopupDetails
     * @param {string} productId - The ID of the product.
     * @param {string} storeId - The ID of the store.
     * @returns {Promise<Object|null>} - Details about the store and product price at that store, or null if an error occurs.
     * @description Fetches detailed information for a specific store and product combination
     *              for the hover popup.
     */
    async function fetchPopupDetails(productId, storeId) {
        try {
            const response = await fetch(`/api/popup-details?product_id=${productId}&store_id=${storeId}`);
            if (!response.ok) throw new Error('Failed to fetch popup details');
            return await response.json();
        } catch (error) {
            console.error('Error fetching popup details:', error);
            return null;
        }
    }

    /**
     * @async
     * @function showStorePopup
     * @param {Event} event - The mouseenter event object.
     * @description Displays a popup with detailed store and product information when a store name is hovered over.
     *              Includes loading state, dynamic positioning, and data fetching.
     */
    async function showStorePopup(event) {
        clearTimeout(popupTimeout); // Clear any pending hide timeouts
        const storeNameElement = event.target;
        // Extract data attributes from the hovered store name element
        const {
            storeId,
            productId,
            productName,
            productImage,
            productDesc
        } = storeNameElement.dataset;


        if (!storeId || !productId) return; // Exit if essential data is missing

        // Show loading state and position the popup initially
        storePopup.innerHTML = '<div style="display: flex; gap: 1rem;"><div class="store-info"><h3>Loading...</h3></div><div class="product-card" style="opacity: 0.5;"><h3>Loading...</h3></div></div>';
        storePopup.style.display = 'block';

        // Calculate popup position to appear near the mouse
        const offsetY = 100;
        const popupWidth = storePopup.offsetWidth;
        const popupHeight = storePopup.offsetHeight;
        let newLeft = event.clientX - popupWidth + 300;
        let newTop = event.clientY - popupHeight - offsetY;

        // Adjust position if it goes off-screen
        if (newLeft < 0) newLeft = 0;
        if (newTop < 0) newTop = event.clientY + offsetY; // If above screen, show below mouse

        storePopup.style.left = `${newLeft}px`;
        storePopup.style.top = `${newTop}px`;

        // Fetch actual details for the popup content
        const data = await fetchPopupDetails(productId, storeId);

        if (data && data.storeDetails) {
            const { storeDetails, priceDetails } = data;
            
            // Generate star rating HTML
            let starsHtml = '';
            const rating = storeDetails.store_rating;
            for (let i = 0; i < 5; i++) {
                if (i < rating) {
                    starsHtml += '★'; // Filled star
                } else {
                    starsHtml += '☆'; // Empty star
                }
            }

            // Format price for the product at this specific store
            let priceHtml = '';
            if (priceDetails && priceDetails.price) {
                priceHtml = `<p class="product-price">₱${parseFloat(priceDetails.price).toFixed(2)}</p>`;
            } else {
                priceHtml = `<p class="product-price">Not sold here</p>`;
            }

            // Construct HTML for store information section of the popup
            const storeInfoHtml = `
                <div class="store-info" style="border-right: 1px solid #ccc; padding-right: 1rem;">
                    <h3>${storeDetails.store_name}</h3>
                    <p>${storeDetails.store_street}, ${storeDetails.store_city}, ${storeDetails.store_barangay}</p>
                    <p>Rating: <span class="stars">${starsHtml}</span></p>
                    <img src="${storeDetails.store_image_url || 'https://via.placeholder.com/300?text=No+Image'}" alt="Store Image" style="width: 150px; height: 150px; object-fit: cover;">
                </div>
            `;

            // Construct HTML for product information section of the popup
            const productInfoHtml = `
                <div class="product-card">
                    <img src="${productImage || 'https://via.placeholder.com/300?text=No+Image'}" alt="${productName}" style="width: 150px; height: 150px; object-fit: cover;">
                    <h3>${productName}</h3>
                    <p>${productDesc}</p>
                    ${priceHtml}
                </div>
            `;

            // Update popup content with fetched details
            storePopup.innerHTML = `<div style="display: flex; gap: 1rem;">${storeInfoHtml}${productInfoHtml}</div>`;
        } else {
            // Display error if details could not be loaded
            storePopup.innerHTML = '<h3>Error</h3><p>Could not load store details.</p>';
        }
    }

    /**
     * @function hideStorePopup
     * @description Hides the store popup after a short delay, allowing the user to
     *              move the mouse to the popup without it disappearing immediately.
     */
    function hideStorePopup() {
        popupTimeout = setTimeout(() => {
            storePopup.style.display = 'none';
        }, 200); // Delay hiding to allow moving mouse over popup
    }

    // Event Listener to prevent popup from hiding if mouse enters the popup itself
    storePopup.addEventListener('mouseenter', () => {
        clearTimeout(popupTimeout); // Clear the hide timeout if mouse enters popup
    });

    // Event Listener to hide popup when mouse leaves the popup
    storePopup.addEventListener('mouseleave', hideStorePopup);

    /**
     * @function renderPagination
     * @param {number} total - The total number of available search results.
     * @param {number} currentPage - The currently active page number.
     * @description Renders pagination controls based on the total number of results
     *              and the current page.
     */
    function renderPagination(total, currentPage) {
        paginationContainer.innerHTML = ''; // Clear existing pagination
        const totalPages = Math.ceil(total / limit); // Calculate total number of pages

        if (totalPages <= 1) return; // No pagination needed if only one or no pages

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
                // Attach click event listener to perform search for the selected page
                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    if(page > 0 && page <= totalPages) { // Ensure page number is valid
                        performSearch(page);
                    }
                });
            }
            li.appendChild(a);
            return li;
        };

        // Determine which page numbers to display around the current page
        const pages = [];
        const pagesAround = 2; // Number of pages to show around the current page

        pages.push(1); // Always include the first page
        if (totalPages > 1) {
            pages.push(totalPages); // Always include the last page if more than one
        }

        // Add pages around the current page
        for (let i = Math.max(2, currentPage - pagesAround); i <= Math.min(totalPages - 1, currentPage + pagesAround); i++) {
            pages.push(i);
        }
        
        // Remove duplicates and sort the page numbers
        const uniquePages = [...new Set(pages)].sort((a, b) => a - b);
        
        // Append all unique page links to the pagination unordered list
        for (const page of uniquePages) {
            ul.appendChild(createPageLink(page, page, false, page === currentPage));
        }

        paginationContainer.appendChild(ul); // Add the pagination ul to the container
    }

    // Initializations
    initializeCategories(); // Call to populate the category filter when the page loads
});