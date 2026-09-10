# SuperShop — Render + Aiven + SSLCOMMERZ

This version is prepared for deployment on **Render** (Node.js/Express) with a managed **MySQL** database such as **Aiven MySQL**.

## Included
- SuperShop grocery storefront
- Cart and checkout
- SSLCOMMERZ V4 sandbox payment flow
- Admin login
- Product CRUD + stock management
- Order management
- Dashboard
- MySQL schema
- `/health` endpoint
- Supports both `DB_*` and managed-MySQL `MYSQL*` environment variables

## Local run
1. Install Node.js 18+.
2. Create a MySQL database.
3. Import `database/supershop.sql`.
4. Copy `.env.example` to `.env` and fill the values.
5. Run:
   `npm install`
   `npm start`
6. Open `http://localhost:3000`

Demo admin:
- Email: `admin@supershop.local`
- Password: `Admin@12345`

**Change the demo admin password before real production use.**

## Render + Aiven deployment

### 1) Upload to GitHub
Create a GitHub repository and upload the contents of this folder.

### 2) Create MySQL
Create a managed MySQL database (for example, Aiven MySQL) and note:
- host
- port
- database name
- username
- password

Import `database/supershop.sql` into that database.

### 3) Create Render Web Service
In Render:
- New → Web Service
- Connect your GitHub repository
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`

### 4) Add environment variables
In the Render service, add:

`DB_HOST` = your MySQL host
`DB_PORT` = your MySQL port
`DB_USER` = your MySQL username
`DB_PASSWORD` = your MySQL password
`DB_NAME` = your MySQL database name
`SSLCZ_STORE_ID` = your SSLCOMMERZ store ID
`SSLCZ_STORE_PASSWORD` = your SSLCOMMERZ store password
`SSLCZ_MODE` = `sandbox`
`BASE_URL` = your Render HTTPS URL

Example:
`BASE_URL=https://your-service.onrender.com`

Do not put real SSLCOMMERZ credentials in GitHub.

### 5) Test
Open:
- `https://your-service.onrender.com`
- `https://your-service.onrender.com/health`
- `https://your-service.onrender.com/admin-login.html`

### 6) SSLCOMMERZ callback URLs
For sandbox, configure/use these public HTTPS endpoints:

- `https://your-service.onrender.com/api/payment/success`
- `https://your-service.onrender.com/api/payment/fail`
- `https://your-service.onrender.com/api/payment/cancel`
- `https://your-service.onrender.com/api/payment/ipn`

After sandbox testing is successful, replace sandbox merchant credentials with your live SSLCOMMERZ credentials and set:

`SSLCZ_MODE=live`

## Important production notes
- Use HTTPS for payment callbacks.
- Keep merchant credentials only in Render environment variables.
- Change the demo admin password.
- The included authentication is starter/demo-level; harden authentication, rate limiting, validation, and session handling before a real commercial launch.
