const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar body-parser para manejar formularios
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Servir archivos estáticos de la carpeta okivo_website
app.use(express.static(__dirname));

// Configurar base de datos SQLite
const dbFile = `${__dirname}/submissions.db`;
const db = new sqlite3.Database(dbFile);
// Crear tabla si no existe
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT,
    telefono TEXT,
    email TEXT,
    mensaje TEXT,
    timestamp TEXT
  )`);
});

// Configurar Nodemailer (requiere que el usuario defina las variables de entorno EMAIL_USER y EMAIL_PASS)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Ruta para recibir el envío del formulario
app.post('/submit-form', (req, res) => {
  const { nombre, telefono, email, mensaje, captcha_n1, captcha_n2, captcha_answer } = req.body;
  // Validar teléfono costarricense
  const phoneRegex = /^\(\+506\)\s\d{4}-\d{4}$/;
  if (!phoneRegex.test(telefono)) {
    return res.json({ success: false, message: 'Número de teléfono no válido. Usa el formato (+506) 9999-9999.' });
  }
  // Validar email simple
  const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  if (!emailRegex.test(email)) {
    return res.json({ success: false, message: 'Correo electrónico no válido.' });
  }
  // Validar captcha
  const expected = parseInt(captcha_n1) + parseInt(captcha_n2);
  if (expected !== parseInt(captcha_answer)) {
    return res.json({ success: false, message: 'El CAPTCHA es incorrecto. Intenta de nuevo.' });
  }
  // Guardar en la base de datos
  const timestamp = new Date().toISOString();
  db.run(
    'INSERT INTO submissions (nombre, telefono, email, mensaje, timestamp) VALUES (?, ?, ?, ?, ?)',
    [nombre, telefono, email, mensaje, timestamp],
    function(err) {
      if (err) {
        console.error('Error al insertar en la base de datos', err);
        return res.json({ success: false, message: 'No se pudo procesar tu solicitud. Intenta más tarde.' });
      }
      // Enviar notificaciones por correo
      // Correo interno de notificación (corregido: juank.mirand@gmail.com)
      const internalEmail = 'juank.mirand@gmail.com';
      const internalMailOptions = {
        from: process.env.EMAIL_USER,
        to: internalEmail,
        subject: 'Nueva solicitud de Okivo',
        text: `Se ha recibido una nueva solicitud:\n\nNombre: ${nombre}\nTeléfono: ${telefono}\nEmail: ${email}\nMensaje: ${mensaje || '(sin mensaje)'}\nFecha: ${timestamp}`
      };
      const userMailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Hemos recibido tu solicitud',
        text: '¡Gracias por contactar a Okivo! Hemos recibido tu solicitud y pronto nos pondremos en contacto contigo.'
      };
      // Enviar correos
      transporter.sendMail(internalMailOptions, (error, info) => {
        if (error) {
          console.error('Error al enviar correo interno:', error);
        }
      });
      transporter.sendMail(userMailOptions, (error, info) => {
        if (error) {
          console.error('Error al enviar correo al usuario:', error);
        }
      });
      // Responder al cliente
      return res.json({ success: true, message: '¡Gracias! Pronto nos pondremos en contacto contigo.' });
    }
  );
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});