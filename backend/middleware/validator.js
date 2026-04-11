// ================================================
// EventHub - Input Validation Middleware
// Validates request body data before processing
// ================================================

/**
 * Validate event creation/update data
 */
const validateEvent = (req, res, next) => {
    const { title, venue_id, event_date, start_time, price, available_tickets } = req.body;
    const errors = [];

    if (!title || title.trim().length < 3) errors.push('Title must be at least 3 characters');
    if (!venue_id) errors.push('Venue ID is required');
    if (!event_date) errors.push('Event date is required');
    if (!start_time) errors.push('Start time is required');
    if (price !== undefined && price < 0) errors.push('Price cannot be negative');
    if (available_tickets !== undefined && available_tickets < 0) errors.push('Available tickets cannot be negative');

    if (errors.length > 0) {
        return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    next();
};

/**
 * Validate venue creation/update data
 */
const validateVenue = (req, res, next) => {
    const { name, address, city, capacity } = req.body;
    const errors = [];

    if (!name || name.trim().length < 2) errors.push('Venue name must be at least 2 characters');
    if (!address) errors.push('Address is required');
    if (!city) errors.push('City is required');
    if (!capacity || capacity <= 0) errors.push('Capacity must be a positive number');

    if (errors.length > 0) {
        return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    next();
};

/**
 * Validate booking creation data
 */
const validateBooking = (req, res, next) => {
    const { event_id, num_tickets } = req.body;
    const errors = [];

    if (!event_id) errors.push('Event ID is required');
    if (!num_tickets || num_tickets <= 0) errors.push('Number of tickets must be at least 1');
    if (num_tickets > 10) errors.push('Maximum 10 tickets per booking');

    if (errors.length > 0) {
        return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    next();
};

/**
 * Validate user registration data
 */
const validateUser = (req, res, next) => {
    const { username, email, password } = req.body;
    const errors = [];

    if (!username || username.trim().length < 3) errors.push('Username must be at least 3 characters');
    if (!email || !email.includes('@')) errors.push('Valid email is required');
    if (!password || password.length < 6) errors.push('Password must be at least 6 characters');

    if (errors.length > 0) {
        return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    next();
};

module.exports = { validateEvent, validateVenue, validateBooking, validateUser };
