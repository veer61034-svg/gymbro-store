// Cart functions (existing - enhanced)
let cart = JSON.parse(localStorage.getItem('gymbroCart')) || [];
let cachedCollections = [];
let cachedStorefrontProducts = [];

// ===== PRODUCTS: fetch from Firestore + render cards =====

function formatINR(productPrice) {
    const inr = Number(productPrice);
    if (Number.isNaN(inr)) return '₹0 INR';
    return `₹${Math.round(inr)} INR`;
}


function productCardHTML(p, index = 0) {
    const name = p?.name ?? 'Unnamed';
    const category = p?.category ?? 'uncategorized';
    const description = p?.description ?? '';
    const image = p?.image ?? '';
    const stock = typeof p?.stock === 'number' ? p.stock : 0;

    const priceINR = formatINR(p?.price);

    const badgeHTML = stock <= 0 ? `<span class="sale-badge" style="background:#333;">OUT OF STOCK</span>` : '';

    const safeIndex = Number(index) || 0;

    return `
        <div class="product-card" data-category="${String(category)}" style="cursor: default;">
            ${badgeHTML}
            <div class="product-image" data-lazybg="${String(image)}" style="background-color:#1a1a1a;">
            </div>
            <div class="product-info">
                <span class="category-label">${String(category).toUpperCase()}</span>
                <h3 class="product-name">${String(name)}</h3>
                <div class="price">${priceINR}</div>
                <p style="color:#ccc; font-size:13px; line-height:1.6; margin-bottom:14px; min-height:42px;">
                    ${String(description).slice(0, 90)}
                </p>
                <button
                    class="btn-cart"
                    data-price="${String(p?.price ?? 0)}"
                    data-name="${String(name)}"
                    ${stock <= 0 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}
                >${stock <= 0 ? 'NOT AVAILABLE' : 'ADD TO CART'}</button>
            </div>
        </div>
    `;
}

async function loadProducts() {
    // Wait if Firebase DB modules are not loaded yet
    if (typeof window.dbGetProducts !== 'function') {
        setTimeout(loadProducts, 50);
        return;
    }

    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    grid.innerHTML = `
        <div class="product-card" style="cursor: default;">
            <div class="product-image" style="height: 280px; display:flex; align-items:center; justify-content:center;">
                <span style="color:#ccc; font-weight:600;">Loading products...</span>
            </div>
            <div class="product-info">
                <span class="category-label" style="opacity:0;">LOADING</span>
                <h3 class="product-name" style="opacity:0;">&nbsp;</h3>
                <div class="price" style="opacity:0;">&nbsp;</div>
                <button class="btn-cart" style="opacity:0; pointer-events:none;">ADD TO CART</button>
            </div>
        </div>
    `;

    try {
        const data = await window.dbGetProducts();

        if (!data || !data.ok) {
            throw new Error('Failed to load products');
        }

        const products = Array.isArray(data.products) ? data.products : [];
        cachedStorefrontProducts = products;

        const sorted = sortProductsList(products);
        renderProducts(sorted);
    } catch (err) {
        console.error('loadProducts error:', err);

        grid.innerHTML = `
            <div class="product-card" style="cursor: default;">
                <div class="product-image" style="height: 280px; display:flex; align-items:center; justify-content:center;">
                    <span style="color:#ff4757; font-weight:700;">Could not load products</span>
                </div>
                <div class="product-info">
                    <span class="category-label">ERROR</span>
                    <h3 class="product-name">Please refresh</h3>
                    <div class="price">—</div>
                    <button class="btn-cart" style="opacity:0.5; pointer-events:none;">ADD TO CART</button>
                </div>
            </div>
        `;
    }
}

function sortProductsList(products) {
    const dropdown = document.getElementById('sortDropdown');
    if (!dropdown) return products;

    const val = dropdown.value;
    const sorted = [...products];

    if (val === 'price-desc') {
        sorted.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    } else if (val === 'price-asc') {
        sorted.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    }

    return sorted;
}

