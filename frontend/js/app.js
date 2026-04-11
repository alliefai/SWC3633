// ================================================
// EventHub - Frontend Single Page Application
// Handles routing, API calls, and UI rendering
// Course: SWC3633 Web API Development
// ================================================

const API_BASE = '/api';
let currentUser = null;
let currentEvent = null;
let authMode = 'login';

// ================================================
// ROUTER - Hash-based SPA Navigation
// ================================================
const routes = {
    '/': renderHome,
    '/events': renderEvents,
    '/venues': renderVenues,
    '/bookings': renderBookings,
    '/admin': renderAdmin,
};

function router() {
    const hash = window.location.hash.slice(1) || '/';
    const path = hash.split('?')[0];

    // Check auth for protected routes
    if (path === '/bookings' && !currentUser) {
        showToast('Please sign in to view your bookings', 'info');
        showAuthModal('login');
        return;
    }
    if (path === '/admin' && (!currentUser || currentUser.role !== 'admin')) {
        showToast('Admin access required', 'error');
        window.location.hash = '/';
        return;
    }

    updateActiveNav(path);
    const handler = routes[path];
    if (handler) {
        handler();
    } else if (path.startsWith('/events/')) {
        const id = path.split('/')[2];
        renderEventDetail(id);
    } else {
        renderHome();
    }
}

function navigate(path) {
    window.location.hash = path;
}

function updateActiveNav(path) {
    document.querySelectorAll('.nav-link').forEach(link => {
        const page = link.getAttribute('data-page');
        const isActive = path === '/' ? page === 'home' :
                         path.startsWith('/events') ? page === 'events' :
                         path.startsWith('/venues') ? page === 'venues' :
                         path.startsWith('/bookings') ? page === 'bookings' :
                         path.startsWith('/admin') ? page === 'admin' : false;
        link.classList.toggle('active', isActive);
    });
}

// ================================================
// API HELPERS
// ================================================
async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers
    };

    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || data.message || `HTTP ${res.status}`);
        }
        return data;
    } catch (err) {
        throw err;
    }
}

// ================================================
// AUTHENTICATION
// ================================================
function initAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token && user) {
        currentUser = JSON.parse(user);
        updateNavForAuth();
    }
}

function updateNavForAuth() {
    const btnLogin = document.getElementById('btn-login');
    const btnRegister = document.getElementById('btn-register');
    const userMenu = document.getElementById('user-menu');
    const adminLink = document.querySelector('.nav-admin');

    if (currentUser) {
        btnLogin.style.display = 'none';
        btnRegister.style.display = 'none';
        userMenu.style.display = 'flex';
        document.getElementById('user-name').textContent = currentUser.username;
        document.getElementById('user-avatar').textContent = currentUser.username[0].toUpperCase();
        if (currentUser.role === 'admin' && adminLink) {
            adminLink.style.display = 'inline-flex';
        }
    } else {
        btnLogin.style.display = 'inline-flex';
        btnRegister.style.display = 'inline-flex';
        userMenu.style.display = 'none';
        if (adminLink) adminLink.style.display = 'none';
    }
}

function showAuthModal(mode) {
    authMode = mode;
    const modal = document.getElementById('auth-modal');
    const title = document.getElementById('auth-modal-title');
    const subtitle = document.getElementById('auth-modal-subtitle');
    const submitBtn = document.getElementById('auth-submit-btn');
    const fgUsername = document.getElementById('fg-username');
    const switchText = document.getElementById('auth-switch');

    modal.style.display = 'flex';
    document.getElementById('auth-error').style.display = 'none';
    document.getElementById('auth-form').reset();

    if (mode === 'register') {
        title.textContent = 'Create Account';
        subtitle.textContent = 'Join EventHub today';
        submitBtn.textContent = 'Create Account';
        fgUsername.style.display = 'block';
        document.getElementById('auth-username').required = true;
        switchText.innerHTML = 'Already have an account? <a href="#" onclick="switchAuthMode(event)">Sign In</a>';
    } else {
        title.textContent = 'Sign In';
        subtitle.textContent = 'Welcome back to EventHub';
        submitBtn.textContent = 'Sign In';
        fgUsername.style.display = 'none';
        document.getElementById('auth-username').required = false;
        switchText.innerHTML = "Don't have an account? <a href=\"#\" onclick=\"switchAuthMode(event)\">Sign Up</a>";
    }
}

function switchAuthMode(e) {
    e.preventDefault();
    showAuthModal(authMode === 'login' ? 'register' : 'login');
}

function closeAuthModal() {
    document.getElementById('auth-modal').style.display = 'none';
}

