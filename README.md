# 💊 MediDeliver — Online Pharmacy Delivery System

> **SWC3633 Web API Development Project**
> A full-stack RESTful API system for online pharmacy delivery built with Node.js, Express, and MySQL.

---

## 📋 Project Structure

```
SWC3633/
├── backend/                  # Node.js + Express REST API
│   ├── config/
│   │   └── database.js       # MySQL connection pool
│   ├── database/
│   │   └── schema.sql        # Database schema + seed data
│   ├── middleware/
│   │   ├── auth.js           # JWT authentication
│   │   ├── logger.js         # Request logger
│   │   ├── rateLimiter.js    # API rate limiting
│   │   └── validator.js      # Input validation
│   ├── routes/
│   │   ├── auth.js           # POST /api/auth/register|login
│   │   ├── medicines.js      # GET/POST/PUT/DELETE /api/medicines
│   │   ├── orders.js         # GET/POST/PUT/DELETE /api/orders
│   │   ├── users.js          # GET/PUT/DELETE /api/users
│   │   └── weather.js        # GET /api/weather/:city
│   ├── .env                  # Environment variables (not in git)
│   ├── package.json
│   ├── seed.js               # Optional extra seed script
│   └── server.js             # Main Express server (entry point)
├── frontend-customer/        # Customer Portal (Student 1)
│   ├── css/style.css
│   ├── js/app.js
│   └── index.html
├── frontend/                 # Admin/Pharmacist Portal (Student 2)
│   ├── css/style.css
│   ├── js/app.js
│   └── index.html
└── README.md
```

---

## ⚙️ Prerequisites

Make sure you have the following installed:

| Tool | Version | Download |
|------|---------|----------|
| Node.js | v18+ | https://nodejs.org |
| XAMPP | Latest | https://www.apachefriends.org |
| Git | Latest | https://git-scm.com |

---

## 🗄️ Database Setup (XAMPP MySQL)

### Step 1 — Start XAMPP MySQL

1. Open **XAMPP Control Panel**
2. Click **Start** next to **MySQL**
3. Wait until the status turns **green**

### Step 2 — Import the Database Schema

**Option A — Using Command Line (Recommended):**

Open a terminal and run:

```bash
cd C:\Users\user\SWC3633\backend
"C:\xampp\mysql\bin\mysql.exe" -u root < database/schema.sql
```

You should see:
```
status
MediDeliver database schema created and seeded successfully!
```

**Option B — Using phpMyAdmin:**

1. Open your browser → go to `http://localhost/phpmyadmin`
2. Click **Import** in the top menu
3. Click **Choose File** → select `backend/database/schema.sql`
4. Click **Go**

### Step 3 — Verify the Database

After importing, you should have a `medideliver` database with these 4 tables:

| Table | Description |
|-------|-------------|
| `users` | Registered customers |
| `medicines` | 12 pharmacy products (pre-seeded) |
| `orders` | Customer orders |
| `order_items` | Line items per order |

To verify, run:
```bash
"C:\xampp\mysql\bin\mysql.exe" -u root -e "USE medideliver; SHOW TABLES; SELECT COUNT(*) as medicines FROM medicines;"
```

---

## 🚀 Running the Project

### Step 1 — Install Dependencies (first time only)

```bash
cd C:\Users\user\SWC3633\backend
npm install
```

### Step 2 — Start the Server

```bash
cd C:\Users\user\SWC3633\backend
node server.js
```

You should see:
```
╔══════════════════════════════════════════════════╗
║     💊 MediDeliver API Server (SWC3633)         ║
╠══════════════════════════════════════════════════╣
║  🌐 API:      http://localhost:3000/api          ║
║  💻 Customer: http://localhost:3000              ║
║  ❤️  Health:   /api/health                        ║
╚══════════════════════════════════════════════════╝

✅ MySQL database connected successfully
```

### Step 3 — Open in Browser