function renderProducts(products) {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    if (!products.length) {
        grid.innerHTML = `
            <div class="product-card" style="cursor: default;">
                <div class="product-image" style="height: 280px; display:flex; align-items:center; justify-content:center;">
                    <span style="color:#ccc; font-weight:600;">No products found</span>
                </div>
                <div class="product-info">
                    <span class="category-label">EMPTY</span>
                    <h3 class="product-name">&nbsp;</h3>
                    <div class="price">&nbsp;</div>
                    <button class="btn-cart" style="opacity:0.5; pointer-events:none;">ADD TO CART</button>
                </div>
            </div>
        `;
        return;
    }

    grid.innerHTML = products.map((p, idx) => productCardHTML(p, idx)).join('');

    // Dynamically build category filter buttons
    const filterWrapper = document.getElementById('categoryFilterButtons');
    if (filterWrapper) {
        const activeBtn = filterWrapper.querySelector('.filter-btn.active');
        const activeCategory = activeBtn ? (activeBtn.dataset.filter || activeBtn.dataset.category) : 'all';

        const getCategoryLabel = (cat) => {
            const found = cachedCollections.find(c => c.id === cat);
            if (found) return found.name;
            const categoryLabels = {
                'hoodies': 'Hoodies',
                'oversized': 'Oversized Tees',
                'trackpants': 'Track Pants',
                'accessories': 'Accessories'
            };
            if (categoryLabels[cat]) return categoryLabels[cat];
            return cat.split(/[-_]+/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        };

        const uniqueCategories = [...new Set(products.map(p => p.category).filter(Boolean))];
        uniqueCategories.sort();

        let buttonsHTML = `<button class="filter-btn ${activeCategory === 'all' ? 'active' : ''}" data-filter="all" data-category="all">All</button>`;
        uniqueCategories.forEach(cat => {
            buttonsHTML += `<button class="filter-btn ${activeCategory === cat ? 'active' : ''}" data-filter="${cat}" data-category="${cat}">${getCategoryLabel(cat)}</button>`;
        });

        filterWrapper.innerHTML = buttonsHTML;

        // Bind click event listeners to new filter buttons
        filterWrapper.querySelectorAll('.filter-btn').forEach(button => {
            button.addEventListener('click', function (e) {
                e.preventDefault();
                const category = this.dataset.filter || this.dataset.category;
                if (!category) return;
                filterAndScroll(category);
            });
        });
    }

    // Ensure filters apply to freshly rendered cards
    const activeBtn = document.querySelector('.filter-btn.active')
        || document.querySelector('.filter-btn[data-filter="all"].active')
        || document.querySelector('.filter-btn[data-category="all"].active');

    const activeCategory = activeBtn?.dataset?.filter || activeBtn?.dataset?.category || 'all';
    filterProducts(activeCategory);

    // Notify lazy-loader that new product images are available
    document.dispatchEvent(new CustomEvent('productsRendered'));
}




function addToCart(name, price, event) {
    // Merge with existing cart item if the same product is already in the cart
    const existing = cart.find(item => item.name === name);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ name, price: price, quantity: 1 });
    }

    updateCart();

    // Visual feedback: button press animation
    if (event) {
        const btn = event.target.closest('.btn-cart') || event.target;
        btn.style.transform = 'scale(0.95)';
        setTimeout(() => btn.style.transform = '', 150);
    }

    // Toast confirmation so user knows it worked (especially important on mobile)
    const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
    showToast('✓ ' + name + ' added to cart! (' + totalItems + ' item' + (totalItems > 1 ? 's' : '') + ')', 'success');
}


function updateCart() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartCountEl = document.getElementById('cartCount');
    if (cartCountEl) cartCountEl.textContent = count; // null guard: element only exists on index.html
    renderCart();
    localStorage.setItem('gymbroCart', JSON.stringify(cart));
}