async function handleAuth(e) {
    e.preventDefault();
    const errEl = document.getElementById('auth-error');
    const btn = document.getElementById('auth-submit-btn');
    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Please wait...';

    try {
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;

        let data;
        if (authMode === 'register') {
            const username = document.getElementById('auth-username').value;
            data = await apiRequest('/auth/register', {
                method: 'POST',
                body: JSON.stringify({ username, email, password })
            });
        } else {
            data = await apiRequest('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
        }

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        currentUser = data.user;
        updateNavForAuth();
        closeAuthModal();
        showToast(`Welcome, ${data.user.username}! 🎉`, 'success');

        if (authMode === 'register' && data.apiKey) {
            setTimeout(() => showToast(`Your API Key: ${data.apiKey}`, 'info'), 1000);
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
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentUser = null;
    updateNavForAuth();
    showToast('Signed out successfully', 'info');
    navigate('/');
}

// ================================================
// HOME PAGE
// ================================================
async function renderHome() {
    setContent(`<div class="loading-screen"><div class="loader"></div></div>`);
    try {
        const [eventsData, venuesData] = await Promise.all([
            apiRequest('/events?limit=6&sort=event_date'),
            apiRequest('/venues')
        ]);

        const events = eventsData.data;
        const venues = venuesData.data;

        setContent(`
            <!-- Hero Section -->
            <section class="hero">
                <div class="hero-content">
                    <h1>Discover Amazing Events Near You</h1>
                    <p>Browse concerts, tech conferences, art exhibitions, food festivals, and more. Book your tickets in seconds.</p>
                    <div class="hero-actions">
                        <button class="btn btn-primary" onclick="navigate('/events')">🔍 Explore Events</button>
                        <button class="btn btn-outline" onclick="navigate('/venues')">🏟️ Browse Venues</button>
                    </div>
                    <div class="hero-stats">
                        <div class="stat-item">
                            <div class="stat-number">${events.length}+</div>
                            <div class="stat-label">Upcoming Events</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number">${venues.length}</div>
                            <div class="stat-label">Venues</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number">100%</div>
                            <div class="stat-label">Secure Booking</div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Category Filter -->
            <section class="section">
                <div class="section-header">
                    <div>
                        <h2 class="section-title">Upcoming Events</h2>
                        <p class="section-subtitle">Don't miss out on these amazing experiences</p>
                    </div>
                    <a href="#/events" class="btn btn-outline btn-sm">View All →</a>
                </div>

                <div class="cards-grid">
                    ${events.map((e, i) => renderEventCard(e, i)).join('')}
                </div>
            </section>

            <!-- Venues Section -->
            <section class="section" style="background: var(--bg-secondary); border-radius: var(--radius-xl); margin: 0 24px 60px;">
                <div style="padding: 20px 0 0;">
                    <div class="section-header">
                        <div>
                            <h2 class="section-title">Featured Venues</h2>
                            <p class="section-subtitle">World-class venues across Malaysia</p>
                        </div>
                        <a href="#/venues" class="btn btn-outline btn-sm">View All →</a>
                    </div>
                    <div class="cards-grid">
                        ${venues.slice(0, 3).map((v, i) => renderVenueCard(v, i)).join('')}
                    </div>
                </div>
            </section>
        `);
    } catch (err) {
        setContent(renderError(err.message));
    }
}

// ================================================
// EVENTS PAGE
// ================================================
async function renderEvents() {
    setContent(`<div class="loading-screen"><div class="loader"></div></div>`);
    try {
        const data = await apiRequest('/events?sort=event_date');
        const events = data.data;

        setContent(`
            <div class="section">
                <div class="section-header">
                    <div>
                        <h2 class="section-title">All Events</h2>
                        <p class="section-subtitle">${data.pagination.total} events found</p>
                    </div>
                    ${currentUser?.role === 'admin' ? `<button class="btn btn-primary btn-sm" onclick="showAdminEventModal()">+ Add Event</button>` : ''}
                </div>

                <div class="filter-bar">
                    <input type="text" id="search-input" placeholder="🔍  Search events..." oninput="filterEvents()" />
                    <select id="category-filter" onchange="filterEvents()">
                        <option value="">All Categories</option>
                        <option value="music">🎵 Music</option>
                        <option value="sports">⚽ Sports</option>
                        <option value="arts">🎨 Arts</option>
                        <option value="technology">💻 Technology</option>
                        <option value="food">🍜 Food</option>
                        <option value="education">📚 Education</option>
                        <option value="other">📌 Other</option>
                    </select>
                    <select id="sort-filter" onchange="filterEvents()">
                        <option value="event_date">Sort: Date</option>
                        <option value="price">Sort: Price</option>
                        <option value="title">Sort: Name</option>
                    </select>
                </div>

                <div class="cards-grid" id="events-grid">
                    ${events.map((e, i) => renderEventCard(e, i)).join('')}
                </div>
            </div>
        `);

        // Store events for client-side filtering
        window._allEvents = events;
    } catch (err) {
        setContent(renderError(err.message));
    }
}

async function filterEvents() {
    const search = document.getElementById('search-input')?.value.toLowerCase() || '';
    const category = document.getElementById('category-filter')?.value || '';
    const sort = document.getElementById('sort-filter')?.value || 'event_date';

    try {
        let url = `/events?sort=${sort}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (category) url += `&category=${category}`;

        const data = await apiRequest(url);
        const grid = document.getElementById('events-grid');
        if (grid) {
            grid.innerHTML = data.data.length > 0
                ? data.data.map((e, i) => renderEventCard(e, i)).join('')
                : `<div class="empty-state"><div class="empty-state-icon">🔍</div><h3>No events found</h3><p>Try a different search or category</p></div>`;
        }
    } catch (err) {
        showToast('Failed to filter events', 'error');
    }
}

// ================================================
// EVENT DETAIL PAGE
// ================================================
async function renderEventDetail(id) {
    setContent(`<div class="loading-screen"><div class="loader"></div></div>`);
    try {
        const data = await apiRequest(`/events/${id}`);
        const ev = data.data;
        currentEvent = ev;

        setContent(`
            <div class="event-detail">
                <button class="btn btn-outline btn-sm" onclick="history.back()" style="margin-bottom:20px;">← Back</button>

                <div class="event-detail-header">
                    <img src="${ev.image_url || 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=1000'}" alt="${ev.title}" onerror="this.src='https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=1000'">
                    <div class="event-detail-overlay">
                        <span class="event-card-badge">${ev.category}</span>
                        <h1>${ev.title}</h1>
                        <p style="color: var(--text-secondary);">📍 ${ev.venue_name}, ${ev.venue_city}</p>
                    </div>
                </div>

                <div class="event-detail-body">
                    <div class="event-detail-info">
                        <div class="event-meta-grid">
                            <div class="meta-item">
                                <div class="meta-item-label">📅 Date</div>
                                <div class="meta-item-value">${formatDate(ev.event_date)}</div>
                            </div>
                            <div class="meta-item">
                                <div class="meta-item-label">🕐 Time</div>
                                <div class="meta-item-value">${formatTime(ev.start_time)}${ev.end_time ? ' – ' + formatTime(ev.end_time) : ''}</div>
                            </div>
                            <div class="meta-item">
                                <div class="meta-item-label">🏟️ Venue</div>
                                <div class="meta-item-value">${ev.venue_name}</div>
                            </div>
                            <div class="meta-item">
                                <div class="meta-item-label">🎫 Tickets Left</div>
                                <div class="meta-item-value" style="color: ${ev.available_tickets < 50 ? 'var(--accent-orange)' : 'var(--accent-green)'};">
                                    ${ev.available_tickets.toLocaleString()}
                                </div>
                            </div>
                            <div class="meta-item">
                                <div class="meta-item-label">🌤️ Outdoor Event</div>
                                <div class="meta-item-value">${ev.is_outdoor ? '✅ Yes' : '❌ No'}</div>
                            </div>
                            <div class="meta-item">
                                <div class="meta-item-label">📍 City</div>
                                <div class="meta-item-value">${ev.venue_city}</div>
                            </div>
                        </div>

                        <h3>About This Event</h3>
                        <p>${ev.description || 'No description available.'}</p>

                        <h3>Venue Information</h3>
                        <p>📍 ${ev.venue_address || ev.venue_city}<br>Located in ${ev.venue_city}.</p>
                    </div>

                    <div class="event-detail-sidebar">
                        <div class="booking-widget">
                            <div class="booking-widget-price">
                                RM ${parseFloat(ev.price).toFixed(2)}
                                <span>/ ticket</span>
                            </div>
                            <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 20px;">
                                ${ev.available_tickets} tickets remaining
                            </p>
                            ${ev.available_tickets > 0
                                ? `<button class="btn btn-primary btn-full" onclick="openBookingModal()" id="book-btn">
                                    🎫 Book Tickets
                                   </button>`
                                : `<button class="btn btn-outline btn-full" disabled>Sold Out</button>`
                            }
                            ${currentUser?.role === 'admin' ? `
                                <div style="margin-top:12px; display:flex; gap:8px;">
                                    <button class="btn btn-outline btn-sm" style="flex:1;" onclick="showAdminEventModal(${ev.id})">✏️ Edit</button>
                                    <button class="btn btn-danger btn-sm" style="flex:1;" onclick="deleteEvent(${ev.id})">🗑️ Delete</button>
                                </div>
                            ` : ''}
                        </div>

                        ${ev.is_outdoor ? `
                        <div class="weather-widget" id="weather-widget">
                            <h4>🌤️ Current Weather in ${ev.venue_city}</h4>
                            <div class="loader" style="width:24px;height:24px;border-width:2px;"></div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `);

        // Load weather for outdoor events
        if (ev.is_outdoor && ev.venue_city) {
            loadWeather(ev.venue_city);
        }

    } catch (err) {
        setContent(renderError(err.message));
    }
}

async function loadWeather(city) {
    try {
        const data = await apiRequest(`/weather/${encodeURIComponent(city)}`);
        const w = data.data;
        const widget = document.getElementById('weather-widget');
        if (widget) {
            widget.innerHTML = `
                <h4>🌤️ Weather in ${w.city}</h4>
                <div class="weather-info">
                    <div class="weather-temp">${w.temperature}°C</div>
                    <div>
                        <div class="weather-desc" style="text-transform:capitalize;">${w.description}</div>
                        <div class="weather-desc">💧 ${w.humidity}% humidity · 💨 ${w.wind_speed} km/h</div>
                        <div class="weather-desc" style="font-size:0.75rem;margin-top:4px;color:var(--text-muted);">
                            Feels like ${w.feels_like}°C ${data.source === 'mock' ? '(demo data)' : ''}
                        </div>
                    </div>
                </div>
            `;
        }
    } catch (err) {
        const widget = document.getElementById('weather-widget');
        if (widget) widget.innerHTML = `<h4>🌤️ Weather</h4><p style="color:var(--text-muted);font-size:0.85rem;">Weather data unavailable</p>`;
    }
}

// ================================================
// VENUES PAGE
// ================================================
async function renderVenues() {
    setContent(`<div class="loading-screen"><div class="loader"></div></div>`);
    try {
        const data = await apiRequest('/venues');
        const venues = data.data;

        setContent(`
            <div class="section">
                <div class="section-header">
                    <div>
                        <h2 class="section-title">All Venues</h2>
                        <p class="section-subtitle">${venues.length} venues across Malaysia</p>
                    </div>
                    ${currentUser?.role === 'admin' ? `<button class="btn btn-primary btn-sm" onclick="showAdminVenueModal()">+ Add Venue</button>` : ''}
                </div>
                <div class="cards-grid">
                    ${venues.length > 0
                        ? venues.map((v, i) => renderVenueCard(v, i)).join('')
                        : `<div class="empty-state"><div class="empty-state-icon">🏟️</div><h3>No venues found</h3></div>`
                    }
                </div>
            </div>
        `);
    } catch (err) {
        setContent(renderError(err.message));
    }
}

// ================================================
// BOOKINGS PAGE
// ================================================
async function renderBookings() {
    if (!currentUser) { navigate('/'); return; }
    setContent(`<div class="loading-screen"><div class="loader"></div></div>`);
    try {
        const data = await apiRequest('/bookings');
        const bookings = data.data;

        setContent(`
            <div class="section">
                <div class="section-header">
                    <div>
                        <h2 class="section-title">My Bookings</h2>
                        <p class="section-subtitle">${bookings.length} booking(s)</p>
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="navigate('/events')">+ Book More</button>
                </div>

                ${bookings.length > 0 ? `
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        ${bookings.map((b, i) => `
                        <div class="booking-card" style="animation-delay: ${i * 0.05}s;">
                            <div class="booking-card-image">
                                <img src="${b.event_image || 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=400'}"
                                     alt="${b.event_title}"
                                     onerror="this.src='https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=400'">
                            </div>
                            <div class="booking-card-content">
                                <div class="booking-card-title">${b.event_title}</div>
                                <div class="booking-card-details">
                                    <span>📅 ${formatDate(b.event_date)} at ${formatTime(b.start_time)}</span>
                                    <span>🏟️ ${b.venue_name}</span>
                                    <span>🎫 ${b.num_tickets} ticket(s) · <strong style="color:var(--accent-cyan)">RM ${parseFloat(b.total_price).toFixed(2)}</strong></span>
                                    <span>💳 ${b.payment_method?.replace('_', ' ')}</span>
                                    <span>🕒 Booked: ${formatDate(b.created_at)}</span>
                                </div>
                            </div>
                            <div class="booking-card-actions">
                                <span class="status-badge status-${b.status}">${b.status}</span>
                                ${b.status !== 'cancelled' ? `
                                    <button class="btn btn-danger btn-sm" onclick="cancelBooking(${b.id})">Cancel</button>
                                ` : ''}
                            </div>
                        </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="empty-state">
                        <div class="empty-state-icon">🎫</div>
                        <h3>No bookings yet</h3>
                        <p>Browse events and book your first ticket!</p>
                        <button class="btn btn-primary" style="margin-top:16px;" onclick="navigate('/events')">Explore Events</button>
                    </div>
                `}
            </div>
        `);
    } catch (err) {
        setContent(renderError(err.message));
    }
}

async function cancelBooking(id) {
    if (!confirm('Cancel this booking? Tickets will be restored.')) return;
    try {
        await apiRequest(`/bookings/${id}`, { method: 'DELETE' });
        showToast('Booking cancelled successfully', 'success');
        renderBookings();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ================================================
// ADMIN PANEL
// ================================================
async function renderAdmin() {
    if (!currentUser || currentUser.role !== 'admin') { navigate('/'); return; }
    setContent(`<div class="loading-screen"><div class="loader"></div></div>`);

    try {
        const [eventsData, venuesData, usersData, bookingsData] = await Promise.all([
            apiRequest('/events?limit=50'),
            apiRequest('/venues'),
            apiRequest('/users'),
            apiRequest('/bookings')
        ]);

        setContent(`
            <div class="section">
                <div class="admin-header">
                    <div>
                        <h2 class="section-title">⚙️ Admin Panel</h2>
                        <p class="section-subtitle">Manage events, venues, users, and bookings</p>
                    </div>
                    <!-- Stats row -->
                    <div style="display:flex;gap:16px;flex-wrap:wrap;">
                        ${[
                            ['🎪', eventsData.pagination.total, 'Events'],
                            ['🏟️', venuesData.data.length, 'Venues'],
                            ['👥', usersData.data.length, 'Users'],
                            ['🎫', bookingsData.data.length, 'Bookings'],
                        ].map(([icon, count, label]) => `
                            <div style="background:var(--bg-glass);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:12px 20px;text-align:center;">
                                <div style="font-size:1.5rem;">${icon}</div>
                                <div style="font-size:1.5rem;font-weight:700;color:var(--accent-purple-light);">${count}</div>
                                <div style="font-size:0.75rem;color:var(--text-muted);">${label}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="admin-tabs">
                    <button class="admin-tab active" onclick="switchAdminTab('events', this)">🎪 Events</button>
                    <button class="admin-tab" onclick="switchAdminTab('venues', this)">🏟️ Venues</button>
                    <button class="admin-tab" onclick="switchAdminTab('users', this)">👥 Users</button>
                    <button class="admin-tab" onclick="switchAdminTab('bookings-admin', this)">🎫 Bookings</button>
                </div>

                <!-- Events Tab -->
                <div id="tab-events">
                    <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
                        <button class="btn btn-primary btn-sm" onclick="showAdminEventModal()">+ Add Event</button>
                    </div>
                    <div class="admin-table-wrap">
                        <table class="admin-table">
                            <thead><tr>
                                <th>ID</th><th>Title</th><th>Date</th><th>Venue</th><th>Price</th><th>Tickets</th><th>Actions</th>
                            </tr></thead>
                            <tbody>
                                ${eventsData.data.map(e => `
                                <tr>
                                    <td>${e.id}</td>
                                    <td><strong style="color:var(--text-primary);">${e.title}</strong></td>
                                    <td>${formatDate(e.event_date)}</td>
                                    <td>${e.venue_name || e.venue_id}</td>
                                    <td>RM ${parseFloat(e.price).toFixed(2)}</td>
                                    <td>${e.available_tickets}</td>
                                    <td>
                                        <div class="table-actions">
                                            <button class="btn btn-outline btn-sm" onclick="showAdminEventModal(${e.id})">✏️</button>
                                            <button class="btn btn-danger btn-sm" onclick="deleteEvent(${e.id})">🗑️</button>
                                        </div>
                                    </td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Venues Tab (hidden) -->
                <div id="tab-venues" style="display:none;">
                    <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
                        <button class="btn btn-primary btn-sm" onclick="showAdminVenueModal()">+ Add Venue</button>
                    </div>
                    <div class="admin-table-wrap">
                        <table class="admin-table">
                            <thead><tr>
                                <th>ID</th><th>Name</th><th>City</th><th>Capacity</th><th>Events</th><th>Actions</th>
                            </tr></thead>
                            <tbody>
                                ${venuesData.data.map(v => `
                                <tr>
                                    <td>${v.id}</td>
                                    <td><strong style="color:var(--text-primary);">${v.name}</strong></td>
                                    <td>${v.city}</td>
                                    <td>${v.capacity.toLocaleString()}</td>
                                    <td>${v.event_count}</td>
                                    <td>
                                        <div class="table-actions">
                                            <button class="btn btn-outline btn-sm" onclick="showAdminVenueModal(${v.id})">✏️</button>
                                            <button class="btn btn-danger btn-sm" onclick="deleteVenue(${v.id})">🗑️</button>
                                        </div>
                                    </td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Users Tab (hidden) -->
                <div id="tab-users" style="display:none;">
                    <div class="admin-table-wrap">
                        <table class="admin-table">
                            <thead><tr>
                                <th>ID</th><th>Username</th><th>Email</th><th>Role</th><th>Bookings</th><th>Joined</th><th>Actions</th>
                            </tr></thead>
                            <tbody>
                                ${usersData.data.map(u => `
                                <tr>
                                    <td>${u.id}</td>
                                    <td><strong style="color:var(--text-primary);">${u.username}</strong></td>
                                    <td>${u.email}</td>
                                    <td><span class="status-badge ${u.role === 'admin' ? 'status-confirmed' : 'status-pending'}">${u.role}</span></td>
                                    <td>${u.booking_count}</td>
                                    <td>${formatDate(u.created_at)}</td>
                                    <td>
                                        <div class="table-actions">
                                            ${u.id !== currentUser.id ? `<button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})">🗑️</button>` : ''}
                                        </div>
                                    </td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Bookings Tab (hidden) -->
                <div id="tab-bookings-admin" style="display:none;">
                    <div class="admin-table-wrap">
                        <table class="admin-table">
                            <thead><tr>
                                <th>ID</th><th>User</th><th>Event</th><th>Tickets</th><th>Total</th><th>Payment</th><th>Status</th><th>Date</th>
                            </tr></thead>
                            <tbody>
                                ${bookingsData.data.map(b => `
                                <tr>
                                    <td>${b.id}</td>
                                    <td>${b.user_name || b.user_id}</td>
                                    <td>${b.event_title}</td>
                                    <td>${b.num_tickets}</td>
                                    <td>RM ${parseFloat(b.total_price).toFixed(2)}</td>
                                    <td>${b.payment_method?.replace('_', ' ')}</td>
                                    <td><span class="status-badge status-${b.status}">${b.status}</span></td>
                                    <td>${formatDate(b.created_at)}</td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `);
    } catch (err) {
        setContent(renderError(err.message));
    }
}

function switchAdminTab(tab, el) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    ['events','venues','users','bookings-admin'].forEach(t => {
        const el = document.getElementById(`tab-${t}`);
        if (el) el.style.display = t === tab ? 'block' : 'none';
    });
}

// ================================================
// BOOKING MODAL
// ================================================
function openBookingModal() {
    if (!currentUser) {
        showToast('Please sign in to book tickets', 'info');
        showAuthModal('login');
        return;
    }
    if (!currentEvent) return;

    const modal = document.getElementById('booking-modal');
    document.getElementById('booking-event-name').textContent = currentEvent.title;
    document.getElementById('booking-info').innerHTML = `
        📅 ${formatDate(currentEvent.event_date)} at ${formatTime(currentEvent.start_time)}<br>
        🏟️ ${currentEvent.venue_name}<br>
        💰 RM ${parseFloat(currentEvent.price).toFixed(2)} per ticket<br>
        🎫 ${currentEvent.available_tickets} tickets available
    `;
    document.getElementById('booking-tickets').max = Math.min(currentEvent.available_tickets, 10);
    updateBookingTotal();
    document.getElementById('booking-error').style.display = 'none';
    modal.style.display = 'flex';

    document.getElementById('booking-tickets').addEventListener('input', updateBookingTotal);
}

function updateBookingTotal() {
    const tickets = parseInt(document.getElementById('booking-tickets')?.value) || 1;
    const price = parseFloat(currentEvent?.price || 0);
    document.getElementById('booking-total-price').textContent = `RM ${(tickets * price).toFixed(2)}`;
}

function closeBookingModal() {
    document.getElementById('booking-modal').style.display = 'none';
}

async function handleBooking(e) {
    e.preventDefault();
    const errEl = document.getElementById('booking-error');
    errEl.style.display = 'none';

    try {
        const num_tickets = parseInt(document.getElementById('booking-tickets').value);
        const payment_method = document.getElementById('booking-payment').value;

        await apiRequest('/bookings', {
            method: 'POST',
            body: JSON.stringify({ event_id: currentEvent.id, num_tickets, payment_method })
        });

        closeBookingModal();
        showToast(`🎉 Booking confirmed! ${num_tickets} ticket(s) for ${currentEvent.title}`, 'success');

        // Refresh event detail to update ticket count
        setTimeout(() => renderEventDetail(currentEvent.id), 1000);
    } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
    }
}

// ================================================
// ADMIN MODALS (Event & Venue CRUD)
// ================================================
async function showAdminEventModal(id = null) {
    let ev = null;
    if (id) {
        const data = await apiRequest(`/events/${id}`);
        ev = data.data;
    }

    // Get venues for dropdown
    const venuesData = await apiRequest('/venues');

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'event-edit-modal';
    overlay.innerHTML = `
        <div class="modal" style="max-width:600px;">
            <button class="modal-close" onclick="document.getElementById('event-edit-modal').remove()">&times;</button>
            <div class="modal-header">
                <h2>${ev ? 'Edit Event' : 'Add New Event'}</h2>
            </div>
            <form onsubmit="saveEvent(event, ${id || 'null'})">
                <div class="admin-form">
                    <div class="form-group full-width">
                        <label>Title *</label>
                        <input type="text" name="title" required value="${ev?.title || ''}" placeholder="Event title">
                    </div>
                    <div class="form-group">
                        <label>Venue *</label>
                        <select name="venue_id" required>
                            ${venuesData.data.map(v => `<option value="${v.id}" ${ev?.venue_id == v.id ? 'selected' : ''}>${v.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Category</label>
                        <select name="category">
                            ${['music','sports','arts','technology','food','education','other'].map(c =>
                                `<option value="${c}" ${ev?.category === c ? 'selected' : ''}>${c}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Event Date *</label>
                        <input type="date" name="event_date" required value="${ev?.event_date?.split('T')[0] || ''}">
                    </div>
                    <div class="form-group">
                        <label>Start Time *</label>
                        <input type="time" name="start_time" required value="${ev?.start_time || ''}">
                    </div>
                    <div class="form-group">
                        <label>Price (RM) *</label>
                        <input type="number" name="price" min="0" step="0.01" required value="${ev?.price || '0'}">
                    </div>
                    <div class="form-group">
                        <label>Available Tickets</label>
                        <input type="number" name="available_tickets" min="0" value="${ev?.available_tickets || '0'}">
                    </div>
                    <div class="form-group full-width">
                        <label>Description</label>
                        <textarea name="description" placeholder="Event description...">${ev?.description || ''}</textarea>
                    </div>
                    <div class="form-group full-width">
                        <label>Image URL</label>
                        <input type="url" name="image_url" placeholder="https://..." value="${ev?.image_url || ''}">
                    </div>
                </div>
                <button type="submit" class="btn btn-primary btn-full" style="margin-top:8px;">${ev ? 'Update Event' : 'Create Event'}</button>
            </form>
        </div>
    `;
    document.body.appendChild(overlay);
}

async function saveEvent(e, id) {
    e.preventDefault();
    const form = e.target;
    const body = Object.fromEntries(new FormData(form));
    body.price = parseFloat(body.price);
    body.available_tickets = parseInt(body.available_tickets);
    body.venue_id = parseInt(body.venue_id);

    try {
        if (id) {
            await apiRequest(`/events/${id}`, { method: 'PUT', body: JSON.stringify(body) });
            showToast('Event updated!', 'success');
        } else {
            await apiRequest('/events', { method: 'POST', body: JSON.stringify(body) });
            showToast('Event created!', 'success');
        }
        document.getElementById('event-edit-modal')?.remove();
        renderAdmin();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteEvent(id) {
    if (!confirm('Delete this event? This cannot be undone.')) return;
    try {
        await apiRequest(`/events/${id}`, { method: 'DELETE' });
        showToast('Event deleted', 'success');
        renderAdmin();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function showAdminVenueModal(id = null) {
    let v = null;
    if (id) {
        const data = await apiRequest(`/venues/${id}`);
        v = data.data;
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'venue-edit-modal';
    overlay.innerHTML = `
        <div class="modal" style="max-width:540px;">
            <button class="modal-close" onclick="document.getElementById('venue-edit-modal').remove()">&times;</button>
            <div class="modal-header">
                <h2>${v ? 'Edit Venue' : 'Add New Venue'}</h2>
            </div>
            <form onsubmit="saveVenue(event, ${id || 'null'})">
                <div class="form-group">
                    <label>Venue Name *</label>
                    <input type="text" name="name" required value="${v?.name || ''}">
                </div>
                <div class="form-group">
                    <label>Address *</label>
                    <input type="text" name="address" required value="${v?.address || ''}">
                </div>
                <div class="form-group">
                    <label>City *</label>
                    <input type="text" name="city" required value="${v?.city || ''}">
                </div>
                <div class="form-group">
                    <label>Capacity *</label>
                    <input type="number" name="capacity" min="1" required value="${v?.capacity || ''}">
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea name="description">${v?.description || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Image URL</label>
                    <input type="url" name="image_url" placeholder="https://..." value="${v?.image_url || ''}">
                </div>
                <button type="submit" class="btn btn-primary btn-full">${v ? 'Update Venue' : 'Create Venue'}</button>
            </form>
        </div>
    `;
    document.body.appendChild(overlay);
}

async function saveVenue(e, id) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    body.capacity = parseInt(body.capacity);

    try {
        if (id) {
            await apiRequest(`/venues/${id}`, { method: 'PUT', body: JSON.stringify(body) });
            showToast('Venue updated!', 'success');
        } else {
            await apiRequest('/venues', { method: 'POST', body: JSON.stringify(body) });
            showToast('Venue created!', 'success');
        }
        document.getElementById('venue-edit-modal')?.remove();
        renderAdmin();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteVenue(id) {
    if (!confirm('Delete this venue?')) return;
    try {
        await apiRequest(`/venues/${id}`, { method: 'DELETE' });
        showToast('Venue deleted', 'success');
        renderAdmin();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteUser(id) {
    if (!confirm('Delete this user? All their bookings will be removed.')) return;
    try {
        await apiRequest(`/users/${id}`, { method: 'DELETE' });
        showToast('User deleted', 'success');
        renderAdmin();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ================================================
// CARD RENDERERS
// ================================================
function renderEventCard(ev, i = 0) {
    const ticketsLeft = ev.available_tickets;
    const ticketClass = ticketsLeft < 50 ? 'low' : '';
    const categoryEmojis = {
        music: '🎵', sports: '⚽', arts: '🎨',
        technology: '💻', food: '🍜', education: '📚', other: '📌'
    };

    return `
    <div class="event-card" onclick="navigate('/events/${ev.id}')" style="animation-delay: ${i * 0.05}s;">
        <div class="event-card-image">
            <img src="${ev.image_url || 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=600'}"
                 alt="${ev.title}"
                 loading="lazy"
                 onerror="this.src='https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=600'">
            <span class="event-card-badge">${categoryEmojis[ev.category] || '📌'} ${ev.category}</span>
            <span class="event-card-price">RM ${parseFloat(ev.price).toFixed(2)}</span>
        </div>
        <div class="event-card-body">
            <div class="event-card-title">${ev.title}</div>
            <div class="event-card-meta">
                <span>📅 ${formatDate(ev.event_date)}</span>
                <span>🏟️ ${ev.venue_name || ''}, ${ev.venue_city || ''}</span>
                <span>🕐 ${formatTime(ev.start_time)}</span>
            </div>
        </div>
        <div class="event-card-footer">
            <span class="tickets-left ${ticketClass}">
                🎫 ${ticketsLeft > 0 ? ticketsLeft.toLocaleString() + ' left' : 'Sold Out'}
            </span>
            <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); navigate('/events/${ev.id}')">
                Book Now
            </button>
        </div>
    </div>`;
}

function renderVenueCard(v, i = 0) {
    return `
    <div class="venue-card" style="animation-delay: ${i * 0.05}s;">
        <div class="venue-card-image">
            <img src="${v.image_url || 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=600'}"
                 alt="${v.name}"
                 loading="lazy"
                 onerror="this.src='https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=600'">
        </div>
        <div class="venue-card-body">
            <div class="venue-card-title">${v.name}</div>
            <div class="venue-card-info">
                <span>📍 ${v.address}, ${v.city}</span>
                <span>${v.description ? v.description.substring(0, 80) + '...' : ''}</span>
            </div>
            <div class="venue-card-stats">
                <div class="venue-stat">Capacity: <strong>${v.capacity?.toLocaleString()}</strong></div>
                <div class="venue-stat">Events: <strong>${v.event_count || 0}</strong></div>
            </div>
        </div>
    </div>`;
}

// ================================================
// UTILITY FUNCTIONS
// ================================================
function setContent(html) {
    document.getElementById('main-content').innerHTML = html;
}

function renderError(msg) {
    return `
        <div class="empty-state" style="margin-top:60px;">
            <div class="empty-state-icon">⚠️</div>
            <h3>Something went wrong</h3>
            <p style="color:var(--accent-red)">${msg}</p>
            <p style="margin-top:8px;">Make sure the backend server is running on port 3000.</p>
            <button class="btn btn-primary" style="margin-top:16px;" onclick="router()">Retry</button>
        </div>`;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `${hour % 12 || 12}:${m} ${ampm}`;
}

function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function toggleMobileNav() {
    document.getElementById('nav-links').classList.toggle('show');
}

// Close modals on overlay click
document.addEventListener('click', (e) => {
    if (e.target.id === 'auth-modal') closeAuthModal();
    if (e.target.id === 'booking-modal') closeBookingModal();
});

// Navbar scroll effect
window.addEventListener('scroll', () => {
    document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 20);
});

// Load weather in nav (KL weather)
async function loadNavWeather() {
    try {
        const data = await apiRequest('/weather/Kuala Lumpur');
        const navWeather = document.getElementById('nav-weather');
        if (navWeather) {
            navWeather.textContent = `🌤️ ${data.data.temperature}°C KL`;
        }
    } catch {}
}

// ================================================
// INIT
// ================================================
window.addEventListener('hashchange', router);
window.addEventListener('load', () => {
    initAuth();
    router();
    loadNavWeather();
});
