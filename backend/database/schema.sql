-- ================================================
-- MediDelivery - Online Pharmacy Delivery System
-- Database Schema for MySQL
-- Course: SWC3633 Web API Development
-- 4 Related Tables: users, medicines, orders, order_items
-- ================================================

CREATE DATABASE IF NOT EXISTS medideliver;
USE medideliver;

-- Drop in reverse dependency order
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS medicines;
DROP TABLE IF EXISTS users;

-- ================================================
-- Table 1: users
-- Stores customers, pharmacist admins, and riders
-- ================================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role ENUM('customer', 'admin', 'rider') DEFAULT 'customer',
    address TEXT,
    api_key VARCHAR(64) UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ================================================
-- Table 2: medicines
-- Pharmacy product inventory
-- ================================================
CREATE TABLE medicines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    category ENUM('antibiotics','painkillers','vitamins','skincare','cold_flu','diabetes','heart','general') DEFAULT 'general',
    price DECIMAL(10,2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    unit VARCHAR(30) DEFAULT 'tablet',
    dosage VARCHAR(100),
    manufacturer VARCHAR(100),
    expiry_date DATE,
    image_url VARCHAR(500),
    requires_prescription BOOLEAN DEFAULT FALSE,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ================================================
-- Table 3: orders
-- Customer orders linked to customers and riders
-- ================================================
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    rider_id INT DEFAULT NULL,
    status ENUM('pending','confirmed','processing','out_for_delivery','delivered','cancelled') DEFAULT 'pending',
    delivery_address TEXT NOT NULL,
    delivery_lat DECIMAL(10,8),
    delivery_lng DECIMAL(11,8),
    total_price DECIMAL(10,2) NOT NULL,
    delivery_fee DECIMAL(10,2) DEFAULT 5.00,
    payment_method ENUM('credit_card','debit_card','e_wallet','cash_on_delivery') DEFAULT 'cash_on_delivery',
    notes TEXT,
    estimated_delivery TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (rider_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ================================================
-- Table 4: order_items
-- Line items for each order (what medicines were ordered)
-- ================================================
CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    medicine_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ================================================
-- Performance Indexes
-- ================================================
CREATE INDEX idx_medicines_category ON medicines(category);
CREATE INDEX idx_medicines_available ON medicines(is_available);
CREATE INDEX idx_medicines_expiry ON medicines(expiry_date);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_rider ON orders(rider_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_medicine ON order_items(medicine_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);

-- ================================================
-- Seed Data: Medicines (12 products)
-- ================================================
INSERT INTO medicines (name, description, category, price, stock, unit, dosage, manufacturer, expiry_date, image_url, requires_prescription, is_available) VALUES
('Panadol Extra 500mg', 'Fast-acting pain and fever relief with caffeine. Suitable for headaches, migraines, muscle pain, and toothaches.', 'painkillers', 8.90, 500, 'tablet', '2 tablets every 4-6 hours, max 8/day', 'GSK Malaysia', '2027-06-30', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400', 0, 1),
('Augmentin 625mg', 'Broad-spectrum antibiotic containing amoxicillin and clavulanate. Used for bacterial infections.', 'antibiotics', 45.00, 150, 'tablet', '1 tablet 3x daily for 7 days', 'GSK Malaysia', '2026-12-31', 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=400', 1, 1),
('Vitamin C 1000mg Effervescent', 'High-dose Vitamin C to boost your immune system. Orange-flavored effervescent tablet.', 'vitamins', 22.50, 300, 'tablet', '1 tablet daily dissolved in water', 'Redoxon', '2028-03-31', 'https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=400', 0, 1),
('Cetaphil Gentle Cleanser', 'Mild, non-irritating face cleanser suitable for sensitive and dry skin. Dermatologist recommended.', 'skincare', 35.00, 120, 'bottle (500ml)', 'Apply to face and rinse', 'Cetaphil', '2028-01-31', 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400', 0, 1),
('Clarinase Repetabs', 'Non-drowsy antihistamine + decongestant. Effective for cold, flu, and allergy relief.', 'cold_flu', 18.50, 200, 'tablet', '1 tablet twice daily', 'MSD Malaysia', '2027-09-30', 'https://images.unsplash.com/photo-1550572017-edd951b55104?w=400', 0, 1),
('Metformin 500mg', 'First-line oral medication for type 2 diabetes. Controls blood glucose levels effectively.', 'diabetes', 12.00, 250, 'tablet', '1 tablet with meals, 2-3x daily', 'Pharmaniaga', '2027-03-31', 'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=400', 1, 1),
('Omega-3 Fish Oil 1000mg', 'High-quality omega-3 fatty acid supplement for heart health, brain function, and joint support.', 'heart', 55.00, 180, 'capsule', '1-2 capsules daily with meals', 'Blackmores', '2027-12-31', 'https://images.unsplash.com/photo-1576086213369-97a306d36557?w=400', 0, 1),
('Gaviscon Antacid Mint', 'Fast-acting antacid for heartburn, indigestion, and acid reflux. Pleasant mint flavour.', 'general', 14.50, 340, 'tablet', '2-4 tablets after meals and at bedtime', 'Reckitt Benckiser', '2027-08-31', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400', 0, 1),
('Biotin 5000mcg Hair & Nails', 'Premium biotin supplement for stronger hair, nails, and healthy skin metabolism.', 'vitamins', 42.00, 95, 'capsule', '1 capsule daily with meal', 'Naturo Sciences', '2028-06-30', 'https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=400', 0, 1),
('Amoxicillin 500mg', 'Common penicillin-type antibiotic for treating bacterial infections including ear, throat and UTI.', 'antibiotics', 15.00, 200, 'capsule', '1 capsule 3x daily for 5-7 days', 'Hovid', '2026-10-31', 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=400', 1, 1),
('Loratadine 10mg', 'Non-drowsy antihistamine for allergic rhinitis, urticaria, and seasonal allergies.', 'cold_flu', 9.50, 280, 'tablet', '1 tablet once daily', 'Pharmaniaga', '2027-11-30', 'https://images.unsplash.com/photo-1550572017-edd951b55104?w=400', 0, 1),
('Natural Vitamin E 400IU', 'Natural source Vitamin E for antioxidant protection, skin health, and immune support.', 'vitamins', 38.00, 160, 'capsule', '1 capsule daily after meals', 'Vigour Health', '2028-04-30', 'https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=400', 0, 1);

SELECT 'MediDeliver database schema created and seeded successfully!' AS status;