function renderCart() {
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    if (!cartItems || !cartTotal) return; // Guard: cart sidebar doesn't exist on every page

    if (cart.length === 0) {
        cartItems.innerHTML = '<p style="text-align: center; color: #ccc; margin: 40px 0;">Your cart is empty</p>';
        cartTotal.textContent = '₹0 INR';
        return;
    }

    cartItems.innerHTML = cart.map((item, index) => `
        <div style="display: flex; gap: 15px; padding: 20px 0; border-bottom: 1px solid #333;">
            <div style="flex: 1;">
                <h4 style="margin-bottom: 5px;">${item.name}</h4>
                <div style="font-size: 14px; color: #ccc; margin-bottom: 8px;">${item.quantity} × ₹${Math.round(item.price)}</div>
                <p style="color: #ff4757; font-weight: 700; font-size: 18px;">₹${Math.round(item.price * item.quantity)} INR</p>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <button onclick="changeQuantity(${index}, -1)" style="background: none; border: none; color: #ccc; font-size: 20px; cursor: pointer;">−</button>
                <span style="min-width: 30px; text-align: center; font-weight: 600;">${item.quantity}</span>
                <button onclick="changeQuantity(${index}, 1)" style="background: none; border: none; color: #ccc; font-size: 20px; cursor: pointer;">+</button>
                <button onclick="removeItem(${index})" style="background: none; border: none; color: #ff4757; font-size: 20px; cursor: pointer;">×</button>
            </div>
        </div>
    `).join('');

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    cartTotal.textContent = `₹${Math.round(total)} INR`;
}

function changeQuantity(index, delta) {
    cart[index].quantity += delta;
    if (cart[index].quantity <= 0) cart.splice(index, 1);
    updateCart();
}

function removeItem(index) {
    cart.splice(index, 1);
    updateCart();
}

function toggleCart() {
    document.getElementById('cartSidebar').classList.toggle('active');
    document.getElementById('cartOverlay').classList.toggle('active');
}

function closeCart() {
    document.getElementById('cartSidebar').classList.remove('active');
    document.getElementById('cartOverlay').classList.remove('active');
}

