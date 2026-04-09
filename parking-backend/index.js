const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const { Server } = require('socket.io');
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" } // Permitimos que el frontend se conecte
});
const PORT = 3000;

// El "Secret" que configuraste en GitHub
const SECRET = 'mi_secreto_parking'; 
const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/FranZisko/parking-data-storage/refs/heads/main/parking.json';

app.use(express.json());

// Función para aplicar la lógica de negocio
function procesarVehiculos(vehiculos) {
    return vehiculos.map(v => {
        // Caso A: El vehículo ya salió y tiene su monto calculado
        if (v.salida && (v.monto_pagar !== null && v.monto_pagar !== "")) {
            return v; 
        }

        // Caso B: El vehículo acaba de salir (tiene salida pero no monto)
        if (v.salida && (!v.monto_pagar)) {
            v.monto_pagar = calcularCosto(v.entrada, v.salida);
            console.log(`Cálculo final para ${v.placa}: ${v.monto_pagar}€`);
        } 
        
        // Caso C: El vehículo sigue en el parking
        else {
            v.monto_pagar = null; // Aseguramos que sea null mientras esté dentro
            // Opcional: calcular monto acumulado "en vivo" para el Dashboard
            v.monto_provisional = calcularCosto(v.entrada, new Date().toISOString());
        }
        
        return v;
    });
}

function calcularCosto(entrada, salida) {
    const inicio = new Date(entrada);
    const fin = new Date(salida);
    const diffHoras = (fin - inicio) / (1000 * 60 * 60);
    
    if (diffHoras < 0) return 0;
    
    const tarifaBase = 5;
    // Cada 2 horas sube la tarifa
    const bloques = Math.floor(diffHoras / 2) + 1;
    return bloques * tarifaBase;
}

// Endpoint para el Webhook
app.post('/webhook', async (req, res) => {
    const signature = req.headers['x-hub-signature-256'];
    
    // Validamos que la petición venga de GitHub
    const hmac = crypto.createHmac('sha256', SECRET);
    const digest = Buffer.from('sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex'), 'utf8');
    const checksum = Buffer.from(signature, 'utf8');

    if (checksum.length !== digest.length || !crypto.timingSafeEqual(digest, checksum)) {
        return res.status(401).send('Firma inválida');
    }

    try {
        console.log('--- Nueva actualización detectada ---');
        
        // 1. Descargamos el JSON actualizado
        const respuesta = await axios.get(GITHUB_RAW_URL);
        const listaVehiculos = respuesta.data;

        // 2. Procesamos la lista (aquí es donde aplicaremos la lógica de cobro)
        const listaProcesada = procesarVehiculos(listaVehiculos);

        console.log('Vehículos en el parking:', listaProcesada.length);
        console.table(listaProcesada); // Para verlo bonito en consola

        io.emit('parking_update', listaProcesada);
        console.log('Update enviado por WebSocket');

        res.status(200).send('Data procesada');
    } catch (error) {
        console.error('Error al obtener el JSON:', error.message);
        res.status(500).send('Error interno');
    }
});

server.listen(PORT, () => {
    console.log(`Servidor de parking escuchando en http://localhost:${PORT}`);
});