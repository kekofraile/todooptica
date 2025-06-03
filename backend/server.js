const app = require('./app');
const mongoose = require('mongoose');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Conectado a MongoDB');
    app.listen(PORT, () => {
      console.log(`Servidor escuchando en puerto ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Error al conectar a MongoDB', err);
  });