// script.js
// Maneja el envío de la forma de contacto mediante fetch API
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('.contact-form');
  const captchaQuestion = document.getElementById('captcha-question');
  const captchaAnswerInput = document.getElementById('captcha_answer');
  const captchaN1 = document.getElementById('captcha_n1');
  const captchaN2 = document.getElementById('captcha_n2');

  // Generar un captcha simple de suma
  function generateCaptcha() {
    const n1 = Math.floor(Math.random() * 9) + 1; // 1-9
    const n2 = Math.floor(Math.random() * 9) + 1; // 1-9
    captchaQuestion.textContent = `¿Cuánto es ${n1} + ${n2}?`;
    captchaN1.value = n1;
    captchaN2.value = n2;
    captchaAnswerInput.value = '';
  }

  generateCaptcha();

  // Configurar máscara para el campo de teléfono
  const phoneInput = document.getElementById('telefono');
  // Prefijar el valor con (+506) y aplicar formato mientras el usuario escribe
  function formatPhone(value) {
    // Eliminar todo lo que no sea número
    let numbers = value.replace(/[^0-9]/g, '');
    // Quitar el código 506 si aparece por error en la entrada
    if (numbers.startsWith('506')) {
      numbers = numbers.substring(3);
    }
    // Limitar a 8 dígitos
    numbers = numbers.substring(0, 8);
    let formatted = '(+506) ';
    if (numbers.length > 4) {
      formatted += numbers.substring(0, 4) + '-' + numbers.substring(4);
    } else {
      formatted += numbers;
    }
    return formatted;
  }
  // Establecer el valor inicial
  phoneInput.value = '(+506) ';
  // Aplicar formato al escribir
  phoneInput.addEventListener('input', (e) => {
    phoneInput.value = formatPhone(phoneInput.value);
  });
  // Seleccionar posición del cursor después del prefijo
  phoneInput.addEventListener('focus', () => {
    if (!phoneInput.value) {
      phoneInput.value = '(+506) ';
    }
    // Colocar el cursor al final
    setTimeout(() => {
      phoneInput.selectionStart = phoneInput.selectionEnd = phoneInput.value.length;
    }, 0);
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    // Validación del teléfono costarricense (+506) 9999-9999
    const phoneValue = phoneInput.value.trim();
    const phoneRegex = /^\(\+506\)\s\d{4}-\d{4}$/;
    if (!phoneRegex.test(phoneValue)) {
      alert('Por favor ingresa un número de teléfono válido en el formato (+506) 9999-9999.');
      return;
    }
    const formData = new FormData(form);
    fetch('/submit-form', {
      method: 'POST',
      body: formData
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          alert(data.message);
          form.reset();
          // Generar un nuevo captcha para la siguiente solicitud
          generateCaptcha();
        } else {
          alert(data.message || 'Ocurrió un error. Inténtalo de nuevo.');
        }
      })
      .catch(error => {
        console.error('Error:', error);
        alert('Ocurrió un error. Inténtalo de nuevo.');
      });
  });
});