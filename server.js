import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { pool } from './database.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Inicializar la API de Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --------------------------------------------------------------------------
// 1. Obtener la lista de los 30 ejercicios
// --------------------------------------------------------------------------
app.get('/api/ejercicios', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, titulo, dificultad FROM ejercicios ORDER BY id ASC;');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener los ejercicios' });
  }
});

// --------------------------------------------------------------------------
// 2. Obtener un ejercicio específico por ID
// --------------------------------------------------------------------------
app.get('/api/ejercicios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM ejercicios WHERE id = $1;', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ejercicio no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener el ejercicio' });
  }
});

// --------------------------------------------------------------------------
// 3. Evaluar el código Java del estudiante
// --------------------------------------------------------------------------
app.post('/api/evaluar', async (req, res) => {
  const { ejercicioId, codigoAlumno } = req.body;

  try {
    // Buscar el ejercicio y sus casos de prueba en la base de datos
    const dbRes = await pool.query('SELECT * FROM ejercicios WHERE id = $1;', [ejercicioId]);
    if (dbRes.rows.length === 0) {
      return res.status(404).json({ error: 'Ejercicio no encontrado' });
    }
    const ejercicio = dbRes.rows[0];
    const casosPrueba = JSON.parse(ejercicio.casos_prueba);

    // Preparar directorio temporal para la compilación de Java
    const tempDir = path.join(process.cwd(), 'temp_' + Date.now());
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    // Construir la clase Wrapper para ejecutar el método del alumno
    const javaCode = `
import java.util.*;

${codigoAlumno}

public class Main {
    public static void main(String[] args) {
        if (args.length == 0) return;
        
        // El primer argumento determina qué caso de prueba se evalúa
        int caso = Integer.parseInt(args[0]);
        
        try {
            switch(caso) {
                ${casosPrueba.map((c, index) => {
                  const argsFormatted = c.entrada.map(arg => typeof arg === 'string' ? `"${arg}"` : arg).join(', ');
                  return `case ${index}:
                            System.out.print(Solucion.evaluar(${argsFormatted}));
                            break;`;
                }).join('\n')}
            }
        } catch (Exception e) {
            System.err.print("Error de ejecucion: " + e.getMessage());
            System.exit(1);
        }
    }
}
`;

    fs.writeFileSync(path.join(tempDir, 'Solucion.java'), codigoAlumno);
    fs.writeFileSync(path.join(tempDir, 'Main.java'), javaCode);

    // Compilar el código Java
    exec(`javac ${path.join(tempDir, 'Main.java')} ${path.join(tempDir, 'Solucion.java')}`, async (compileErr, stdout, stderr) => {
      if (compileErr) {
        // Limpiar archivos temporales
        fs.rmSync(tempDir, { recursive: true, force: true });

        // Enviar error de compilación a Gemini
        const feedback = await obtenerFeedbackIA(ejercicio, codigoAlumno, stderr, 'Error de Compilación (Sintaxis Java)');
        return res.json({ exito: false, tipoError: 'compilacion', consola: stderr, feedbackIA: feedback });
      }

      // Probar los casos de prueba uno por uno
      let pruebasExitosas = 0;
      let detalleErrores = [];

      for (let i = 0; i < casosPrueba.length; i++) {
        const caso = casosPrueba[i];
        
        const salidaObtenida = await new Promise((resolve) => {
          exec(`java -cp ${tempDir} Main ${i}`, (execErr, stdoutExec, stderrExec) => {
            if (execErr) {
              resolve({ error: stderrExec || execErr.message });
            } else {
              resolve({ resultado: stdoutExec.trim() });
            }
          });
        });

        if (salidaObtenida.error) {
          detalleErrores.push(`Caso ${i + 1}: Error de ejecución -> ${salidaObtenida.error}`);
          break;
        } else if (String(salidaObtenida.resultado) === String(caso.salida)) {
          pruebasExitosas++;
        } else {
          detalleErrores.push(`Caso ${i + 1}: Para entrada (${caso.entrada.join(', ')}), se esperaba "${caso.salida}" pero se obtuvo "${salidaObtenida.resultado}".`);
          break;
        }
      }

      // Limpiar directorio temporal después de probar
      fs.rmSync(tempDir, { recursive: true, force: true });

      // Verificar si pasó todas las pruebas
      if (pruebasExitosas === casosPrueba.length) {
        return res.json({
          exito: true,
          mensaje: '¡Excelente trabajo! Has superado todos los casos de prueba correctamente.'
        });
      } else {
        const mensajeError = detalleErrores.join('\n');
        const feedback = await obtenerFeedbackIA(ejercicio, codigoAlumno, mensajeError, 'Casos de prueba no superados');
        return res.json({
          exito: false,
          tipoError: 'logica',
          consola: mensajeError,
          feedbackIA: feedback
        });
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno del servidor al evaluar el código' });
  }
});

// --------------------------------------------------------------------------
// 4. Generación de retroalimentación pedagógica con Gemini
// --------------------------------------------------------------------------
async function obtenerFeedbackIA(ejercicio, codigoAlumno, errorObtenido, tipoFallo) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
Eres un tutor universitario de programación interactivo y amable en un curso de Fundamentos de Programación en Java.
Un estudiante intentó resolver el siguiente ejercicio:

**Ejercicio:** ${ejercicio.titulo}
**Descripción:** ${ejercicio.descripcion}
**Dificultad:** ${ejercicio.dificultad}

**Código escrito por el estudiante (Java):**
\`\`\`java
${codigoAlumno}
\`\`\`

**Tipo de problema detectado:** ${tipoFallo}
**Detalle del error / salida del compilador:**
${errorObtenido}

**Instrucciones para la respuesta:**
1. Identifica la línea específica o bloque del código donde está el problema.
2. Explica brevemente por qué ocurre el error según la sintaxis de Java o la lógica de las sentencias condicionales (if, if-else, if-else-if, switch).
3. Dale una pista o sugerencia concreta sobre cómo corregirlo, pero **NO le des el código de la solución completa**. Guíalo para que descubra el error por sí mismo.
4. Usa un tono motivador, conciso y cercano.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (err) {
    console.error('Error llamando a Gemini API:', err);
    return 'No se pudo generar la retroalimentación automática en este momento. Revisa la sintaxis de tu código o la salida en consola.';
  }
}

// --------------------------------------------------------------------------
// Iniciar el servidor
// --------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor de evaluación Java ejecutándose en el puerto ${PORT}`);
});