const bcrypt = require('bcryptjs');
const mysql = require('mysql2');
require('dotenv').config();

// Conexión a la base de datos
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Usuarios de prueba con roles
const usuarios = [
  { username: 'superadmin1', password: 'super123', role_id: 1 },
  { username: 'admin_user', password: 'admin123', role_id: 2 },
  { username: 'admin_user2', password: 'admin456', role_id: 2 },
  { username: 'regular_user', password: 'user123', role_id: 3 },
];

// Desactivar temporalmente la comprobación de claves foráneas
db.query('SET FOREIGN_KEY_CHECKS = 0', (err) => {
  if (err) {
    console.error('❌ Error al desactivar claves foráneas:', err.message);
    db.end();
    return;
  }

  // Eliminar todos los usuarios
  db.query('DELETE FROM users', (err, result) => {
    if (err) {
      console.error('❌ Error al eliminar usuarios:', err.message);
      db.end();
      return;
    }

    console.log(`🧹 Usuarios anteriores eliminados (${result.affectedRows})`);

    // Insertar los nuevos usuarios con contraseña hasheada
    usuarios.forEach(({ username, password, role_id }) => {
      const hashedPassword = bcrypt.hashSync(password, 10);
      db.query(
        'INSERT INTO users (username, password, role_id) VALUES (?, ?, ?)',
        [username, hashedPassword, role_id],
        (err) => {
          if (err) {
            console.error(`❌ Error al insertar ${username}:`, err.message);
          } else {
            console.log(`✅ Usuario insertado: ${username}`);
          }
        }
      );
    });

    // Reactivar la comprobación de claves foráneas
    db.query('SET FOREIGN_KEY_CHECKS = 1', (err) => {
      if (err) {
        console.error('❌ Error al reactivar claves foráneas:', err.message);
      } else {
        console.log('✅ Claves foráneas reactivadas');
      }

      db.end();
      console.log('✅ Script completado y conexión cerrada');
    });
  });
});
