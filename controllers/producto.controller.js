const productoModel = require('../models/producto.model');

exports.getProductos = (req, res) => {
  productoModel.getAll((err, productos) => {
    if (err) return res.status(500).json({ message: 'Error' });
    res.json(productos);
  });
};
