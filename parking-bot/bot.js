const simpleGit = require('simple-git');
const fs = require('fs');
const path = require('path');

// Configuración: Ajusta la ruta a tu carpeta del repo de GitHub
const repoPath = path.resolve(__dirname, '../parking-storage/parking-data-storage');
const git = simpleGit(repoPath);
const jsonPath = path.join(repoPath, 'parking.json');

const marcas = ['Toyota', 'Honda', 'BMW', 'Ford', 'Audi', 'Tesla'];
const colores = ['Blanco', 'Negro', 'Rojo', 'Azul', 'Gris'];

async function simularMovimiento() {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const rand = Math.random();

    // 70% de probabilidad de entrada si hay pocos coches, 
    // o 30% de salida si hay coches dentro.
    const hayCoches = data.filter(v => v.salida === null);

    if (rand > 0.4 || hayCoches.length === 0) {
        // ENTRADA DE VEHÍCULO
        const nuevo = {
            id: Date.now().toString(),
            marca: marcas[Math.floor(Math.random() * marcas.length)],
            placa: Math.random().toString(36).substring(2, 8).toUpperCase(),
            color: colores[Math.floor(Math.random() * colores.length)],
            entrada: new Date().toISOString(),
            salida: null,
            monto_pagar: null
        };
        data.push(nuevo);
        console.log(`🚗 Entrada: ${nuevo.marca} [${nuevo.placa}]`);
    } else {
        // SALIDA DE VEHÍCULO
        const index = data.findIndex(v => v.salida === null);
        if (index !== -1) {
            data[index].salida = new Date().toISOString();
            console.log(`🏁 Salida: ${data[index].placa}`);
        }
    }

    // Guardar y hacer Push
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
    
    try {
        await git.add('parking.json');
        await git.commit('Update parking state: ' + new Date().toLocaleTimeString());
        await git.push('origin', 'main');
        console.log('✅ GitHub actualizado');
    } catch (err) {
        console.error('❌ Error en Git:', err.message);
    }
}

// Ejecutar cada 2 minutos (120000 ms)
console.log('🤖 Bot de simulación iniciado...');
setInterval(simularMovimiento, 20000);