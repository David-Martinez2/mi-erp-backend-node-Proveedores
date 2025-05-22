const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql');
require('dotenv').config();
const moment = require('moment');

// Configuración de la base de datos
const db = mysql.createConnection({
  host: 'localhost',
  user: 'erp_user',
  password: '123456',
  database: 'mi_erp_db'
});

db.connect(err => {
  if (err) {
    console.error('Error al conectar a la base de datos: ' + err.stack);
    return;
  }
  console.log('Conectado a la base de datos');
});

// Creación de la aplicación Express
const app = express();



// Configuración de CORS
const corsOptions = {
  origin: ['http://localhost:3000', 'http://localhost:5173'], // Permitimos ambos puertos
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'], // Aseguramos que los headers necesarios sean permitidos
};


// Habilitamos CORS con la configuración personalizada
app.use(cors()); 

// Configuración del Body Parser
app.use(bodyParser.json()); // Para JSON

// Ruta para login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
    if (err || results.length === 0) {
      return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
    }

    const user = results[0];

    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err || !isMatch) {
        return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
      }

      const token = jwt.sign({ userId: user.id, roleId: user.role_id }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.json({ token, userData: user });
    });
  });
});

// Ruta para obtener datos del usuario
app.get('/api/user', (req, res) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Acceso no autorizado' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });

    const userId = decoded.userId;
    db.query('SELECT * FROM users WHERE id = ?', [userId], (err, results) => {
      if (err || results.length === 0) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      res.json(results[0]);
    });
  });
});
//////////////////////////////////////////
// --- Rutas para Proveedores ---
app.get('/api/proveedores', (req, res) => {
    db.query('SELECT * FROM proveedores', (err, results) => {
        if (err) {
            console.error('Error al obtener proveedores:', err);
            return res.status(500).json({ message: 'Error al obtener proveedores', error: err.message });
        }
        res.json(results);
    });
});

app.get('/api/proveedores/:id', (req, res) => {
    const { id } = req.params;
    db.query('SELECT * FROM proveedores WHERE id = ?', [id], (err, results) => {
        if (err) {
            console.error('Error al obtener proveedor por ID:', err);
            return res.status(500).json({ message: 'Error al obtener proveedor', error: err.message });
        }
        if (results.length === 0) {
            return res.status(404).json({ message: 'Proveedor no encontrado' });
        }
        res.json(results[0]);
    });
});

app.post('/api/proveedores', (req, res) => {
    const { nombre, contacto, telefono, correo, direccion } = req.body;
    if (!nombre) {
        return res.status(400).json({ message: 'El nombre del proveedor es obligatorio.' });
    }
    const query = 'INSERT INTO proveedores (nombre, contacto, telefono, correo, direccion) VALUES (?, ?, ?, ?, ?)';
    db.query(query, [nombre, contacto, telefono, correo, direccion], (err, result) => {
        if (err) {
            console.error('Error al agregar proveedor:', err);
            // Error de duplicidad de nombre o correo
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ message: 'Ya existe un proveedor con este nombre o correo.' });
            }
            return res.status(500).json({ message: 'Error al agregar proveedor', error: err.message });
        }
        res.status(201).json({ message: 'Proveedor agregado con éxito', id: result.insertId });
    });
});

