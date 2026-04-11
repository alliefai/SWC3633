// ================================================
// MediDeliver — Customer Portal JavaScript
// Student 1: Patient/Customer Interface
// Handles: Browse medicines, cart, checkout, order history
// ================================================

const API = '/api';

// ---- State ----
let currentUser = null;
let cart = JSON.parse(localStorage.getItem('medi_cart') || '[]');
let authMode = 'login';
let currentOrderForCheckout = null;

// Medicine registry — stores medicine objects by id to avoid broken onclick HTML attributes
const medicineRegistry = {};

// ================================================
// ROUTER
// ================================================
const routes = {
    '/':          renderHome,
    '/medicines': renderMedicines,
    '/orders':    renderOrders,
};

function router() {
    const hash = window.location.hash.slice(1) || '/';
    const path = hash.split('?')[0];

    if (path === '/orders' && !currentUser) {
        showToast('Please sign in to view your orders', 'info');
        showAuthModal('login');
        return;
    }

    updateActiveNav(path);
    const fn = routes[path];
    fn ? fn() : renderHome();
}

function go(path) { window.location.hash = path; }

function updateActiveNav(path) {
    document.querySelectorAll('.nav-link').forEach(l => {
        const pg = l.dataset.page;
        const active = path === '/' ? pg === 'home' :
                       path.startsWith('/medicines') ? pg === 'medicines' :
                       path.startsWith('/orders') ? pg === 'orders' : false;
        l.classList.toggle('active', active);
    });
}

// ================================================
// API HELPER
// ================================================
async function api(endpoint, opts = {}) {
    const token = localStorage.getItem('medi_token');
    const res = await fetch(`${API}${endpoint}`, {
        ...opts,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...opts.headers
        }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
    return data;
}

// ================================================
// AUTH
// ================================================
function initAuth() {
    const t = localStorage.getItem('medi_token');
    const u = localStorage.getItem('medi_user');
    if (t && u) {
        currentUser = JSON.parse(u);
        syncNavAuth();
    }
}

function syncNavAuth() {
    const loggedIn = !!currentUser;
    document.getElementById('btn-login').style.display    = loggedIn ? 'none' : '';
    document.getElementById('btn-register').style.display = loggedIn ? 'none' : '';
    document.getElementById('user-pill').style.display    = loggedIn ? 'flex' : 'none';
    if (loggedIn) {
        document.getElementById('user-name-display').textContent = currentUser.name?.split(' ')[0] || 'User';
        document.getElementById('user-avatar').textContent = (currentUser.name || 'U')[0].toUpperCase();
    }
}

function showAuthModal(mode) {
    authMode = mode;
    const extra = mode === 'register';
    document.getElementById('auth-title').textContent    = extra ? 'Create Account' : 'Sign In';
    document.getElementById('auth-subtitle').textContent = extra ? 'Join MediDeliver' : 'Welcome back';
    document.getElementById('auth-submit').textContent   = extra ? 'Create Account' : 'Sign In';
    document.getElementById('fg-name').style.display     = extra ? 'block' : 'none';
    document.getElementById('fg-phone').style.display    = extra ? 'block' : 'none';
    document.getElementById('fg-address').style.display  = extra ? 'block' : 'none';
    document.getElementById('auth-switch').innerHTML     = extra
        ? 'Already have an account? <a href="#" onclick="switchAuthMode(event)">Sign In</a>'
        : 'No account? <a href="#" onclick="switchAuthMode(event)">Register</a>';
    document.getElementById('auth-error').style.display  = 'none';
    document.getElementById('auth-form').reset();
    document.getElementById('auth-modal').style.display  = 'flex';
}
function closeAuthModal() { document.getElementById('auth-modal').style.display = 'none'; }
function switchAuthMode(e) { e.preventDefault(); showAuthModal(authMode === 'login' ? 'register' : 'login'); }

async function submitAuth(e) {
    e.preventDefault();
    const errEl = document.getElementById('auth-error');
    const btn   = document.getElementById('auth-submit');
    errEl.style.display = 'none';
    btn.disabled = true; btn.textContent = 'Please wait...';

    try {
        const email    = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        let data;

        if (authMode === 'register') {
            data = await api('/auth/register', { method: 'POST', body: JSON.stringify({
                name:    document.getElementById('auth-name').value,
                email, password,
                phone:   document.getElementById('auth-phone').value,
                address: document.getElementById('auth-address').value,
                role:    'customer'
            })});
        } else {
            data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
        }

        localStorage.setItem('medi_token', data.token);
        localStorage.setItem('medi_user', JSON.stringify(data.user));
        currentUser = data.user;
        syncNavAuth();
        closeAuthModal();
        showToast(`Welcome, ${data.user.name}! 👋`, 'success');

        // Pre-fill checkout address
        if (data.user.address) {
            const ca = document.getElementById('checkout-address');
            if (ca && !ca.value) ca.value = data.user.address;
        }
        router();
    } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = authMode === 'login' ? 'Sign In' : 'Create Account';
    }
}

