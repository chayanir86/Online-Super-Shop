-- Import this file into the MySQL database selected in your hosting provider.
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(80) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  image_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tran_id VARCHAR(80) NOT NULL UNIQUE,
  customer_name VARCHAR(150) NOT NULL,
  customer_email VARCHAR(150) NOT NULL,
  customer_phone VARCHAR(40) NOT NULL,
  address VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'BDT',
  payment_method VARCHAR(50) NOT NULL DEFAULT 'SSLCOMMERZ',
  payment_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  order_status VARCHAR(30) NOT NULL DEFAULT 'PROCESSING',
  val_id VARCHAR(100),
  bank_tran_id VARCHAR(100),
  card_type VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  product_name VARCHAR(150) NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

INSERT INTO products (name, category, description, price, stock, image_url) VALUES
('Fresh Atta Rice 5 kg', 'Groceries & Food', 'Premium quality rice for everyday meals.', 285.00, 50, 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600'),
('Fresh Sunflower Oil 1 Liter', 'Groceries & Food', 'Pure sunflower cooking oil.', 165.00, 40, 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600'),
('Pran UHT Milk 1 Liter', 'Groceries & Food', 'Long-life UHT milk.', 72.00, 60, 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600'),
('Marie Biscuit 200 g', 'Snacks & Biscuits', 'Crispy tea-time biscuits.', 40.00, 80, 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600'),
('Sunsilk Shampoo 180 ml', 'Personal Care', 'Daily care shampoo.', 320.00, 25, 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600'),
('Colgate Toothpaste 100 g', 'Personal Care', 'Fresh breath and oral care.', 120.00, 35, 'https://images.unsplash.com/photo-1559591937-e7d74f8e8f2f?w=600'),
('Lentil (Mosur Dal) 1 kg', 'Groceries & Food', 'Clean red lentils.', 95.00, 50, 'https://images.unsplash.com/photo-1515543904379-3d757afe72e4?w=600'),
('Sugar 1 kg', 'Groceries & Food', 'Fine white sugar.', 120.00, 70, 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?w=600'),
('Tea 200 g', 'Beverages', 'Premium black tea.', 180.00, 45, 'https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=600');


CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(64) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  token VARCHAR(100) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

INSERT INTO admins(name,email,password_hash)
SELECT 'SuperShop Admin','admin@supershop.local',SHA2('Admin@12345',256)
WHERE NOT EXISTS (SELECT 1 FROM admins WHERE email='admin@supershop.local');
