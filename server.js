const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para procesar JSON y servir archivos estáticos del frontend
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Detectar automáticamente ejecutable de OpenJDK local (Render) o del sistema
const localJavac = path.join(__dirname, 'jdk-17', 'bin', 'javac');
const localJava = path.join(__dirname, 'jdk-17', 'bin', 'java');

const JAVAC_CMD = fs.existsSync(localJavac) ? `"${localJavac}"` : 'javac';
const JAVA_CMD = fs.existsSync(localJava) ? `"${localJava}"` : 'java';

// Helper para limpiar directorios temporales
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
  const apiKey = process.env.GEMINI_API_KEY || '';

  if (!apiKey) {
    console.warn('GEMINI_API_KEY no se encuentra configurada en las variables de entorno.');
    return 'Nota: Configura la variable GEMINI_API_KEY en Render para recibir explicaciones automáticas con Inteligencia Artificial.';
  }

  const prompt = `
Eres un tutor pedagógico de Java.
El estudiante resolvió el ejercicio "${titulo}": ${descripcion}

Código del estudiante:
\`\`\`java
${codigo}
\`\`\`

Ocurrió un error en la fase de [${fase}]:
\`\`\`
${errorConsola}
\`\`\`

Instrucciones:
1. Analiza detenidamente el error generado por el compilador o la ejecución.
2. Explica qué significa el error de forma muy sencilla en 2 oraciones adaptadas a principiantes.
3. Si el error involucra condiciones en 'if' o incompatibilidad de tipos (ej. int a boolean), explícale claramente la diferencia entre evaluar un entero y usar una condición lógica (ej. num > 0).
4. Dale una pista concreta sobre cómo arreglarlo SIN darle el código con la solución completa.
5. Sé motivador.
`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Intentamos con gemini-1.5-flash
    let model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    let result = await model.generateContent(prompt);
    let response = await result.response;
    return response.text();
  } catch (err) {
    console.error('Error con gemini-1.5-flash, intentando modelo alternativo:', err.message);
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      let model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      let result = await model.generateContent(prompt);
      let response = await result.response;
      return response.text();
    } catch (err2) {
      console.error('Error al invocar Gemini API en todos los intentos:', err2.message);
      return `[Error al conectar con la IA: ${err2.message}] Revisa tu código en la línea señalada. Recuerda que en Java las condiciones dentro de un 'if' deben evaluar un valor booleano (true o false) y no un número entero.`;
    }
  }
}