function handleLogout() {
    localStorage.removeItem('medi_token');
    localStorage.removeItem('medi_user');
    currentUser = null;
    syncNavAuth();
    showToast('Signed out', 'info');
    go('/');
}

// ================================================
// CART
// ================================================
function saveCart() { localStorage.setItem('medi_cart', JSON.stringify(cart)); }

function addToCart(med) {
    if (!currentUser) {
        showToast('Please sign in first', 'info');
        showAuthModal('login');
        return;
    }
    const existing = cart.find(c => c.id === med.id);
    if (existing) {
        if (existing.qty >= med.stock) { showToast('No more stock available', 'error'); return; }
        existing.qty++;
    } else {
        cart.push({ id: med.id, name: med.name, price: med.price, image_url: med.image_url, unit: med.unit, stock: med.stock, qty: 1 });
    }
    saveCart();
    updateCartBadge(true);
    showToast(`${med.name} added to cart 🛒`, 'success');
    renderCartDrawer();
    updateAddToCartButtons();
}

function removeFromCart(id) {
    cart = cart.filter(c => c.id !== id);
    saveCart();
    updateCartBadge(false);
    renderCartDrawer();
    updateAddToCartButtons();
}

function changeQty(id, delta) {
    const item = cart.find(c => c.id === id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) { removeFromCart(id); return; }
    if (item.qty > item.stock) { item.qty = item.stock; showToast('Maximum stock reached', 'info'); }
    saveCart();
    updateCartBadge(false);
    renderCartDrawer();
}

function updateCartBadge(bump) {
    const total = cart.reduce((s, c) => s + c.qty, 0);
    const badge = document.getElementById('cart-badge');
    badge.textContent = total;
    if (bump) { badge.classList.remove('bump'); void badge.offsetWidth; badge.classList.add('bump'); }
}

function getCartTotal() { return cart.reduce((s, c) => s + c.price * c.qty, 0); }

function renderCartDrawer() {
    const body   = document.getElementById('cart-body');
    const footer = document.getElementById('cart-footer');
    const drawer = document.getElementById('cart-drawer');

    if (cart.length === 0) {
        body.innerHTML = `
            <div class="cart-empty">
                <div class="cart-empty-icon">🛒</div>
                <p>Your cart is empty</p>
                <button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="closeCart(); go('/medicines')">Browse Medicines</button>
            </div>`;
        footer.style.display = 'none';
    } else {
        body.innerHTML = cart.map(item => `
            <div class="cart-item">
                <img class="cart-item-img"
                     src="${item.image_url || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200'}"
                     alt="${item.name}"
                     onerror="this.src='https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200'">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">RM ${(item.price * item.qty).toFixed(2)}</div>
                    <div class="cart-item-controls">
                        <button class="qty-btn" onclick="changeQty(${item.id}, -1)">−</button>
                        <span class="qty-val">${item.qty}</span>
                        <button class="qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
                        <span style="font-size:0.75rem;color:var(--text-muted);">× RM ${item.price.toFixed(2)}</span>
                    </div>
                </div>
                <button class="cart-item-remove" onclick="removeFromCart(${item.id})" title="Remove">🗑️</button>
            </div>
        `).join('');

        const subtotal = getCartTotal();
        document.getElementById('cart-subtotal').textContent    = `RM ${subtotal.toFixed(2)}`;
        document.getElementById('cart-grand-total').textContent = `RM ${(subtotal + 5).toFixed(2)}`;
        footer.style.display = 'block';
    }
}