app.put('/api/proveedores/:id', (req, res) => {
    const { id } = req.params;
    const { nombre, contacto, telefono, correo, direccion } = req.body;
    if (!nombre) {
        return res.status(400).json({ message: 'El nombre del proveedor es obligatorio.' });
    }
    const query = 'UPDATE proveedores SET nombre = ?, contacto = ?, telefono = ?, correo = ?, direccion = ? WHERE id = ?';
    db.query(query, [nombre, contacto, telefono, correo, direccion, id], (err, result) => {
        if (err) {
            console.error('Error al actualizar proveedor:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ message: 'Ya existe otro proveedor con este nombre o correo.' });
            }
            return res.status(500).json({ message: 'Error al actualizar proveedor', error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Proveedor no encontrado para actualizar.' });
        }
        res.json({ message: 'Proveedor actualizado con éxito' });
    });
});

app.delete('/api/proveedores/:id', (req, res) => {
    const proveedorId = req.params.id;

    // Verificar si hay entradas de inventario asociadas
    const checkEntradasQuery = 'SELECT COUNT(*) AS count FROM entradas_inventario WHERE proveedor_id = ?';
    db.query(checkEntradasQuery, [proveedorId], (err, entradasResult) => {
        if (err) {
            console.error('Error al verificar entradas de inventario asociadas:', err);
            return res.status(500).json({ message: 'Error interno del servidor al verificar entradas.' });
        }

        if (entradasResult[0].count > 0) {
            return res.status(400).json({ message: 'Error al eliminar el proveedor. Verifica que no tenga entradas de inventario asociadas.' });
        }

        // *******************************************************************
        // ¡ESTO ES LO QUE NECESITAS ELIMINAR O COMENTAR!
        // Si la tabla productos NO tiene proveedor_id, esta consulta fallará.
        // *******************************************************************
        // const checkProductosQuery = 'SELECT COUNT(*) AS count FROM productos WHERE proveedor_id = ?';
        // connection.query(checkProductosQuery, [proveedorId], (err, productosResult) => {
        //     if (err) {
        //         console.error('Error al verificar productos asociados:', err);
        //         return res.status(500).json({ message: 'Error interno del servidor al verificar productos.' });
        //     }
        //
        //     if (productosResult[0].count > 0) {
        //         return res.status(400).json({ message: 'Error al eliminar el proveedor. Verifica que no tenga productos asociados.' });
        //     }

            // Si no hay entradas ni productos asociados, proceder a eliminar el proveedor
            const deleteProveedorQuery = 'DELETE FROM proveedores WHERE id = ?';
            db.query(deleteProveedorQuery, [proveedorId], (err, deleteResult) => {
                if (err) {
                    console.error('Error al eliminar el proveedor:', err);
                    return res.status(500).json({ message: 'Error interno del servidor al eliminar el proveedor.' });
                }
                if (deleteResult.affectedRows === 0) {
                    return res.status(404).json({ message: 'Proveedor no encontrado.' });
                }
                res.status(200).json({ message: 'Proveedor eliminado exitosamente.' });
            });
        // }); // Cierra el bloque de la consulta de productos (si lo comentas)
    });
});
// --- Fin Rutas para Proveedores ---

// --- Rutas para Estimados de Entrega ---
app.get('/api/proveedores/:proveedorId/estimados', (req, res) => {
    const { proveedorId } = req.params;
    const query = 'SELECT * FROM estimados_entrega WHERE proveedor_id = ? ORDER BY fecha_estimada DESC';
    db.query(query, [proveedorId], (err, results) => {
        if (err) {
            console.error('Error al obtener estimados de entrega:', err);
            return res.status(500).json({ message: 'Error al obtener estimados de entrega', error: err.message });
        }
        res.json(results);
    });
});

app.post('/api/estimados', (req, res) => { // Ruta general para agregar estimados
    const { proveedor_id, producto_nombre, fecha_estimada, cantidad, comentarios } = req.body;
    if (!proveedor_id || !producto_nombre || !fecha_estimada || !cantidad) {
        return res.status(400).json({ message: 'Faltan campos obligatorios para el estimado de entrega.' });
    }
    const query = 'INSERT INTO estimados_entrega (proveedor_id, producto_nombre, fecha_estimada, cantidad, comentarios) VALUES (?, ?, ?, ?, ?)';
    db.query(query, [proveedor_id, producto_nombre, fecha_estimada, cantidad, comentarios], (err, result) => {
        if (err) {
            console.error('Error al registrar estimado de entrega:', err);
            return res.status(500).json({ message: 'Error al registrar estimado de entrega', error: err.message });
        }
        res.status(201).json({ message: 'Estimado de entrega registrado con éxito', id: result.insertId });
    });
});

app.put('/api/estimados/:id', (req, res) => {
    const { id } = req.params;
    const { proveedor_id, producto_nombre, fecha_estimada, cantidad, comentarios } = req.body;
    if (!proveedor_id || !producto_nombre || !fecha_estimada || !cantidad) {
        return res.status(400).json({ message: 'Faltan campos obligatorios para actualizar el estimado.' });
    }
    const query = 'UPDATE estimados_entrega SET proveedor_id = ?, producto_nombre = ?, fecha_estimada = ?, cantidad = ?, comentarios = ? WHERE id = ?';
    db.query(query, [proveedor_id, producto_nombre, fecha_estimada, cantidad, comentarios, id], (err, result) => {
        if (err) {
            console.error('Error al actualizar estimado de entrega:', err);
            return res.status(500).json({ message: 'Error al actualizar estimado de entrega', error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Estimado de entrega no encontrado para actualizar.' });
        }
        res.json({ message: 'Estimado de entrega actualizado con éxito' });
    });
});

app.delete('/api/estimados/:id', (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM estimados_entrega WHERE id = ?', [id], (err, result) => {
        if (err) {
            console.error('Error al eliminar estimado de entrega:', err);
            return res.status(500).json({ message: 'Error al eliminar estimado de entrega', error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Estimado de entrega no encontrado para eliminar.' });
        }
        res.json({ message: 'Estimado de entrega eliminado con éxito' });
    });
});

app.get('/api/estimados/:id', (req, res) => {
    const { id } = req.params;
    const query = 'SELECT * FROM estimados_entrega WHERE id = ?';
    db.query(query, [id], (err, results) => {
        if (err) {
            console.error('Error al obtener estimado por ID:', err);
            return res.status(500).json({ message: 'Error al obtener el estimado', error: err.message });
        }
        if (results.length === 0) {
            return res.status(404).json({ message: 'Estimado de entrega no encontrado.' });
        }
        res.json(results[0]); // Devuelve el primer (y único) resultado
    });
});

// --- Fin Rutas para Estimados de Entrega ---

// --- Rutas para Entradas de Inventario ---
app.get('/api/entradas-inventario', (req, res) => {
    // JOIN con proveedores y productos para mostrar nombres en lugar de solo IDs
    const query = `
        SELECT
            ei.id,
            ei.fecha_entrada,
            ei.cantidad,
            ei.estatus,
            ei.comentarios,
            p.nombre AS producto_nombre,
            pr.nombre AS proveedor_nombre
        FROM entradas_inventario ei
        JOIN productos p ON ei.producto_id = p.id
        LEFT JOIN proveedores pr ON ei.proveedor_id = pr.id
        ORDER BY ei.fecha_entrada DESC;
    `;
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error al obtener entradas de inventario:', err);
            return res.status(500).json({ message: 'Error al obtener entradas de inventario', error: err.message });
        }
        res.json(results);
    });
});

app.get('/api/entradas-inventario/:id', (req, res) => {
    const { id } = req.params;
    const query = `
        SELECT
            ei.id,
            ei.fecha_entrada,
            ei.cantidad,
            ei.estatus,
            ei.comentarios,
            p.nombre AS producto_nombre,
            pr.nombre AS proveedor_nombre
        FROM entradas_inventario ei
        JOIN productos p ON ei.producto_id = p.id
        LEFT JOIN proveedores pr ON ei.proveedor_id = pr.id
        WHERE ei.id = ?;
    `;
    db.query(query, [id], (err, results) => {
        if (err) {
            console.error('Error al obtener entrada de inventario por ID:', err);
            return res.status(500).json({ message: 'Error al obtener entrada de inventario', error: err.message });
        }
        if (results.length === 0) {
            return res.status(404).json({ message: 'Entrada de inventario no encontrada' });
        }
        res.json(results[0]);
    });
});

app.post('/api/entradas-inventario', (req, res) => {
    const { proveedor_id, producto_nombre, cantidad, fecha_entrada, comentarios } = req.body; // Recibe producto_nombre y fecha_entrada

    // Validaciones
    if (!producto_nombre || !cantidad || !fecha_entrada) { // Estatus no es obligatorio en el frontend
        return res.status(400).json({ message: 'Faltan campos obligatorios para registrar la entrada de inventario (Producto, Cantidad, Fecha).' });
    }

    // Paso 1: Obtener el producto_id basado en producto_nombre
    db.query('SELECT id FROM productos WHERE nombre = ?', [producto_nombre], (err, productResults) => {
        if (err) {
            console.error('Error al buscar producto por nombre:', err);
            return res.status(500).json({ message: 'Error interno del servidor al buscar producto.' });
        }
        if (productResults.length === 0) {
            return res.status(404).json({ message: 'Producto no encontrado en la base de datos.' });
        }
        const producto_id = productResults[0].id;

        // Paso 2: Insertar la entrada de inventario
        // `proveedor_id` puede ser NULL, por eso se usa `proveedor_id || null`
        const query = 'INSERT INTO entradas_inventario (proveedor_id, producto_id, cantidad, fecha_entrada, comentarios) VALUES (?, ?, ?, ?, ?)';
        db.query(query, [proveedor_id || null, producto_id, cantidad, fecha_entrada, comentarios], (err, result) => { // Ahora pasamos fecha_entrada
            if (err) {
                console.error('Error al registrar entrada de inventario:', err);
                return res.status(500).json({ message: 'Error al registrar entrada de inventario', error: err.message });
            }
            res.status(201).json({ message: 'Entrada de inventario registrada con éxito', id: result.insertId });

            // Paso 3: Opcional: Actualizar el stock del producto
            const updateStockQuery = 'UPDATE productos SET stock = stock + ? WHERE id = ?';
            db.query(updateStockQuery, [cantidad, producto_id], (err, updateResult) => {
                if (err) {
                    console.error('Error al actualizar el stock del producto:', err);
                } else {
                    console.log(`Stock del producto ${producto_id} actualizado por +${cantidad}`);
                }
            });
        });
    });
});

app.put('/api/entradas-inventario/:id', (req, res) => {
    const { id } = req.params;
    const { proveedor_id, producto_nombre, cantidad, fecha_entrada, comentarios } = req.body; // Recibe producto_nombre y fecha_entrada

    // Validaciones
    if (!producto_nombre || !cantidad || !fecha_entrada) {
        return res.status(400).json({ message: 'Faltan campos obligatorios para actualizar la entrada de inventario (Producto, Cantidad, Fecha).' });
    }

    // Paso 1: Obtener el producto_id basado en producto_nombre
    db.query('SELECT id FROM productos WHERE nombre = ?', [producto_nombre], (err, productResults) => {
        if (err) {
            console.error('Error al buscar producto por nombre:', err);
            return res.status(500).json({ message: 'Error interno del servidor al buscar producto.' });
        }
        if (productResults.length === 0) {
            return res.status(404).json({ message: 'Producto no encontrado en la base de datos.' });
        }
        const producto_id = productResults[0].id;

        // Paso 2: Actualizar la entrada de inventario
        const query = 'UPDATE entradas_inventario SET proveedor_id = ?, producto_id = ?, cantidad = ?, fecha_entrada = ?, comentarios = ? WHERE id = ?';
        db.query(query, [proveedor_id || null, producto_id, cantidad, fecha_entrada, comentarios, id], (err, result) => {
            if (err) {
                console.error('Error al actualizar entrada de inventario:', err);
                return res.status(500).json({ message: 'Error al actualizar entrada de inventario', error: err.message });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Entrada de inventario no encontrada para actualizar.' });
            }
            res.json({ message: 'Entrada de inventario actualizada con éxito' });

            // Nota: La actualización de stock en PUT es más compleja (calcular delta),
            // por ahora no la incluiremos aquí para simplificar, a menos que la necesites.
            // Si la necesitas, hay que obtener la cantidad anterior, restar, y luego sumar la nueva.
        });
    });
});

app.delete('/api/entradas-inventario/:id', (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM entradas_inventario WHERE id = ?', [id], (err, result) => {
        if (err) {
            console.error('Error al eliminar entrada de inventario:', err);
            return res.status(500).json({ message: 'Error al eliminar entrada de inventario', error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Entrada de inventario no encontrada para eliminar.' });
        }
        res.json({ message: 'Entrada de inventario eliminada con éxito' });
    });
});
// --- Fin Rutas para Entradas de Inventario ---


/*
// Ruta para login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
    if (err || results.length === 0) {
      return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
    }

    const user = results[0];

    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err || !isMatch) {
        return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
      }

      const token = jwt.sign({ userId: user.id, roleId: user.role_id }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.json({ token, userData: user });
    });
  });
});

// Ruta para obtener datos del usuario
app.get('/api/user', (req, res) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Acceso no autorizado' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });

    const userId = decoded.userId;
    db.query('SELECT * FROM users WHERE id = ?', [userId], (err, results) => {
      if (err || results.length === 0) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      res.json(results[0]);
    });
  });
});
*/
// Ruta para obtener productos
app.get('/api/productos', (req, res) => {
  db.query('SELECT * FROM productos', (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Error al obtener productos', error: err });
    }
    res.json(results);
  });
});

