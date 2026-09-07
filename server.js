const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Middleware para procesar JSON y servir la carpeta estática del frontend
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Detectar automáticamente si existe OpenJDK local (Render) o del sistema
const localJavac = path.join(__dirname, 'jdk-17', 'bin', 'javac');
const localJava = path.join(__dirname, 'jdk-17', 'bin', 'java');

const JAVAC_CMD = fs.existsSync(localJavac) ? `"${localJavac}"` : 'javac';
const JAVA_CMD = fs.existsSync(localJava) ? `"${localJava}"` : 'java';

// -------------------------------------------------------------
// RUTAS DE LA API
// -------------------------------------------------------------

// 1. Obtener la lista completa de ejercicios
app.get('/api/ejercicios', (req, res) => {
  const query = 'SELECT id, titulo, dificultad, categoria FROM ejercicios ORDER BY id ASC';
  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Error al consultar la base de datos' });
    }
    res.json(rows);
  });
});

// 2. Obtener un ejercicio específico por su ID
app.get('/api/ejercicios/:id', (req, res) => {
  const { id } = req.request ? req.request.params : req.params;
  const query = 'SELECT * FROM ejercicios WHERE id = ?';
  db.get(query, [id], (err, row) => {
    if (err || !row) {
      return res.status(404).json({ error: 'Ejercicio no encontrado' });
    }
    res.json(row);
  });
});

// 3. Evaluar el código enviado por el estudiante
app.post('/api/evaluar', (req, res) => {
  const { ejercicioId, codigoAlumno } = req.body;

  if (!ejercicioId || !codigoAlumno) {
    return res.status(400).json({ error: 'Faltan datos requeridos (ejercicioId o codigoAlumno)' });
  }

  // Obtener el ejercicio de la base de datos para comparar pruebas
  const query = 'SELECT * FROM ejercicios WHERE id = ?';
  db.get(query, [ejercicioId], async (err, ejercicio) => {
    if (err || !ejercicio) {
      return res.status(404).json({ error: 'Ejercicio no encontrado' });
    }

    // Crear directorio temporal único para la compilación y ejecución
    const tempDir = path.join(__dirname, `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const javaFilePath = path.join(tempDir, 'Solucion.java');
    
    // Crear el código Java envolvente que invoca las pruebas
    const codigoCompleto = `
${codigoAlumno}

public class Main {
    public static void main(String[] args) {
        try {
            ${ejercicio.codigo_prueba || ''}
        } catch (Exception e) {
            System.err.println("Excepción durante la ejecución: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
`;

    fs.writeFileSync(javaFilePath, codigoCompleto);

    // Compilar el archivo Java
    const compileCmd = `${JAVAC_CMD} -d "${tempDir}" "${javaFilePath}"`;

    exec(compileCmd, async (compileErr, stdoutComp, stderrComp) => {
      if (compileErr) {
        // Limpiar archivos temporales
        limpiarDirectorio(tempDir);

        const feedbackIA = await generarFeedbackIA(
          ejercicio.titulo,
          ejercicio.descripcion,
          codigoAlumno,
          stderrComp,
          'Compilación'
        );

        return res.json({
          exito: false,
          tipoError: 'Error de Compilación',
          consola: stderrComp || compileErr.message,
          feedbackIA
        });
      }

      // Ejecutar el código compilado
      const runCmd = `${JAVA_CMD} -cp "${tempDir}" Main`;

      exec(runCmd, { timeout: 5000 }, async (runErr, stdoutRun, stderrRun) => {
        // Limpiar archivos temporales
        limpiarDirectorio(tempDir);

        if (runErr) {
          const mensajeError = stderrRun || runErr.message;
          const feedbackIA = await generarFeedbackIA(
            ejercicio.titulo,
            ejercicio.descripcion,
            codigoAlumno,
            mensajeError,
            'Ejecución'
          );

          return res.json({
            exito: false,
            tipoError: 'Error de Ejecución / Timeout',
            consola: mensajeError,
            feedbackIA
          });
        }

        // Si la prueba imprime "OK" o coincide con la salida esperada
        const salidaLimpia = stdoutRun.trim();
        const salidaEsperada = (ejercicio.salida_esperada || '').trim();

        if (salidaEsperada && !salidaLimpia.includes(salidaEsperada) && salidaLimpia !== 'OK') {
          const feedbackIA = await generarFeedbackIA(
            ejercicio.titulo,
            ejercicio.descripcion,
            codigoAlumno,
            `Salida obtenida: "${salidaLimpia}". Se esperaba: "${salidaEsperada}"`,
            'Lógica / Resultado Incorrecto'
          );

          return res.json({
            exito: false,
            tipoError: 'Resultado Incorrecto',
            consola: `Salida recibida:\n${salidaLimpia}\n\nSalida esperada:\n${salidaEsperada}`,
            feedbackIA
          });
        }

        // Si todo pasa exitosamente
        res.json({
          exito: true,
          mensaje: '¡Excelente! Tu solución ha pasado todas las pruebas correctamente.',
          consola: salidaLimpia
        });
      });
    });
  });
});

// Helper para limpiar carpetas temporales
function limpiarDirectorio(dirPath) {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch (e) {
    console.error(`Error al borrar ${dirPath}:`, e.message);
  }
}

// Helper para consultar la API de Gemini
async function generarFeedbackIA(titulo, descripcion, codigo, errorConsola, fase) {
  if (!process.env.GEMINI_API_KEY) {
    return 'Nota: Configura la variable GEMINI_API_KEY en Render para recibir explicaciones automáticas con Inteligencia Artificial.';
  }

  const prompt = `
Eres un tutor de programación en Java pedagógico, claro y alentador.
El estudiante está intentando resolver el siguiente ejercicio:
- Título: ${titulo}
- Descripción: ${descripcion}

El estudiante escribió este código:
\`\`\`java
${codigo}
\`\`\`

Ocurrió un error en la fase de [${fase}]:
\`\`\`
${errorConsola}
\`\`\`

Instrucciones:
1. Explica qué significa el error de forma sencilla en 2 o 3 oraciones.
2. Dale una pista concreta sobre cómo arreglarlo SIN darle la solución en código completa directamente.
3. Mantén un tono motivador.
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (err) {
    console.error('Error al invocar Gemini API:', err.message);
    return 'No se pudo generar la sugerencia de la IA en este momento. Revisa el mensaje de la consola para más detalles.';
  }
}

// Iniciar servidor Express
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});