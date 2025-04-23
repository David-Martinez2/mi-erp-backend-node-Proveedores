const bcrypt = require('bcryptjs');
const mysql = require('mysql2');
require('dotenv').config();

// Conexión a la BD
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Lista de usuarios de prueba
const usuarios = [
  { username: 'superadmin1', password: '123456', role_id: 1 },
  { username: 'admin_user', password: 'admin123', role_id: 2 },
  { username: 'admin_user2', password: 'admin456', role_id: 2 },
  { username: 'regular_user', password: 'user123', role_id: 3 },
];

usuarios.forEach(({ username, password, role_id }) => {
  const hashedPassword = bcrypt.hashSync(password, 10);

  db.query(
    'INSERT INTO users (username, password, role_id) VALUES (?, ?, ?)',
    [username, hashedPassword, role_id],
    (err) => {
      if (err) {
        console.error(`❌ Error al insertar ${username}:`, err.message);
      } else {
        console.log(`✅ Usuario ${username} insertado correctamente`);
      }
    }
  );
});