// Ruta para agregar productos
app.post('/api/productos', (req, res) => {
  const { nombre, descripcion, precio, stock } = req.body;
  const query = 'INSERT INTO productos (nombre, descripcion, precio, stock) VALUES (?, ?, ?, ?)';
  db.query(query, [nombre, descripcion, precio, stock], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Error al agregar producto', error: err });
    }
    res.status(201).json({ message: 'Producto agregado con éxito' });
  });
});


app.get('/api/ventas', (req, res) => {
  const query = `
SELECT 
  v.id, 
  v.fecha, 
  v.total, 
  c.nombre AS cliente,
  p.nombre AS producto, 
  dv.cantidad
FROM ventas v
LEFT JOIN clientes c ON v.cliente_id = c.id
LEFT JOIN detalle_ventas dv ON v.id = dv.venta_id
LEFT JOIN productos p ON dv.producto_id = p.id
ORDER BY v.fecha DESC;

  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error al obtener ventas:', err);
      return res.status(500).json({ message: 'Error al obtener ventas', error: err });
    }

    const ventas = {};

    results.forEach(row => {
      if (!ventas[row.venta_id]) {
        ventas[row.venta_id] = {
          id: row.venta_id,
          fecha: row.fecha,
          total: row.total,
          cliente: row.cliente,
          productos: []
        };
      }

      ventas[row.venta_id].productos.push({
        nombre: row.producto,
        cantidad: row.cantidad,
        precio_unitario: row.precio_unitario
      });
    });

    res.json(Object.values(ventas));
  });
});


// Ruta para obtener ventas con cliente, producto y cantidad
app.post('/api/ventas', (req, res) => {
  const { cliente, productos, total, fecha } = req.body;

  if (!cliente || !cliente.nombre) {
    return res.status(400).json({ message: 'Falta información del cliente' });
  }

  // Paso 1: Insertar o buscar cliente
  const buscarCliente = 'SELECT id FROM clientes WHERE nombre = ? AND telefono = ? LIMIT 1';
  db.query(buscarCliente, [cliente.nombre, cliente.telefono], (err, resultado) => {
    if (err) {
      return res.status(500).json({ message: 'Error al buscar cliente', error: err });
    }

    if (resultado.length > 0) {
      // Cliente ya existe
      insertarVenta(resultado[0].id);
    } else {
      // Cliente nuevo
      const insertarCliente = 'INSERT INTO clientes (nombre, telefono) VALUES (?, ?)';
      db.query(insertarCliente, [cliente.nombre, cliente.telefono], (err, result) => {
        if (err) {
          return res.status(500).json({ message: 'Error al insertar cliente', error: err });
        }
        insertarVenta(result.insertId);
      });
    }
  });

  // Paso 2: Insertar venta y sus detalles
  function insertarVenta(clienteId) {
    const insertVenta = 'INSERT INTO ventas (cliente_id, total, fecha) VALUES (?, ?, ?)';
    db.query(insertVenta, [clienteId, total, fecha || new Date()], (err, ventaResult) => {
      if (err) {
        return res.status(500).json({ message: 'Error al registrar venta', error: err });
      }

      const ventaId = ventaResult.insertId;

      if (!productos || productos.length === 0) {
        return res.status(400).json({ message: 'No hay productos en la venta' });
      }

      const detalles = productos.map(p => [
        ventaId,
        p.producto_id,
        p.cantidad,
        p.precio_unitario
      ]);

      const insertDetalles = `
        INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario)
        VALUES ?
      `;

      db.query(insertDetalles, [detalles], (err) => {
        if (err) {
          return res.status(500).json({ message: 'Error al insertar detalles de venta', error: err });
        }

        res.json({ message: 'Venta registrada exitosamente' });
      });
    });
  }
});

// Ruta para obtener clientes
app.get('/api/clientes', (req, res) => {
  db.query('SELECT * FROM clientes', (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Error al obtener clientes', error: err });
    }
    res.json(results);
  });
});

// Ruta para agregar un cliente
app.post('/api/clientes', (req, res) => {
  const { nombre, correo, telefono, direccion } = req.body;
  const query = 'INSERT INTO clientes (nombre, correo, telefono, direccion) VALUES (?, ?, ?, ?)';
  db.query(query, [nombre, correo, telefono, direccion], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Error al agregar cliente', error: err });
    }
    const nuevoCliente = {
      id: results.insertId,
      nombre,
      correo,
      telefono,
      direccion
    };
    res.status(201).json(nuevoCliente);
  });
});

// Iniciar el servidor
const port = 3001;
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});


// Obtener todos los empleados
app.get('/api/empleados', (req, res) => {
  db.query('SELECT * FROM empleados', (err, results) => {
    if (err) return res.status(500).json({ message: 'Error al obtener empleados', error: err });
    res.json(results);
  });
});

// Obtener un empleado por ID
app.get('/api/empleados/:id', (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM empleados WHERE id = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ message: 'Error al buscar empleado', error: err });
    if (results.length === 0) return res.status(404).json({ message: 'Empleado no encontrado' });
    res.json(results[0]);
  });
});

// Agregar un nuevo empleado
app.post('/api/empleados', (req, res) => {
  const { nombre, puesto, correo, telefono, salario, fecha_contratacion } = req.body;
  const query = 'INSERT INTO empleados (nombre, puesto, correo, telefono, salario, fecha_contratacion) VALUES (?, ?, ?, ?, ?, ?)';
  db.query(query, [nombre, puesto, correo, telefono, salario, fecha_contratacion], (err, result) => {
    if (err) return res.status(500).json({ message: 'Error al agregar empleado', error: err });
    res.status(201).json({ message: 'Empleado agregado con éxito', id: result.insertId });
  });
});

// Actualizar un empleado
app.put('/api/empleados/:id', (req, res) => {
  const { id } = req.params;
  const { nombre, puesto, correo, telefono, salario, fecha_contratacion } = req.body;
  const query = 'UPDATE empleados SET nombre = ?, puesto = ?, correo = ?, telefono = ?, salario = ?, fecha_contratacion = ? WHERE id = ?';
  db.query(query, [nombre, puesto, correo, telefono, salario, fecha_contratacion, id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Error al actualizar empleado', error: err });
    res.json({ message: 'Empleado actualizado con éxito' });
  });
});

// Eliminar un empleado
app.delete('/api/empleados/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM empleados WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Error al eliminar empleado', error: err });
    res.json({ message: 'Empleado eliminado con éxito' });
  });
});


//home
// Ruta para contar productos
app.get('/api/productos/count', (req, res) => {
  db.query('SELECT COUNT(*) AS count FROM productos', (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error al obtener productos');
    }
    res.json(results[0]);
  });
});
// Ruta para contar clientes
app.get('/api/clientes/count', (req, res) => {
  db.query('SELECT COUNT(*) AS count FROM clientes', (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error al obtener clientes');
    }
    res.json(results[0]);
  });
});
// Ruta para contar empleados
app.get('/api/empleado/count', (req, res) => {
  db.query('SELECT COUNT(*) AS count FROM empleados', (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error al obtener empleados');
    }
    res.json(results[0]);
  });
});

// Ruta para registrar nuevos usuarios
app.post('/api/usuarios', async (req, res) => {
  const { username, password} = req.body;

  if (!username || !password ) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = 'INSERT INTO users (username, password) VALUES (?, ?)';
    db.query(query, [username, hashedPassword], (err, result) => {
      if (err) {
        console.error('Error al registrar usuario:', err);
        return res.status(500).json({ message: 'Error al registrar usuario' });
      }

      res.status(201).json({ message: 'Usuario registrado con éxito' });
    });
  } catch (error) {
    console.error('Error en el hash de contraseña:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});
/*
// ✅ Ruta protegida: Registrar nuevo usuario (solo superadmin)
app.post('/api/usuarios', (req, res) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token requerido' });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });

    const userId = decoded.userId;
    
    // Verificamos si el usuario que hace la petición es superadmin
    db.query('SELECT u.id, r.name AS role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?', [userId], async (err, results) => {
      if (err || results.length === 0) {
        return res.status(403).json({ message: 'Usuario no autorizado' });
      }

      const userRole = results[0].role;

      if (userRole !== 'superadmin') {
        return res.status(403).json({ message: 'Solo los superadmin pueden registrar usuarios' });
      }

      const { username, password, role_id } = req.body;

      if (!username || !password || !role_id) {
        return res.status(400).json({ message: 'Todos los campos son requeridos' });
      }

      try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.query(
          'INSERT INTO users (username, password, role_id) VALUES (?, ?, ?)',
          [username, hashedPassword, role_id],
          (err, result) => {
            if (err) {
              console.error('Error al registrar usuario:', err);
              return res.status(500).json({ message: 'Error al registrar usuario', error: err });
            }

            res.status(201).json({ message: 'Usuario registrado con éxito', id: result.insertId });
          }
        );
      } catch (error) {
        res.status(500).json({ message: 'Error al hashear la contraseña' });
      }
    });
  });
});
*/
//aqui comienza el ERP movil
// ✅ Ruta para obtener todas las máquinas
app.get('/api/maquinas', (req, res) => {
  db.query('SELECT * FROM maquinas', (err, results) => {
    if (err) {
      console.error('Error al obtener máquinas:', err);
      return res.status(500).json({ message: 'Error al obtener máquinas', error: err.message });
    }
    res.json(results); // Devuelve las máquinas al frontend
  });
});

app.post('/api/produccion', (req, res) => {
  const { empleado_id, producto_id, cantidad, turno, fecha, maquina_id, horas_trabajadas, estado_produccion, descripcion } = req.body;

  // Convertir la fecha en el formato correcto para MySQL
  const fechaFormateada = moment(fecha).format('YYYY-MM-DD HH:mm:ss');
  console.log('Fecha formateada:', fechaFormateada);  // Para asegurarnos de que la fecha está correcta

  const query = 'INSERT INTO produccion (empleado_id, producto_id, cantidad, turno, fecha, maquina_id, horas_trabajadas, estado_produccion, descripcion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
  db.query(query, [empleado_id, producto_id, cantidad, turno, fechaFormateada, maquina_id, horas_trabajadas, estado_produccion, descripcion], (err, results) => {
    if (err) {
      console.error('Error al registrar la producción:', err);  // Veremos el error detallado en la consola
      return res.status(500).json({ message: 'Error al registrar la producción', error: err });
    }
    res.status(201).json({ message: 'Producción registrada con éxito' });
  });
});


app.post('/api/fallas', (req, res) => {
  const { empleado_id, maquina_id, descripcion_falla, severidad, fecha_reporte } = req.body;

  // Validaciones
  if (!descripcion_falla || !descripcion_falla.trim()) {
    return res.status(400).json({ error: 'La descripción de la falla es obligatoria.' });
  }

  if (!fecha_reporte) {
    return res.status(400).json({ error: 'La fecha del reporte es obligatoria.' });
  }

  console.log("📦 Body recibido:", req.body); // 🔍 Debug
  console.log("📅 Fecha formateada:", fecha_reporte);

  const query = `
    INSERT INTO fallas (empleado_id, maquina_id, descripcion, severidad, fecha)
    VALUES (?, ?, ?, ?, ?)
  `;
  const values = [empleado_id, maquina_id, descripcion_falla, severidad, fecha_reporte];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error('Error al registrar la falla:', err);
      return res.status(500).json({ error: 'Error al guardar el reporte en la base de datos.' });
    }
    res.status(200).json({ message: 'Falla reportada con éxito.' });
  });
});


