const mysql = require('mysql2');
require('dotenv').config(); // Asegúrate de cargar las variables de entorno

const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'mi_erp_db',
  port: process.env.DB_PORT || 3306,
});

// Conexión a la base de datos
db.connect((err) => {
  if (err) {
    console.error('❌ Error al conectar a MySQL:', err.message);
    process.exit(1); // Detiene la app si no se conecta
  }
  console.log('✅ Conectado a MySQL');
});

module.exports = db;