| Portal | URL |
|--------|-----|
| 🏥 Customer Portal | http://localhost:3000 |
| 🔌 API Health Check | http://localhost:3000/api/health |
| 🛠️ phpMyAdmin | http://localhost/phpmyadmin |

---

## 🔁 Re-running the Project (Every Time)

```bash
# 1. Make sure XAMPP MySQL is running first!

# 2. If server is already running, kill it first:
Stop-Process -Name "node" -ErrorAction SilentlyContinue

# 3. Start the server:
cd C:\Users\user\SWC3633\backend
node server.js
```

> **Tip:** Press `Ctrl + C` in the terminal to stop the server.

---

## 🌐 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new customer account |
| POST | `/api/auth/login` | Login and get JWT token |
| GET | `/api/auth/me` | Get current user profile |

### Medicines (Public — no login required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/medicines` | List all medicines (with filter/search/sort) |
| GET | `/api/medicines/:id` | Get single medicine |

**Query Parameters for GET /api/medicines:**
```
?category=painkillers     Filter by category
?search=panadol           Search by name/description
?sort=price&order=asc     Sort results
?page=1&limit=10          Pagination
```

### Orders (Login required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/orders` | Get your own orders |
| GET | `/api/orders/:id` | Get order detail |
| POST | `/api/orders` | Place new order |
| PUT | `/api/orders/:id` | Cancel an order |
| DELETE | `/api/orders/:id` | Delete own order |

### Users
| Method | Endpoint | Description |
|--------|----------|--------------|
| GET | `/api/users/:id` | Get own user profile |
| PUT | `/api/users/:id` | Update own profile |

### Weather
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/weather/:city` | Get weather for a city |

---

## 🔐 Authentication

The API uses **JWT (JSON Web Token)** authentication.

**Register:**
```json
POST /api/auth/register
{
  "name": "Ahmad bin Ali",
  "email": "ahmad@email.com",
  "password": "password123",
  "phone": "012-3456789",
  "address": "123 Jalan Bukit Bintang, KL",
  "role": "customer"
}
```

**Login:**
```json
POST /api/auth/login
{
  "email": "ahmad@email.com",
  "password": "password123"
}
```

**Use the token** in subsequent requests:
```
Authorization: Bearer <your_token_here>
```


## 🌱 Pre-seeded Medicine Data

The schema automatically seeds **12 medicines** across these categories:

| Category | Products |
|----------|----------|
| 💊 Painkillers | Panadol Extra 500mg |
| 🦠 Antibiotics | Augmentin 625mg, Amoxicillin 500mg |
| 🧪 Vitamins | Vitamin C 1000mg, Biotin 5000mcg, Vitamin E 400IU |
| 💆 Skincare | Cetaphil Gentle Cleanser |
| 🤧 Cold & Flu | Clarinase Repetabs, Loratadine 10mg |
| 🩺 Diabetes | Metformin 500mg |
| ❤️ Heart | Omega-3 Fish Oil 1000mg |
| 📦 General | Gaviscon Antacid Mint |

---

## 🛠️ Environment Variables

The `.env` file in `backend/` (not committed to git for security):

```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=medideliver
DB_PORT=3306
JWT_SECRET=eventhub_jwt_secret_key_swc3633_2026
WEATHER_API_KEY=your_openweathermap_api_key_here
```

> ⚠️ The `.env` file is excluded from git (in `.gitignore`). Never commit secrets!

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| `Database connection failed` | Make sure XAMPP MySQL is started |
| `Port 3000 already in use` | Run `Stop-Process -Name "node"` then restart |
| `Table doesn't exist` | Re-import `database/schema.sql` |
| Cart shows wrong prices | Hard refresh browser with `Ctrl + Shift + R` |
| `Medicine not found` | Check medicines were seeded — re-import schema |

---

## 👨‍💻 Developer

- **Student 1:** Customer Portal (`/frontend-customer`) — Browse medicines, cart, checkout, order history
- **Student 2:** Pharmacist Portal (`/frontend`) — Manage medicines, view orders

**Course:** SWC3633 Web API Development
**Year:** 2026
