const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar body-parser para manejar formularios
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Servir archivos estáticos de la carpeta okivo_website
app.use(express.static(__dirname));

// Configurar Multer para manejar cargas de archivos
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    // Crear la carpeta de destino si no existe
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Configurar base de datos SQLite
const dbFile = `${__dirname}/submissions.db`;
const db = new sqlite3.Database(dbFile);
// Crear tabla para solicitudes completas si no existe
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT,
    id_number TEXT,
    nationality TEXT,
    birthdate TEXT,
    address TEXT,
    telefono TEXT,
    email TEXT,
    loan_amount REAL,
    loan_term INTEGER,
    vehicle_info TEXT,
    mensaje TEXT,
    file_paths TEXT,
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
// Ruta para recibir el envío del formulario con campos y archivos
app.post(
  '/submit-form',
  upload.fields([
    { name: 'id_files', maxCount: 4 },
    { name: 'bank_statements', maxCount: 12 },
    { name: 'income_proofs', maxCount: 10 },
    { name: 'address_proof', maxCount: 3 },
    { name: 'driver_license', maxCount: 2 },
    { name: 'vehicle_proforma', maxCount: 2 }
  ]),
  (req, res) => {
    const {
      nombre,
      id_number,
      nationality,
      birthdate,
      address,
      telefono,
      email,
      loan_amount,
      loan_term,
      vehicle_info,
      mensaje,
      captcha_n1,
      captcha_n2,
      captcha_answer
    } = req.body;
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
    // Convertir el valor del préstamo a número si es posible
    const loanAmountNumber = loan_amount ? parseFloat(loan_amount) : null;
    const loanTermNumber = loan_term ? parseInt(loan_term) : null;
    // Guardar rutas de los archivos para referencia
    const filePaths = {};
    if (req.files) {
      Object.keys(req.files).forEach(key => {
        filePaths[key] = req.files[key].map(f => f.path);
      });
    }
    const timestamp = new Date().toISOString();
    // Insertar en la tabla applications
    db.run(
      `INSERT INTO applications (nombre, id_number, nationality, birthdate, address, telefono, email, loan_amount, loan_term, vehicle_info, mensaje, file_paths, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre,
        id_number || '',
        nationality || '',
        birthdate || '',
        address || '',
        telefono,
        email,
        loanAmountNumber,
        loanTermNumber,
        vehicle_info || '',
        mensaje || '',
        JSON.stringify(filePaths),
        timestamp
      ],
      function(err) {
        if (err) {
          console.error('Error al insertar en la base de datos', err);
          return res.json({ success: false, message: 'No se pudo procesar tu solicitud. Intenta más tarde.' });
        }
        // Preparar correo interno con información detallada y archivos adjuntos
        const internalEmail = 'juank.mirand@gmail.com';
        const attachments = [];
        if (req.files) {
          Object.keys(req.files).forEach(key => {
            req.files[key].forEach(f => {
              attachments.push({ filename: path.basename(f.path), path: f.path });
            });
          });
        }
        const internalMailOptions = {
          from: process.env.EMAIL_USER,
          to: internalEmail,
          subject: 'Nueva solicitud de Okivo - Documentos incluidos',
          text: `Se ha recibido una nueva solicitud:\n\n` +
            `Nombre: ${nombre}\n` +
            `Identificación: ${id_number || 'N/D'}\n` +
            `Nacionalidad: ${nationality || 'N/D'}\n` +
            `Fecha de nacimiento: ${birthdate || 'N/D'}\n` +
            `Dirección: ${address || 'N/D'}\n` +
            `Teléfono: ${telefono}\n` +
            `Correo: ${email}\n` +
            `Monto solicitado: ${loanAmountNumber || 'N/D'}\n` +
            `Plazo: ${loanTermNumber || 'N/D'}\n` +
            `Vehículo: ${vehicle_info || 'N/D'}\n` +
            `Mensaje: ${mensaje || '(sin mensaje)'}\n` +
            `Archivos: ${JSON.stringify(filePaths, null, 2)}\n` +
            `Fecha: ${timestamp}`,
          attachments
        };
        const userMailOptions = {
          from: process.env.EMAIL_USER,
          to: email,
          subject: 'Hemos recibido tu solicitud',
          text: '¡Gracias por solicitar un crédito con Okivo! Hemos recibido tu solicitud y tus documentos. Nuestro equipo revisará la información y se pondrá en contacto contigo pronto.'
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
        return res.json({ success: true, message: '¡Gracias! Hemos recibido tu solicitud y tus documentos.' });
      }
    );
  }
);

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});