function toggleGymbroMenu() {
    const menu = document.getElementById('gymbroNavMenu');
    const toggle = document.getElementById('gymbroNavToggle');
    if (!menu || !toggle) return;

    const isOpen = menu.classList.toggle('is-open');
    document.body.classList.toggle('gymbro-menu-open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.classList.toggle('is-active', isOpen);
}

function closeGymbroMenu() {
    const menu = document.getElementById('gymbroNavMenu');
    const toggle = document.getElementById('gymbroNavToggle');
    if (!menu || !toggle) return;

    menu.classList.remove('is-open');
    document.body.classList.remove('gymbro-menu-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.classList.remove('is-active');
}

// Open the checkout modal (replaces 9 sequential prompt() dialogs)
function openCheckoutModal() {
    if (cart.length === 0) {
        showToast('Your cart is empty!', 'error');
        return;
    }
    const modal = document.getElementById('checkoutModal');
    if (!modal) return;
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    renderCheckoutSummary();
    // Clear previous form state
    const form = document.getElementById('checkoutForm');
    if (form) form.reset();
    clearCheckoutErrors();
}

function closeCheckoutModal() {
    const modal = document.getElementById('checkoutModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
}

function renderCheckoutSummary() {
    const el = document.getElementById('co_cartSummary');
    if (!el) return;
    const total = Math.round(cart.reduce((s, i) => s + (i.price * i.quantity), 0));
    const itemsHTML = cart.map(i => `
        <div class="co-summary-row">
            <span>${i.quantity}× ${String(i.name)}</span>
            <span>₹${Math.round(i.price * i.quantity).toLocaleString()}</span>
        </div>
    `).join('');
    el.innerHTML = `
        ${itemsHTML}
        <div class="co-summary-row co-total">
            <span>Total</span>
            <span>₹${total.toLocaleString()} INR</span>
        </div>
    `;
}

async function submitCheckoutOrder(e) {
    e.preventDefault();
    if (!validateCheckoutForm()) return;

    const btn = document.getElementById('placeOrderBtn');
    if (btn.disabled) return; // Preventing accidental double-click submissions

    const originalHTML = btn.innerHTML;
    btn.disabled = true; // Disabling the Place Order button immediately after the first click
    btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:8px;"></i>Processing Order...'; // Showing a loading spinner or "Processing Order..." text

    const payload = {
        customer:       document.getElementById('co_name').value.trim(),
        customerEmail:  document.getElementById('co_email').value.trim(),
        customerMobile: document.getElementById('co_mobile').value.trim(),
        paymentMethod:  document.getElementById('co_payment').value.trim(),
        houseNo:        document.getElementById('co_house').value.trim(),
        street:         document.getElementById('co_street').value.trim(),
        city:           document.getElementById('co_city').value.trim(),
        state:          document.getElementById('co_state').value.trim(),
        pincode:        document.getElementById('co_pincode').value.trim(),
        items:          cart.map(i => ({ name: i.name, price: i.price, quantity: i.quantity })),
        total:          Math.round(cart.reduce((s, i) => s + (i.price * i.quantity), 0)),
        totalItems:     cart.reduce((s, i) => s + i.quantity, 0),
        date:           new Date().toLocaleString('en-IN')
    };

    try {
        if (typeof window.dbAddOrder !== 'function') {
            throw new Error('Database not ready. Please try again in a moment.');
        }
        const data = await window.dbAddOrder(payload);
        const orderId = data?.order?._id || data?.order?.id || 'ORDER-' + Date.now();

        closeCheckoutModal();
        closeCart();
        localStorage.removeItem('gymbroCart');
        cart = [];
        updateCart();
        showToast('✅ Order ' + orderId + ' placed! We\'ll contact you on WhatsApp shortly.', 'success');
    } catch (err) {
        console.error('Order placement error:', err);
        showToast('❌ ' + (err.message || 'Order failed. Please try again.'), 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

function validateCheckoutForm() {
    clearCheckoutErrors();
    let valid = true;
    const emailRegex   = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const mobileRegex  = /^[0-9]{10}$/;
    const pincodeRegex = /^\d{4,10}$/;

    const checks = [
        { id: 'co_name',    label: 'Full Name',      test: v => v.length >= 2 },
        { id: 'co_email',   label: 'Email',           test: v => emailRegex.test(v),   msg: 'Enter a valid email address.' },
        { id: 'co_mobile',  label: 'Mobile Number',   test: v => mobileRegex.test(v),  msg: 'Enter a valid 10-digit mobile number.' },
        { id: 'co_house',   label: 'House / Flat No', test: v => v.length >= 1 },
        { id: 'co_street',  label: 'Street Address',  test: v => v.length >= 3 },
        { id: 'co_city',    label: 'City',            test: v => v.length >= 2 },
        { id: 'co_state',   label: 'State',           test: v => v.length >= 2 },
        { id: 'co_pincode', label: 'Pincode',         test: v => pincodeRegex.test(v), msg: 'Enter a valid pincode (4–10 digits).' },
        { id: 'co_payment', label: 'Payment Method',  test: v => v.length >= 1 },
    ];

    checks.forEach(c => {
        const el  = document.getElementById(c.id);
        const val = el ? el.value.trim() : '';
        const ok  = val && c.test(val);
        if (!ok) {
            valid = false;
            const errEl = document.getElementById(c.id + '_err');
            if (errEl) {
                errEl.textContent = c.msg || (val ? c.label + ' is invalid.' : c.label + ' is required.');
                errEl.style.display = 'block';
            }
            if (el) el.style.borderColor = '#ff4757';
        }
    });
    return valid;
}

function clearCheckoutErrors() {
    document.querySelectorAll('.co-field-err').forEach(el => {
        el.textContent = '';
        el.style.display = 'none';
    });
    document.querySelectorAll('.co-input').forEach(el => {
        el.style.borderColor = 'rgba(255,255,255,0.15)';
    });
}

function showToast(message, type) {
    type = type || 'success';
    const existing = document.getElementById('gymbroToast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'gymbroToast';
    const bg = type === 'success' ? 'rgba(46,213,115,0.96)' : 'rgba(255,71,87,0.96)';
    toast.style.cssText = [
        'position:fixed', 'bottom:28px', 'right:28px',
        'padding:14px 20px', 'border-radius:12px',
        'color:#fff', 'font-family:\'Poppins\',sans-serif',
        'font-weight:600', 'font-size:0.88rem',
        'z-index:9999', 'background:' + bg,
        'box-shadow:0 8px 30px rgba(0,0,0,0.4)',
        'backdrop-filter:blur(10px)', 'max-width:320px',
        'line-height:1.5', 'animation:toastSlideIn 0.3s ease'
    ].join(';');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function () {
        toast.style.transition = 'all 0.35s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(30px)';
        setTimeout(function () { toast.remove(); }, 350);
    }, 4500);
}

document.getElementById('cartOverlay').addEventListener('click', closeCart);

// Smooth scroll for hero buttons
function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (!element) return;

    // Premium-feel scroll to the top of the PRODUCTS section.
    // Use scrollIntoView exactly as requested to avoid jumpy anchor behavior.
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });

}

// PROFESSIONAL PRODUCT FILTERING - Scoped to .product-grid only
function filterProducts(category, clickedButton = null) {

    const buttons = document.querySelectorAll('.filter-btn');
    const products = document.querySelectorAll('.product-grid .product-card'); // Scoped to grid only

    // Active button management
    buttons.forEach(btn => btn.classList.remove('active'));
    if (clickedButton) clickedButton.classList.add('active');

    // Professional filtering with smooth transitions
    products.forEach((product, index) => {
        const matchesCategory = category === 'all' || product.dataset.category === category;

        if (matchesCategory) {
            product.style.display = 'block';
            product.style.opacity = '0';
            product.style.transform = 'translateY(20px) scale(0.95)';
            setTimeout(() => {
                product.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                product.style.opacity = '1';
                product.style.transform = 'translateY(0) scale(1)';
            }, 50 * index); // Staggered animation
        } else {
            product.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
            product.style.opacity = '0';
            product.style.transform = 'translateY(10px) scale(0.98)';
            setTimeout(() => {
                product.style.display = 'none';
            }, 250);
        }
    });
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', async function () {
    // Cart initialization
    updateCart();

    // Load collections, then products
    await loadCollections();
    loadProducts();

    // Filter button event listeners (supports data-filter + data-category for compatibility)

    document.querySelectorAll('.filter-btn').forEach(button => {
        button.addEventListener('click', function (e) {
            e.preventDefault();
            const category = this.dataset.filter || this.dataset.category;
            if (!category) return;
            filterAndScroll(category);
        });
    });

    // Initialize "All" filter active
    const allButton = document.querySelector('.filter-btn[data-category="all"]');
    if (allButton) allButton.classList.add('active');

    // Mobile hamburger toggle (handled via inline onclick attribute to prevent double-triggering)
    // const navToggle = document.getElementById('gymbroNavToggle');
    // const navMenu = document.getElementById('gymbroNavMenu');
    // if (navToggle && navMenu) {
    //     navToggle.addEventListener('click', toggleGymbroMenu);
    // }

    // Navbar scroll effects and story reveal are handled by the IIFEs below
        // (those versions run immediately on load AND call unobserve after reveal, which is better)

    // Sort dropdown change listener
    const sortDropdown = document.getElementById('sortDropdown');
    if (sortDropdown) {
        sortDropdown.addEventListener('change', function () {
            const sorted = sortProductsList(cachedStorefrontProducts);
            renderProducts(sorted);
        });
    }
});

// Load collections dynamically from Cloud Firestore or Mock
async function loadCollections() {
    const grid = document.getElementById('collectionsGrid');
    if (!grid) return;

    try {
        if (typeof window.dbGetCollections !== 'function') {
            setTimeout(loadCollections, 100);
            return;
        }

        const collections = await window.dbGetCollections();
        cachedCollections = collections;
        
        let html = `
            <div class="collection-card filter-btn active" data-filter="all"
                style="background-image: url('images/gymbro-logo.jpg'); background-size: cover; background-repeat: no-repeat; background-position: center;">
                <div class="collection-title">ALL</div>
            </div>
        `;
        
        collections.forEach(c => {
            const slug = c.id || c.slug;
            html += `
                <div class="collection-card filter-btn" data-filter="${slug}"
                    style="background-image: url('${c.image}'); background-size: cover; background-repeat: no-repeat; background-position: center;">
                    <div class="collection-title">${c.name.toUpperCase()}</div>
                </div>
            `;
        });
        
        grid.innerHTML = html;
        
        // Bind click event listeners to dynamic collection cards
        grid.querySelectorAll('.filter-btn').forEach(card => {
            card.addEventListener('click', function (e) {
                e.preventDefault();
                const category = this.dataset.filter || this.dataset.category;
                if (!category) return;
                filterAndScroll(category);
            });
        });
    } catch (err) {
        console.error("Error loading collections:", err);
    }
}

// COLLECTIONS → PRODUCTS FILTERING ENHANCEMENT
function filterAndScroll(category) {
    // Ensure filter click doesn't trigger any anchor hash/navigation.
    // (Buttons/links are handled by event.preventDefault() where applicable.)
    filterProducts(category);


    // Activate filter button
    const filterBtn = document.querySelector(`.filter-btn[data-category="${category}"], .filter-btn[data-filter="${category}"]`);
    if (filterBtn) filterBtn.classList.add('active');

    // Activate collection card
    const collectionCard = document.querySelector(`.collection-card[data-filter="${category}"]`);
    if (collectionCard) collectionCard.classList.add('active');

    // Remove active from others
    document.querySelectorAll('.filter-btn, .collection-card').forEach(el => {
        if (el !== filterBtn && el !== collectionCard) el.classList.remove('active');
    });

    scrollToSection('products');
}


// Delegated add-to-cart click handling (works for dynamically rendered buttons)
// Prevent duplicate bindings by using a single document-level listener.
document.addEventListener('click', function (e) {
    const btn = e.target.closest('.btn-cart');
    if (!btn) return;
    if (btn.disabled) return;

    const productInfo = btn.closest('.product-info');
    if (!productInfo) return;

    const name = btn.dataset.name;
    const rawPrice = btn.dataset.price;

    const price = Number(rawPrice);
    if (!name || Number.isNaN(price)) return;

    addToCart(name, price, e);
});

// Navbar scroll effect — darken navbar when user scrolls past the hero
(function () {
    const navbar = document.querySelector('.gymbro-navbar');
    if (!navbar) return;

    function onScroll() {
        if (window.scrollY > 60) {
            navbar.classList.add('gymbro-navbar--scrolled');
        } else {
            navbar.classList.remove('gymbro-navbar--scrolled');
        }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // Run once on load
})();

// Story section reveal animation using IntersectionObserver
(function () {
    const reveals = document.querySelectorAll('.story-reveal');
    if (!reveals.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });

    reveals.forEach(el => observer.observe(el));
})();// Lazy-load product background images via IntersectionObserver
(function () {
    const supportsObserver = 'IntersectionObserver' in window;
    if (!supportsObserver) return;

    const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                const el = entry.target;
                const bg = el.dataset.lazybg;
                if (bg) {
                    el.style.backgroundImage = 'url(\'' + bg + '\')';
                    el.removeAttribute('data-lazybg');
                    observer.unobserve(el);
                }
            }
        });
    }, { rootMargin: '120px' });

    // Observe any .product-image elements with data-lazybg set
    function observeProductImages() {
        document.querySelectorAll('.product-image[data-lazybg]').forEach(function (el) {
            observer.observe(el);
        });
    }

    // Run now and after products render
    observeProductImages();
    document.addEventListener('productsRendered', observeProductImages);
})();

// ESC key closes checkout modal
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        if (typeof closeCheckoutModal === 'function') closeCheckoutModal();
    }
});