// Helper para formatear casos de prueba (ya sean texto Java o JSON)
function construirInvocacionPruebas(nombreClase, testCodeRaw) {
  if (!testCodeRaw) {
    return `${nombreClase}.main(new String[]{});`;
  }

  const testTrim = testCodeRaw.trim();

  // Si es una cadena de prueba en formato JSON
  if (testTrim.startsWith('[') || testTrim.startsWith('{')) {
    try {
      const parsed = JSON.parse(testTrim);
      const listaCasos = Array.isArray(parsed) ? parsed : [parsed];
      
      return listaCasos.map(caso => {
        const params = Array.isArray(caso.entrada) 
          ? caso.entrada.map(p => typeof p === 'string' ? `"${p}"` : p).join(', ')
          : '';
        return `System.out.println(${nombreClase}.evaluar(${params}));`;
      }).join('\n            ');
    } catch (e) {
      // Si falla la conversión JSON, usar como llamada directa
    }
  }

  return testCodeRaw;
}

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
  const { id } = req.params;
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

  const query = 'SELECT * FROM ejercicios WHERE id = ?';
  db.get(query, [ejercicioId], async (err, ejercicio) => {
    if (err) {
      console.error('Error al consultar BD:', err);
      return res.status(500).json({ error: 'Error al consultar la base de datos' });
    }

    if (!ejercicio) {
      return res.status(404).json({ error: 'Ejercicio no encontrado' });
    }

    const tempDir = path.join(__dirname, `temp_${Date.now()}_${Math.floor(Math.random() * 1000)}`);

    try {
      fs.mkdirSync(tempDir, { recursive: true });

      // Detectar nombre de la clase pública del alumno (ej. "public class Solucion" -> "Solucion")
      const matchClase = codigoAlumno.match(/public\s+class\s+([A-Za-z0-9_]+)/);
      const nombreClaseAlumno = matchClase ? matchClase[1] : 'Solucion';

      // Normalizar el código si no tiene declaración de clase
      let codigoJavaAlumno = codigoAlumno;
      if (!matchClase) {
        codigoJavaAlumno = `public class ${nombreClaseAlumno} {\n${codigoAlumno}\n}`;
      }

      const testCodeRaw = ejercicio.codigo_prueba || ejercicio.casos_prueba || '';
      const invocacionPruebas = construirInvocacionPruebas(nombreClaseAlumno, testCodeRaw);
      const expectedOutput = (ejercicio.salida_esperada || '').trim();

      // Construcción del archivo principal envolvente
      const codigoCompleto = `
${codigoJavaAlumno}

class MainRunner {
    public static void main(String[] args) {
        try {
            ${invocacionPruebas}
        } catch (Exception e) {
            System.err.println("Excepción durante la ejecución: " + e.getMessage());
        }
    }
}
`;

      const javaFilePath = path.join(tempDir, `${nombreClaseAlumno}.java`);
      fs.writeFileSync(javaFilePath, codigoCompleto);

      // Compilación
      const compileCmd = `${JAVAC_CMD} -d "${tempDir}" "${javaFilePath}"`;

      exec(compileCmd, async (compileErr, stdoutComp, stderrComp) => {
        if (compileErr) {
          limpiarDirectorio(tempDir);
          const errorMsg = stderrComp || compileErr.message;
          
          const feedbackIA = await generarFeedbackIA(
            ejercicio.titulo || 'Ejercicio Java',
            ejercicio.descripcion || '',
            codigoAlumno,
            errorMsg,
            'Compilación'
          );

          return res.json({
            exito: false,
            tipoError: 'Error de Compilación',
            consola: errorMsg,
            feedbackIA
          });
        }

        // Ejecución
        const runCmd = `${JAVA_CMD} -cp "${tempDir}" MainRunner`;

        exec(runCmd, { timeout: 5000 }, async (runErr, stdoutRun, stderrRun) => {
          limpiarDirectorio(tempDir);

          if (runErr) {
            const errorMsg = stderrRun || runErr.message;
            const feedbackIA = await generarFeedbackIA(
              ejercicio.titulo || 'Ejercicio Java',
              ejercicio.descripcion || '',
              codigoAlumno,
              errorMsg,
              'Ejecución'
            );

            return res.json({
              exito: false,
              tipoError: 'Error de Ejecución',
              consola: errorMsg,
              feedbackIA
            });
          }

          const salidaLimpia = stdoutRun.trim();

          // Validación de salida esperada
          if (expectedOutput && !salidaLimpia.includes(expectedOutput) && salidaLimpia !== 'OK') {
            const feedbackIA = await generarFeedbackIA(
              ejercicio.titulo || 'Ejercicio Java',
              ejercicio.descripcion || '',
              codigoAlumno,
              `Salida obtenida: "${salidaLimpia}". Se esperaba: "${expectedOutput}"`,
              'Resultado Incorrecto'
            );

            return res.json({
              exito: false,
              tipoError: 'Resultado Incorrecto',
              consola: `Salida recibida:\n${salidaLimpia}\n\nSalida esperada:\n${expectedOutput}`,
              feedbackIA
            });
          }

          // Respuesta Exitosa
          return res.json({
            exito: true,
            mensaje: '¡Excelente! Tu solución ha pasado todas las pruebas correctamente.',
            consola: salidaLimpia
          });
        });
      });

    } catch (e) {
      console.error('Error en el proceso de evaluación:', e);
      limpiarDirectorio(tempDir);
      return res.status(500).json({ error: 'Error interno en la preparación del archivo Java: ' + e.message });
    }
  });
});

// Iniciar servidor Express
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});