function showCart() {
    renderCartDrawer();
    document.getElementById('cart-overlay').style.display = 'block';
    document.getElementById('cart-drawer').classList.add('open');
}

function closeCart() {
    document.getElementById('cart-overlay').style.display = 'none';
    document.getElementById('cart-drawer').classList.remove('open');
}

function updateAddToCartButtons() {
    document.querySelectorAll('[data-med-id]').forEach(btn => {
        const id = parseInt(btn.dataset.medId);
        const inCart = cart.find(c => c.id === id);
        if (inCart) {
            btn.textContent = `✓ In Cart (${inCart.qty})`;
            btn.classList.add('in-cart');
        } else {
            btn.innerHTML = '🛒 Add to Cart';
            btn.classList.remove('in-cart');
        }
    });
}

// ================================================
// CHECKOUT
// ================================================
function proceedCheckout() {
    if (!currentUser) { closeCart(); showAuthModal('login'); return; }
    if (cart.length === 0) { showToast('Your cart is empty', 'info'); return; }
    closeCart();

    const itemsHtml = cart.map(item => `
        <div class="checkout-row">
            <img src="${item.image_url || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200'}" alt="${item.name}"
                 onerror="this.src='https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200'">
            <span class="checkout-row-name">${item.name} × ${item.qty}</span>
            <span class="checkout-row-price">RM ${(item.price * item.qty).toFixed(2)}</span>
        </div>
    `).join('');

    document.getElementById('checkout-items-list').innerHTML = `<div class="checkout-items-list">${itemsHtml}</div>`;
    document.getElementById('checkout-error').style.display = 'none';

    const sub = getCartTotal();
    document.getElementById('co-items-total').textContent  = `RM ${sub.toFixed(2)}`;
    document.getElementById('co-grand-total').textContent  = `RM ${(sub + 5).toFixed(2)}`;

    // Pre-fill address from user profile
    const addrEl = document.getElementById('checkout-address');
    if (currentUser?.address && !addrEl.value) addrEl.value = currentUser.address;

    document.getElementById('checkout-modal').style.display = 'flex';
}

function closeCheckout() { document.getElementById('checkout-modal').style.display = 'none'; }

async function placeOrder() {
    const errEl = document.getElementById('checkout-error');
    const btn   = document.getElementById('place-order-btn');
    errEl.style.display = 'none';

    const delivery_address = document.getElementById('checkout-address').value.trim();
    if (!delivery_address) {
        errEl.textContent = 'Please enter your delivery address';
        errEl.style.display = 'block';
        return;
    }

    btn.disabled = true; btn.textContent = 'Placing order...';

    try {
        const items = cart.map(c => ({ medicine_id: c.id, quantity: c.qty }));
        const data = await api('/orders', {
            method: 'POST',
            body: JSON.stringify({
                items,
                delivery_address,
                payment_method: document.getElementById('checkout-payment').value,
                notes: document.getElementById('checkout-notes').value
            })
        });

        // Clear cart
        cart = [];
        saveCart();
        updateCartBadge(false);

        closeCheckout();
        document.getElementById('success-order-id').textContent = `#${data.data.id}`;
        document.getElementById('success-msg').textContent = `Your medicines will be delivered to: ${delivery_address}`;
        document.getElementById('success-modal').style.display = 'flex';

    } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
    } finally {
        btn.disabled = false; btn.textContent = '✅ Place Order';
    }
}

function closeSuccess() {
    document.getElementById('success-modal').style.display = 'none';
    go('/orders');
}

