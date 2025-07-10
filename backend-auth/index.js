const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

// Permite múltiples orígenes para desarrollo
const allowedOrigins = [
  'https://scaling-parakeet-ggw6rp5j6w63v4pj-19006.app.github.dev',
  'https://supreme-happiness-r4gqgp6wrgv43wpjj-19006.app.github.dev',
  'http://localhost:19006',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    // Permitir solicitudes sin origen (aplicaciones móviles, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Permitir cualquier subdominio de GitHub Codespaces
    if (origin.includes('.app.github.dev')) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Origen bloqueado por CORS:', origin);
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

const SUPABASE_URL = 'https://kathcxgrriikfdwvqhpz.supabase.co';
// IMPORTANTE: Necesitas completar esta clave con la real de tu proyecto Supabase
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthdGhjeGdycmlpa2Zkd3ZxaHB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwOTI3MzgsImV4cCI6MjA2NzY2ODczOH0.68aj45VrDvrcJT0dNX3OSIGZeLjld-W4du3SbVxkSKE'; // ⚠️ DEBES COMPLETAR ESTA CLAVE
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const JWT_SECRET = 'supersecreto';

app.post('/login', async (req, res) => {
  try {
    const { usuario, contrasena } = req.body;

    // Validación de entrada
    if (!usuario || !contrasena) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }

    console.log('Intentando login para usuario:', usuario);

    // Usuario de prueba para desarrollo
    if (usuario === 'admin' && contrasena === '123456') {
      const token = jwt.sign(
        { id: 1, usuario: 'admin' },
        JWT_SECRET,
        { expiresIn: '2h' }
      );

      return res.json({ 
        token, 
        usuario: 'admin',
        message: 'Login exitoso (usuario de prueba)' 
      });
    }

    // Intentar con Supabase si las credenciales de prueba no funcionan
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('usuario', usuario)
      .eq('contrasena', contrasena)
      .single();

    if (error) {
      console.error('Error de Supabase:', error);
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    if (!data) {
      console.log('No se encontró usuario');
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    console.log('Usuario encontrado:', data);

    const token = jwt.sign(
      { id: data.id, usuario: data.usuario },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({ 
      token, 
      usuario: data.usuario,
      message: 'Login exitoso' 
    });

  } catch (error) {
    console.error('Error interno del servidor:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint de prueba para verificar conexión
app.get('/test', (req, res) => {
  res.json({ message: 'Servidor funcionando correctamente', timestamp: new Date() });
});

// Endpoint para probar conexión con Supabase
app.get('/test-db', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('usuario')
      .limit(1);

    if (error) {
      return res.status(500).json({ 
        error: 'Error conectando con Supabase', 
        details: error.message 
      });
    }

    res.json({ 
      message: 'Conexión con Supabase exitosa', 
      users_found: data ? data.length : 0 
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Error interno', 
      details: error.message 
    });
  }
});

// 👇 Escucha en 0.0.0.0 para que funcione con Codespaces
app.listen(3001, '0.0.0.0', () => {
  console.log('Servidor de autenticación corriendo en http://0.0.0.0:3001');
});
