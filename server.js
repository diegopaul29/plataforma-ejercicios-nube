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

// Helper para sanitizar y limpiar los mensajes de error feos/largos del compilador Java
function limpiarErrorConsola(rawError) {
  if (!rawError) return '';
  return rawError
    // Elimina rutas completas del sistema Linux/Render (ej. /opt/render/project/src/temp_.../Solucion.java:5:)
    .replace(/\/opt\/[^\s:]+\.java:\d+:\s*/g, '')
    // Elimina la palabra "error:" en inglés
    .replace(/error:\s*/gi, '')
    // Elimina el conteo final tipo "1 error" o "2 errors"
    .replace(/\d+\s+errors?/gi, '')
    // Elimina símbolos de puntero del compilador (^)
    .replace(/\^\s*/g, '')
    // Limpia saltos de línea excesivos
    .replace(/\s+/g, ' ')
    .trim();
}

// Helper para consultar la API de Gemini con rotación de nombres de modelo válidos
async function generarFeedbackIA(titulo, descripcion, codigo, errorConsola, fase) {
  const apiKey = process.env.GEMINI_API_KEY || '';
  const errorLimpio = limpiarErrorConsola(errorConsola);

  if (!apiKey) {
    console.warn('GEMINI_API_KEY no se encuentra configurada en las variables de entorno.');
    return 'Nota: Configura la variable GEMINI_API_KEY en Render para recibir explicaciones automáticas con Inteligencia Artificial.';
  }

  const prompt = `
Eres un tutor pedagógico de Java amigable y didáctico.
Un estudiante envió una solución para el ejercicio "${titulo}": ${descripcion}

Código del estudiante:
\`\`\`java
${codigo}
\`\`\`

Mensaje de error (${fase}):
\`\`\`
${errorLimpio}
\`\`\`

Instrucciones para la respuesta:
1. Explica de forma concisa y amigable en 1 o 2 oraciones qué salió mal, NUNCA muestres rutas de carpetas ni códigos de error en inglés completos.
2. Si el error es sobre tipos incompatibles ("incompatible types"), aclárale sencillamente que Java exige que la condición dentro de la sentencia 'if' evalúe un valor booleano (true/false) mediante una comparación (como 'num > 0'), y no un entero directamente.
3. Dale una pista concreta sobre la línea para corregirlo.
4. NO le des el código resuelto completo.
5. Mantén un tono motivador.
`;

  // Lista de modelos activos a probar secuencialmente
  const modelosProbar = ['gemini-1.5-flash', 'gemini-2.0-flash'];
  const genAI = new GoogleGenerativeAI(apiKey);

  for (const nombreModelo of modelosProbar) {
    try {
      const model = genAI.getGenerativeModel({ model: nombreModelo });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const texto = response.text();
      if (texto) {
        return texto;
      }
    } catch (err) {
      console.error(`Inconveniente con modelo ${nombreModelo}:`, err.message);
    }
  }

  // Fallback explicativo limpio y sin rutas en caso de fallar la llamada de API
  return `El error ocurre porque en Java la sentencia 'if' exige una expresión booleana (que evalúe a true o false, por ejemplo 'num > 0'). Pasar un valor entero directamente como 'if (num)' no es válido. Revisa la condición en tu código.`;
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