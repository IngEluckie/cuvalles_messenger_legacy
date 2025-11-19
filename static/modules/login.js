// login.js

// Script para el reloj
function updateClock() {
    const clock = document.getElementById('clock');
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    // Formato HH:MM:SS AM/PM
    let ampm = hours >= 12 ? 'PM' : 'AM';
    let hour12 = hours % 12 || 12;
    let timeString = hour12.toString().padStart(2, '0') + ':' +
                     minutes.toString().padStart(2, '0') + ':' +
                     seconds.toString().padStart(2, '0') + ' ' + ampm;
    clock.textContent = timeString;
}

setInterval(updateClock, 1000);
updateClock();

// Script para mostrar/ocultar contraseña
const togglePasswordBtn = document.getElementById('togglePassword');
const passwordInput = document.getElementById('password');

togglePasswordBtn.addEventListener('click', () => {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    togglePasswordBtn.textContent = type === 'password' ? 'Mostrar' : 'Ocultar';
});

// Lógica de Inicio de Sesión
const loginBtn = document.querySelector('.login-btn');
const usernameInput = document.getElementById('username');

// Evento para detectar la tecla "Enter" en el campo de contraseña
passwordInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault(); // Evita el comportamiento por defecto
        handleLogin(); // Llama a la función de inicio de sesión
    }
});

const browser_url = window.location.origin
// Función para manejar el inicio de sesión
async function handleLogin() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    /**
     * Hasta aquí debería de funcionar ya que estoy
     * manejando puro string.
     */
    
    // Construimos los parámetros en formato URL encoded
    const params = new URLSearchParams();
    params.append("username", username);
    params.append("password", password);

    try {
        const response = await fetch(browser_url+"/auth/login", {
            method: "POST",
            headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params.toString(),
        })

        if (!response.ok) {
            //console.log("ups error en la petición inicial")
            alert("Credenciales incorrectas")
        }

        const data = await response.json();
        console.log("Inicio de sesión exitoso:", data);
        localStorage.setItem("jwt", data.access_token)
        window.location.href = browser_url+data.dashboard

    } catch (error) {
        console.error("Error en handleLogin:", error);
        throw error;
    }
}

// Evento para el botón de inicio de sesión
loginBtn.addEventListener('click', handleLogin);