const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

const allowedOrigin = 'https://scaling-parakeet-ggw6rp5j6w63v4pj-19006.app.github.dev';

app.use(cors({
  origin: allowedOrigin,
  credentials: true,
}));

const SUPABASE_URL = 'https://kathcxgrriikfdwvqhpz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJI...'; // acortado por seguridad
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const JWT_SECRET = 'supersecreto';

app.post('/login', async (req, res) => {
  const { usuario, contrasena } = req.body;

  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('usuario', usuario)
    .eq('contrasena', contrasena)
    .single();

  if (error || !data) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  const token = jwt.sign(
    { id: data.id, usuario: data.usuario },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  res.json({ token });
});

// 👇 Escucha en 0.0.0.0 para que funcione con Codespaces
app.listen(3001, '0.0.0.0', () => {
  console.log('Servidor de autenticación corriendo en http://0.0.0.0:3001');
});
