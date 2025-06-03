const express = require('express');
const cors = require('cors');
require('dotenv').config();

const userRoutes = require('./routes/userRoutes');
// Aquí luego importarás más rutas (pedidos, productos, etc.)

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/users', userRoutes);

app.get('/', (req, res) => {
  res.send('API TodoOptica funcionando');
});

module.exports = app;