// ================================================
// HOME PAGE
// ================================================
async function renderHome() {
    setContent(loader());
    try {
        const [medsData] = await Promise.all([
            api('/medicines?limit=8&sort=name')
        ]);

        const featured = medsData.data.slice(0, 8);

        setContent(`
        <!-- Hero -->
        <section class="hero">
            <div class="hero-content">
                <h1>Medicines Delivered <span>To Your Door</span></h1>
                <p>Browse 100+ genuine medicines, add to cart, and get them delivered safely to your home across Malaysia.</p>
                <div class="hero-btns">
                    <button class="btn btn-primary" onclick="go('/medicines')" style="padding:12px 28px;font-size:1rem;">
                        🛒 Shop Medicines
                    </button>
                    ${!currentUser ? `<button class="btn btn-outline" onclick="showAuthModal('register')" style="padding:12px 28px;">Create Account</button>` : ''}
                </div>
                <div class="hero-trust">
                    <div class="trust-item"><span>✅</span> Genuine medicines</div>
                    <div class="trust-item"><span>🚀</span> Fast delivery</div>
                    <div class="trust-item"><span>💳</span> Secure checkout</div>
                    <div class="trust-item"><span>📞</span> 24/7 support</div>
                </div>
            </div>
        </section>

        <!-- Featured Medicines -->
        <div class="section">
            <div class="section-head">
                <div>
                    <h2>Featured Medicines</h2>
                    <p>${medsData.pagination.total} products available</p>
                </div>
                <button class="btn btn-outline btn-sm" onclick="go('/medicines')">View All →</button>
            </div>

            <!-- Category quick filters -->
            <div class="cat-pills">
                ${[
                    ['All', ''],
                    ['💊 Painkillers', 'painkillers'],
                    ['🦠 Antibiotics', 'antibiotics'],
                    ['🧪 Vitamins', 'vitamins'],
                    ['🤧 Cold & Flu', 'cold_flu'],
                    ['💆 Skincare', 'skincare'],
                    ['🩺 Diabetes', 'diabetes'],
                    ['❤️ Heart', 'heart'],
                ].map(([label, val]) =>
                    `<button class="cat-pill ${val === '' ? 'active' : ''}"
                             onclick="go('/medicines?cat=${val}')">${label}</button>`
                ).join('')}
            </div>

            <div class="med-grid">
                ${featured.map((m, i) => medCard(m, i)).join('')}
            </div>
        </div>
        `);

        updateAddToCartButtons();
    } catch (err) {
        setContent(errState(err.message));
    }
}

// ================================================
// MEDICINES PAGE
// ================================================
async function renderMedicines() {
    setContent(loader());
    try {
        const hash  = window.location.hash.slice(1);
        const params = new URLSearchParams(hash.split('?')[1] || '');
        const initCat = params.get('cat') || '';

        const data = await api(`/medicines?sort=name${initCat ? '&category=' + initCat : ''}`);

        setContent(`
        <div class="section">
            <div class="section-head">
                <div>
                    <h2>All Medicines</h2>
                    <p id="med-count">${data.pagination.total} products</p>
                </div>
            </div>

            <!-- Category pills -->
            <div class="cat-pills" id="cat-pills">
                ${[
                    ['All', ''],
                    ['💊 Painkillers', 'painkillers'],
                    ['🦠 Antibiotics', 'antibiotics'],
                    ['🧪 Vitamins', 'vitamins'],
                    ['🤧 Cold & Flu', 'cold_flu'],
                    ['💆 Skincare', 'skincare'],
                    ['🩺 Diabetes', 'diabetes'],
                    ['❤️ Heart', 'heart'],
                    ['📦 General', 'general'],
                ].map(([label, val]) =>
                    `<button class="cat-pill ${val === initCat ? 'active' : ''}"
                             onclick="filterMeds('${val}', this)">${label}</button>`
                ).join('')}
            </div>

            <!-- Search & sort -->
            <div class="filter-row">
                <input type="text" id="med-search" placeholder="🔍  Search medicines..."
                       oninput="fetchMeds()" value="">
                <select id="med-sort" onchange="fetchMeds()">
                    <option value="name">Sort: Name A-Z</option>
                    <option value="price">Sort: Price</option>
                    <option value="stock">Sort: Stock</option>
                </select>
                <select id="med-order" onchange="fetchMeds()">
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                </select>
            </div>

            <div class="med-grid" id="med-grid">
                ${data.data.map((m, i) => medCard(m, i)).join('')}
            </div>
        </div>
        `);

        window._activeCat = initCat;
        updateAddToCartButtons();
    } catch (err) {
        setContent(errState(err.message));
    }
}

window._activeCat = '';

