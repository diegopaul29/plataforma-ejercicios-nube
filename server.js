const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
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

// Limpia las rutas internas del servidor Render (/opt/render/...) para mostrar sólo la línea y el error
function limpiarRutasServidor(rawError) {
  if (!rawError) return '';
  return rawError.replace(/\/opt\/[^\s:]+\/Solucion\.java:/g, 'Línea ');
}

// Helper para consultar la API de Gemini vía HTTP FETCH directo (Sin SDK)
async function generarFeedbackIA(titulo, descripcion, codigo, errorConsola, fase) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  const errorLimpio = limpiarRutasServidor(errorConsola);

  if (!apiKey) {
    console.warn('GEMINI_API_KEY no encontrada en las variables de entorno.');
    return 'Nota: Configura la variable GEMINI_API_KEY en Render para recibir explicaciones automáticas con IA.';
  }

  const promptText = `
Eres un tutor pedagógico de programación en Java amigable y preciso.
Un estudiante está resolviendo el siguiente ejercicio:

Título: "${titulo}"
Descripción: ${descripcion}

Código del estudiante:
\`\`\`java
${codigo}
\`\`\`

Mensaje de error exacto del compilador/ejecutor en la fase de [${fase}]:
\`\`\`
${errorLimpio}
\`\`\`

Instrucciones:
1. Lee el código del estudiante y el error de compilación.
2. Explica de forma concisa y sencilla (máximo 2 oraciones) QUÉ está mal en la línea señalada (por ejemplo: falta un punto y coma, falta indicar un valor de retorno, la sintaxis del return está incompleta, etc.).
3. Proporciona una pista clara para corregirlo SIN darle el código completo resuelto.
4. Mantén un tono alentador.
`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: promptText }]
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Error devuelto por la API de Google Gemini:', JSON.stringify(data));
      return `Error en la API de Google (${response.status}): ${data.error?.message || 'Verifica la clave GEMINI_API_KEY en Render.'}`;
    }

    const respuestaTexto = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (respuestaTexto) {
      return respuestaTexto;
    }

    return 'No se obtuvo respuesta del modelo. Revisa el mensaje en la consola de Java.';
  } catch (err) {
    console.error('Error al realizar la petición HTTP a Gemini:', err.message);
    return `Ocurrió un error al conectar con la IA (${err.message}). Revisa el mensaje de compilación en la consola.`;
  }
}

// Helper para formatear casos de prueba
function construirInvocacionPruebas(nombreClase, testCodeRaw) {
  if (!testCodeRaw) {
    return `${nombreClase}.main(new String[]{});`;
  }

  const testTrim = testCodeRaw.trim();

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

      const matchClase = codigoAlumno.match(/public\s+class\s+([A-Za-z0-9_]+)/);
      const nombreClaseAlumno = matchClase ? matchClase[1] : 'Solucion';

      let codigoJavaAlumno = codigoAlumno;
      if (!matchClase) {
        codigoJavaAlumno = `public class ${nombreClaseAlumno} {\n${codigoAlumno}\n}`;
      }

      const testCodeRaw = ejercicio.codigo_prueba || ejercicio.casos_prueba || '';
      const invocacionPruebas = construirInvocacionPruebas(nombreClaseAlumno, testCodeRaw);
      const expectedOutput = (ejercicio.salida_esperada || '').trim();

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
            consola: limpiarRutasServidor(errorMsg),
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
              consola: limpiarRutasServidor(errorMsg),
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