async function fetchMeds() {
    const search = document.getElementById('med-search')?.value || '';
    const sort   = document.getElementById('med-sort')?.value || 'name';
    const order  = document.getElementById('med-order')?.value || 'asc';
    const cat    = window._activeCat || '';

    try {
        let url = `/medicines?sort=${sort}&order=${order}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (cat)    url += `&category=${cat}`;

        const data = await api(url);
        const grid = document.getElementById('med-grid');
        const cnt  = document.getElementById('med-count');

        if (cnt) cnt.textContent = `${data.pagination.total} products`;
        if (grid) {
            grid.innerHTML = data.data.length
                ? data.data.map((m, i) => medCard(m, i)).join('')
                : `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-state-icon">🔍</div><h3>No medicines found</h3><p>Try a different search</p></div>`;
        }
        updateAddToCartButtons();
    } catch (err) {
        showToast('Failed to load medicines', 'error');
    }
}

function filterMeds(cat, el) {
    window._activeCat = cat;
    document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
    el.classList.add('active');
    fetchMeds();
}

// ================================================
// ORDERS PAGE
// ================================================
async function renderOrders() {
    if (!currentUser) { go('/'); return; }
    setContent(loader());
    try {
        const data = await api('/orders');
        const orders = data.data;

        const statusSteps = ['pending','confirmed','processing','out_for_delivery','delivered'];

        setContent(`
        <div class="section">
            <div class="section-head">
                <div>
                    <h2>My Orders</h2>
                    <p>${orders.length} order(s)</p>
                </div>
                <button class="btn btn-primary btn-sm" onclick="go('/medicines')">+ New Order</button>
            </div>

            ${orders.length === 0 ? `
                <div class="empty-state">
                    <div class="empty-state-icon">📦</div>
                    <h3>No orders yet</h3>
                    <p>Browse our medicines and place your first order!</p>
                    <button class="btn btn-primary" style="margin-top:16px;" onclick="go('/medicines')">Shop Now</button>
                </div>
            ` : orders.map((o, idx) => `
                <div class="order-card" style="animation-delay:${idx * 0.05}s;">
                    <div class="order-card-header">
                        <div>
                            <span class="order-id">Order #${o.id}</span>
                            <div class="order-date">📅 ${fmtDate(o.created_at)}</div>
                        </div>
                        <span class="status-pill s-${o.status}">${statusLabel(o.status)}</span>
                    </div>

                    <!-- Order items preview -->
                    <div class="order-items-preview">
                        ${(o.items || []).map(item => `
                            <div class="order-item-chip">
                                <img src="${item.image_url || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200'}" alt="${item.medicine_name}"
                                     onerror="this.src='https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200'">
                                <span>${item.medicine_name} × ${item.quantity}</span>
                            </div>
                        `).join('')}
                    </div>

                    <!-- Progress tracker -->
                    ${o.status !== 'cancelled' ? `
                    <div class="order-tracker">
                        ${statusSteps.map(s => {
                            const idx = statusSteps.indexOf(o.status);
                            const sIdx = statusSteps.indexOf(s);
                            const isDone   = sIdx < idx;
                            const isActive = sIdx === idx;
                            return `
                            <div class="track-step ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}">
                                <div class="track-dot">${isDone ? '✓' : sIdx + 1}</div>
                                <div class="track-label">${stepLabel(s)}</div>
                            </div>`;
                        }).join('')}
                    </div>` : ''}

                    <div class="order-card-footer">
                        <div>
                            <div style="font-size:.8rem;color:var(--text-muted);">
                                📍 ${o.delivery_address?.substring(0, 45)}${o.delivery_address?.length > 45 ? '...' : ''}
                            </div>
                            <div style="font-size:.8rem;color:var(--text-muted);">
                                💳 ${o.payment_method?.replace('_', ' ')}
                                ${o.rider_name ? ` · 🛵 ${o.rider_name}` : ''}
                            </div>
                        </div>
                        <div style="display:flex;align-items:center;gap:12px;">
                            <span class="order-total">RM ${parseFloat(o.total_price).toFixed(2)}</span>
                            ${['pending','confirmed'].includes(o.status) ? `
                                <button class="btn btn-danger btn-sm" onclick="cancelOrder(${o.id})">Cancel</button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        `);
    } catch (err) {
        setContent(errState(err.message));
    }
}

async function cancelOrder(id) {
    if (!confirm('Cancel this order?')) return;
    try {
        await api(`/orders/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) });
        showToast('Order cancelled. Stock restored.', 'success');
        renderOrders();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ================================================
// CARD RENDERER
// ================================================
function medCard(m, i) {
    // Register medicine in registry so we can look it up safely by id
    // This avoids broken onclick attributes when names/descriptions contain quotes
    medicineRegistry[m.id] = m;

    const stockClass = m.stock === 0 ? 'stock-out' : m.stock < 10 ? 'stock-low' : 'stock-ok';
    const stockLabel = m.stock === 0 ? 'Out of Stock' : m.stock < 10 ? `Only ${m.stock} left` : `${m.stock} in stock`;
    const catEmoji = { painkillers:'💊', antibiotics:'🦠', vitamins:'🧪', skincare:'💆',
                       cold_flu:'🤧', diabetes:'🩺', heart:'❤️', general:'📦' };

    return `
    <div class="med-card" style="animation-delay:${i * 0.04}s;">
        <div class="med-card-img">
            <img src="${m.image_url || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400'}"
                 alt="" loading="lazy"
                 onerror="this.src='https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400'">
            ${m.requires_prescription ? `<span class="rx-badge">Rx Required</span>` : ''}
            <span class="cat-badge">${catEmoji[m.category] || '📦'} ${m.category?.replace('_', ' ')}</span>
        </div>
        <div class="med-card-body">
            <div class="med-card-name">${m.name}</div>
            <div class="med-card-manufacturer">by ${m.manufacturer || 'Generic'} · ${m.unit}</div>
            <div class="med-card-desc">${m.description || 'No description available.'}</div>
            <div class="med-card-meta">
                <span class="med-price">RM ${parseFloat(m.price).toFixed(2)}</span>
                <span class="med-stock ${stockClass}">${stockLabel}</span>
            </div>
            <button class="add-to-cart-btn" data-med-id="${m.id}"
                    ${m.stock === 0 ? 'disabled' : ''}>
                ${m.stock === 0 ? '❌ Out of Stock' : '🛒 Add to Cart'}
            </button>
        </div>
    </div>`;
}

// Delegated click handler for Add to Cart buttons (replaces inline onclick)
// Safe for any medicine name/description content
document.addEventListener('click', e => {
    const btn = e.target.closest('.add-to-cart-btn');
    if (!btn || btn.disabled) return;
    const id = parseInt(btn.dataset.medId);
    const med = medicineRegistry[id];
    if (med) addToCart(med);
});

// ================================================
// UTILITY
// ================================================
function setContent(html) { document.getElementById('app').innerHTML = html; }
function loader() { return `<div class="page-loader"><div class="loader-ring"></div><p>Loading...</p></div>`; }
function errState(msg) {
    return `<div class="empty-state" style="padding-top:80px;">
        <div class="empty-state-icon">⚠️</div>
        <h3>Oops!</h3>
        <p style="color:var(--red);">${msg}</p>
        <p style="margin-top:6px;font-size:.85rem;">Make sure the backend server is running on port 3000.</p>
        <button class="btn btn-primary" style="margin-top:16px;" onclick="router()">Retry</button>
    </div>`;
}

function fmtDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-MY', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function statusLabel(s) {
    return { pending:'⏳ Pending', confirmed:'✅ Confirmed', processing:'⚙️ Processing',
             out_for_delivery:'🛵 Out for Delivery', delivered:'📦 Delivered', cancelled:'❌ Cancelled' }[s] || s;
}

function stepLabel(s) {
    return { pending:'Order\nPlaced', confirmed:'Confirmed', processing:'Processing',
             out_for_delivery:'On the\nWay', delivered:'Delivered' }[s] || s;
}

function showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => t.remove(), 4000);
}

// Close modals on overlay click
document.addEventListener('click', e => {
    if (e.target.id === 'auth-modal')     closeAuthModal();
    if (e.target.id === 'checkout-modal') closeCheckout();
    if (e.target.id === 'success-modal')  closeSuccess();
});

// Navbar scroll effect
window.addEventListener('scroll', () => {
    document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 10);
});

// ================================================
// INIT
// ================================================
window.addEventListener('hashchange', router);
window.addEventListener('load', () => {
    initAuth();
    updateCartBadge(false);
    router();
});
