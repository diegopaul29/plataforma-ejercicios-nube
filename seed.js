import { pool } from './database.js';

const ejercicios = [
  // --------------------------------------------------------------------------
  // BLOQUE 1: Sentencia IF simple (Ejercicios 1 - 7)
  // Objetivo: Evaluar condiciones verdaderas de forma directa.
  // --------------------------------------------------------------------------
  {
    titulo: '1. Validar Número Positivo (if)',
    descripcion: 'Escribe el método `evaluar(int num)`. Utiliza una sentencia `if` para retornar "Es positivo" solo si `num` es mayor que 0. En caso contrario, retorna "Sin estado".',
    dificultad: 'Fácil',
    plantilla_codigo: 'public class Solucion {\n    public static String evaluar(int num) {\n        // Usa sentencia if aquí\n        return "Sin estado";\n    }\n}',
    casos_prueba: [{ entrada: [5], salida: 'Es positivo' }, { entrada: [-2], salida: 'Sin estado' }]
  },
  {
    titulo: '2. Verificación de Descuento (if)',
    descripcion: 'Escribe el método `evaluar(double monto)`. Si el `monto` es mayor o igual a 100.0, aplica un 10% de descuento y retorna el nuevo total como String. Si no, retorna el monto original como String.',
    dificultad: 'Fácil',
    plantilla_codigo: 'public class Solucion {\n    public static String evaluar(double monto) {\n        // Tu código aquí\n        return String.valueOf(monto);\n    }\n}',
    casos_prueba: [{ entrada: [120.0], salida: '108.0' }, { entrada: [80.0], salida: '80.0' }]
  },
  {
    titulo: '3. Alerta de Temperatura Alta (if)',
    descripcion: 'Escribe el método `evaluar(int temp)`. Si la temperatura supera los 35 grados, retorna "Alerta de calor". Si no, retorna "Temperatura ok".',
    dificultad: 'Fácil',
    plantilla_codigo: 'public class Solucion {\n    public static String evaluar(int temp) {\n        // Tu código aquí\n        return "Temperatura ok";\n    }\n}',
    casos_prueba: [{ entrada: [38], salida: 'Alerta de calor' }, { entrada: [22], salida: 'Temperatura ok' }]
  },
  {
    titulo: '4. Validar Longitud de Texto (if)',
    descripcion: 'Escribe el método `evaluar(String texto)`. Si el texto tiene más de 10 caracteres (usando `.length()`), retorna "Texto largo". De lo contrario, retorna "Texto corto".',
    dificultad: 'Fácil',
    plantilla_codigo: 'public class Solucion {\n    public static String evaluar(String texto) {\n        // Usa texto.length()\n        return "Texto corto";\n    }\n}',
    casos_prueba: [{ entrada: ['Programacion'], salida: 'Texto largo' }, { entrada: ['Hola'], salida: 'Texto corto' }]
  },
  {
    titulo: '5. Recargo por Pago Tardío (if)',
    descripcion: 'Escribe el método `evaluar(int monto, int diasRetraso)`. Si `diasRetraso` es mayor a 0, suma 5 al monto. Retorna el resultado como String.',
    dificultad: 'Fácil',
    plantilla_codigo: 'public class Solucion {\n    public static String evaluar(int monto, int diasRetraso) {\n        // Tu código aquí\n        return String.valueOf(monto);\n    }\n}',
    casos_prueba: [{ entrada: [50, 3], salida: '55' }, { entrada: [50, 0], salida: '50' }]
  },
  {
    titulo: '6. Control de Aforo (if)',
    descripcion: 'Escribe el método `evaluar(int personas)`. Si `personas` excede el límite de 50, retorna "Aforo alcanzado". En caso contrario, retorna "Espacio disponible".',
    dificultad: 'Fácil',
    plantilla_codigo: 'public class Solucion {\n    public static String evaluar(int personas) {\n        // Tu código aquí\n        return "Espacio disponible";\n    }\n}',
    casos_prueba: [{ entrada: [55], salida: 'Aforo alcanzado' }, { entrada: [30], salida: 'Espacio disponible' }]
  },
  {
    titulo: '7. Verificación de Batería (if)',
    descripcion: 'Escribe el método `evaluar(int porcentaje)`. Si la batería es menor o igual a 15, retorna "Activar ahorro". Sino, retorna "Bateria normal".',
    dificultad: 'Fácil',
    plantilla_codigo: 'public class Solucion {\n    public static String evaluar(int porcentaje) {\n        // Tu código aquí\n        return "Bateria normal";\n    }\n}',
    casos_prueba: [{ entrada: [10], salida: 'Activar ahorro' }, { entrada: [80], salida: 'Bateria normal' }]
  },

  // --------------------------------------------------------------------------
  // BLOQUE 2: Sentencia IF-ELSE (Ejercicios 8 - 15)
  // Objetivo: Tomar decisiones binarias (camino verdadero vs falso).
  // --------------------------------------------------------------------------
  {
    titulo: '8. Mayoría de Edad (if-else)',
    descripcion: 'Escribe el método `evaluar(int edad)`. Aplica `if-else` para retornar "Mayor de edad" si la edad es >= 18, o "Menor de edad" en caso contrario.',
    dificultad: 'Fácil',
    plantilla_codigo: 'public class Solucion {\n    public static String evaluar(int edad) {\n        // Usa if-else\n        return "";\n    }\n}',
    casos_prueba: [{ entrada: [18], salida: 'Mayor de edad' }, { entrada: [15], salida: 'Menor de edad' }]
  },
  {
    titulo: '9. Determinar Par o Impar (if-else)',
    descripcion: 'Escribe el método `evaluar(int num)`. Aplica `if-else` con el operador módulo `%` para retornar "Par" o "Impar".',
    dificultad: 'Fácil',
    plantilla_codigo: 'public class Solucion {\n    public static String evaluar(int num) {\n        // Usa if-else y num % 2\n        return "";\n    }\n}',
    casos_prueba: [{ entrada: [8], salida: 'Par' }, { entrada: [11], salida: 'Impar' }]
  },
  {
    titulo: '10. Aprobado o Reprobado (if-else)',
    descripcion: 'Escribe el método `evaluar(double nota)`. Usa `if-else` para retornar "Aprobado" si la nota es >= 7.0, o "Reprobado" si es menor.',
    dificultad: 'Fácil',
    plantilla_codigo: 'public class Solucion {\n    public static String evaluar(double nota) {\n        // Tu código aquí\n        return "";\n    }\n}',
    casos_prueba: [{ entrada: [7.5], salida: 'Aprobado' }, { entrada: [4.0], salida: 'Reprobado' }]
  },
  {
    titulo: '11. Acceso a Sistema (if-else)',
    descripcion: 'Escribe el método `evaluar(String pass)`. Si `pass.equals("admin123")` retorna "Acceso concedido", de lo contrario "Clave incorrecta".',
    dificultad: 'Fácil',
    plantilla_codigo: 'public class Solucion {\n    public static String evaluar(String pass) {\n        // Usa .equals() para comparar cadenas en Java\n        return "";\n    }\n}',
    casos_prueba: [{ entrada: ['admin123'], salida: 'Acceso concedido' }, { entrada: ['1234'], salida: 'Clave incorrecta' }]
  },
  {
    titulo: '12. Signo de un Número (if-else)',
    descripcion: 'Escribe el método `evaluar(int num)`. Si `num` es mayor o igual a 0, retorna "No negativo", de lo contrario "Negativo".',
    dificultad: 'Fácil',
    plantilla_codigo: 'public class Solucion {\n    public static String evaluar(int num) {\n        // Tu código aquí\n        return "";\n    }\n}',
    casos_prueba: [{ entrada: [0], salida: 'No negativo' }, { entrada: [-5], salida: 'Negativo' }]
  },
  {
    titulo: '13. Asistencia Mínima (if-else)',
    descripcion: 'Escribe el método `evaluar(int porcentajeAsistencia)`. Retorna "Apto para examen" si es >= 75, de lo contrario "Inhabilitado".',
    dificultad: 'Fácil',
    plantilla_codigo: 'public class Solucion {\n    public static String evaluar(int porcentajeAsistencia) {\n        // Tu código aquí\n        return "";\n    }\n}',
    casos_prueba: [{ entrada: [80], salida: 'Apto para examen' }, { entrada: [60], salida: 'Inhabilitado' }]
  },
  {
    titulo: '14. Múltiplo de 3 (if-else)',
    descripcion: 'Escribe el método `evaluar(int num)`. Retorna "Es múltiplo de 3" o "No es múltiplo de 3".',
    dificultad: 'Fácil',
    plantilla_codigo: 'public class Solucion {\n    public static String evaluar(int num) {\n        // Tu código aquí\n        return "";\n    }\n}',
    casos_prueba: [{ entrada: [9], salida: 'Es múltiplo de 3' }, { entrada: [10], salida: 'No es múltiplo de 3' }]
  },
  {
    titulo: '15. Comparar Dos Números (if-else)',
    descripcion: 'Escribe el método `evaluar(int a, int b)`. Retorna "El primero es mayor" si a > b, de lo contrario "El segundo es mayor o igual".',
    dificultad: 'Fácil',
    plantilla_codigo: 'public class Solucion {\n    public static String evaluar(int a, int b) {\n        // Tu código aquí\n        return "";\n    }\n}',
    casos_prueba: [{ entrada: [10, 2], salida: 'El primero es mayor' }, { entrada: [3, 3], salida: 'El segundo es mayor o igual' }]
  },

  // --------------------------------------------------------------------------
  // BLOQUE 3: Sentencia IF-ELSE-IF (Ejercicios 16 - 23)
  // Objetivo: Evaluar múltiples condiciones encadenadas y rangos.
  // --------------------------------------------------------------------------
  {
    titulo: '16. Clasificación de Números (if-else-if)',
    descripcion: 'Escribe el método `evaluar(int num)`. Usa `if-else-if` para retornar "Positivo" (si > 0), "Negativo" (si < 0) o "Cero" (si == 0).',
    dificultad: 'Medio',
    plantilla_codigo: 'public class Solucion {\n    public static String evaluar(int num) {\n        // Usa if - else if - else\n        return "";\n    }\n}',
    casos_prueba: [{ entrada: [10], salida: 'Positivo' }, { entrada: [-4], salida: 'Negativo' }, { entrada: [0], salida: 'Cero' }]
  },
  {
    titulo: '17. Rangos de Edad (if-else-if)',
    descripcion: 'Escribe el método `evaluar(int edad)`. Menor de 12: "Niño", de 12 a 17: "Adolescente", de 18 a 64: "Adulto", 65 o más: "Adulto Mayor".',
    dificultad: 'Medio',
    plantilla_codigo: 'public class Solucion {\n    public static String evaluar(int edad) {\n        // Usa estructuras encadenadas if - else if\n        return "";\n    }\n}',
    casos_prueba: [{ entrada: [10], salida: 'Niño' }, { entrada: [15], salida: 'Adolescente' }, { entrada: [30], salida: 'Adulto' }, { entrada: [70], salida: 'Adulto Mayor' }]
  },
  {
    titulo: '18. Escala de Calificaciones (if-else-if)',
    descripcion: 'Escribe el método `evaluar(int nota)`. 90-100: "Excelente", 80-89: "Bueno", 70-79: "Regular", menor a 70: "Deficiente".',
    dificultad: 'Medio',
    plantilla_codigo: 'public class Solucion {\n    public static String evaluar(int nota) {\n        // Tu código aquí\n        return "";\n    }\n}',
    casos_prueba: [{ entrada: [95], salida: 'Excelente' }, { entrada: [85], salida: 'Bueno' }, { entrada: [60], salida: 'Deficiente' }]
  },
  {
    titulo: '19. Tipos de Triángulos (if-else-if)',
    descripcion: 'Escribe el método `evaluar(int l1, int l2, int l3)`. Retorna "Equilátero" (3 lados iguales), "Isósceles" (2 iguales) o "Escaleno" (todos diferentes).',
    dificultad: 'Medio',
    plantilla_codigo: 'public class Solucion {\n    public static String evaluar(int l1, int l2, int l3) {\n        // Tu código aquí\n        return "";\n    }\n}',
    casos_prueba: [{ entrada: [5, 5, 5], salida: 'Equilátero' }, { entrada: [5, 5, 2], salida: 'Isósceles' }, { entrada: [3, 4, 5], salida: 'Escaleno' }]
  },
  {
    titulo: '20. Índice de Masa Corporal - IMC (if-else-if)',
    descripcion: 'Escribe el método `evaluar(double imc)`. imc < 18.5: "Bajo peso", 18.5 a 24.9: "Normal", 25 a 29.9: "Sobrepeso", 30 o más: "Obesidad".',
    dificultad: 'Medio',
    plantilla_codigo: 'public class Solucion {\n    public static String evaluar(double imc) {\n        // Tu código aquí\n        return "";\n    }\n}',
    casos_prueba: [{ entrada: [17.5], salida: 'Bajo peso' }, { entrada: [22.0], salida: 'Normal' }, { entrada: [32.0], salida: 'Obesidad' }]
  },
  {
    titulo: '21. Control de Semáforo Lógico (if-else-if)',
    descripcion: 'Escribe el método `evaluar(String color)`. Si color es "verde" -> "Avanzar", "amarillo" -> "Precaución", "rojo" -> "Detenerse". Cualquier otro -> "Color inválido". Usa `.equals()`.',
    dificultad: 'Medio',
    plantilla_codigo: 'public class Solucion {\n    public static String evaluar(String color) {\n        // Tu código aquí\n        return "";\n    }\n}',
    casos_prueba: [{ entrada: ['verde'], salida: 'Avanzar' }, { entrada: ['rojo'], salida: 'Detenerse' }, { entrada: ['azul'], salida: 'Color inválido' }]
  },
  {
    titulo: '22. Calculadora de Envío por Peso (if-else-if)',
    descripcion: 'Escribe el método `evaluar(double peso)`. Hasta 5.0kg: tarifa "5", de 5.1 a 10.0kg: "10", de 10.1 a 20.0kg: "20", más de 20.0kg: "No permitido".',
    dificultad: 'Medio',
    plantilla_codigo: 'public class Solucion {\n    public static String evaluar(double peso) {\n        // Tu código aquí\n        return "";\n    }\n}',
    casos_prueba: [{ entrada: [3.0], salida: '5' }, { entrada: [8.0], salida: '10' }, { entrada: [25.0], salida: 'No permitido' }]
  },
  {
    titulo: '23. Tramo Impositivo (if-else-if)',
    descripcion: 'Escribe el método `evaluar(double ingreso)`. Hasta 1000: "0%", de 1001 a 3000: "10%", de 3001 a 5000: "15%", más de 5000: "20%".',
    dificultad: 'Medio',
    plantilla_codigo: 'public class Solucion {\n    public static String evaluar(double ingreso) {\n        // Tu código aquí\n        return "";\n    }\n}',
    casos_prueba: [{ entrada: [500.0], salida: '0%' }, { entrada: [2000.0], salida: '10%' }, { entrada: [6000.0], salida: '20%' }]
  },

  // --------------------------------------------------------------------------
  // BLOQUE 4: Sentencia SWITCH (Ejercicios 24 - 30)
  // Objetivo: Selección múltiple estructurada mediante casos discretos en Java.
  // --------------------------------------------------------------------------
  {
    titulo: '24. Días de la Semana (switch)',
    descripcion: 'Escribe el método `evaluar(int dia)`. Usa la sentencia `switch` para retornar "Lunes", "Martes", ..., "Domingo" según los valores 1 a 7. Si es otro número retorna "Día no válido".',
    dificultad: 'Avanzado',
    plantilla_codigo: 'public class Solucion {\n    public static String evaluar(int dia) {\n        // Usa switch(dia) { case 1: ... }\n        return "";\n    }\n}',
    casos_prueba: [{ entrada: [1], salida: 'Lunes' }, { entrada: [5], salida: 'Viernes' }, { entrada: [9], salida: 'Día no válido' }]
  },
  {
    titulo: '25. Nombre del Mes (switch)',
    descripcion: 'Escribe el método `evaluar(int mes)`. Usa `switch` para retornar el nombre del mes ("Enero", "Febrero", etc.) de 1 a 12. Si no está en el rango retorna "Mes inválido".',
    dificultad: 'Avanzado',
    plantilla_codigo: 'public class Solucion {\n    public static String evaluar(int mes) {\n        // Usa switch\n        return "";\n    }\n}',
    casos_prueba: [{ entrada: [3], salida: 'Marzo' }, { entrada: [12], salida: 'Diciembre' }, { entrada: [0], salida: 'Mes inválido' }]
  },
  {
    titulo: '26. Operaciones Matemáticas Básicas (switch)',
    descripcion: 'Escribe el método `evaluar(int a, int b, String operador)`. Usa `switch(operador)` para los casos "+", "-", "*", "/". Retorna el resultado como String. Si el operador no coincide, retorna "Operador no soportado".',
    dificultad: 'Avanzado',
    plantilla_codigo: 'public class Solucion {\n    public static String evaluar(int a, int b, String operador) {\n        // Usa switch(operador)\n        return "";\n    }\n}',
    casos_prueba: [{ entrada: [10, 5, '+'], salida: '15' }, { entrada: [4, 2, '*'], salida: '8' }, { entrada: [5, 2, '%'], salida: 'Operador no soportado' }]
  },
  {
    titulo: '27. Tipo de Vehículo por Código (switch)',
    descripcion: 'Escribe el método `evaluar(String codigo)`. "A" -> "Motocicleta", "B" -> "Automóvil", "C" -> "Camión". default -> "Código desconocido".',
    dificultad: 'Avanzado',
    plantilla_codigo: 'public class Solucion {\n    public static String evaluar(String codigo) {\n        // Usa switch(codigo)\n        return "";\n    }\n}',
    casos_prueba: [{ entrada: ['A'], salida: 'Motocicleta' }, { entrada: ['C'], salida: 'Camión' }, { entrada: ['Z'], salida: 'Código desconocido' }]
  },
  {
    titulo: '28. Días del Mes (switch con casos agrupados)',
    descripcion: 'Escribe el método `evaluar(int mes)`. Usa `switch` agrupando casos (`case 4: case 6: ...`). Meses 4, 6, 9, 11 -> "30 días"; Mes 2 -> "28 días"; Meses 1, 3, 5, 7, 8, 10, 12 -> "31 días". default -> "Inválido".',
    dificultad: 'Avanzado',
    plantilla_codigo: 'public class Solucion {\n    public static String evaluar(int mes) {\n        // Agrupa casos en switch\n        return "";\n    }\n}',
    casos_prueba: [{ entrada: [4], salida: '30 días' }, { entrada: [2], salida: '28 días' }, { entrada: [1], salida: '31 días' }]
  },
  {
    titulo: '29. Menú de Opciones de Usuario (switch)',
    descripcion: 'Escribe el método `evaluar(int opcion)`. 1 -> "Ver perfil", 2 -> "Editar datos", 3 -> "Cerrar sesión". default -> "Opción no disponible".',
    dificultad: 'Avanzado',
    plantilla_codigo: 'public class Solucion {\n    public static String evaluar(int opcion) {\n        // Tu código aquí\n        return "";\n    }\n}',
    casos_prueba: [{ entrada: [1], salida: 'Ver perfil' }, { entrada: [3], salida: 'Cerrar sesión' }, { entrada: [9], salida: 'Opción no disponible' }]
  },
  {
    titulo: '30. Conversión de Calificación en Letras (switch)',
    descripcion: 'Escribe el método `evaluar(String letra)`. "A" -> "Excelente", "B" -> "Sobresaliente", "C" -> "Aceptable", "D" -> "Insuficiente", "F" -> "Reprobado". default -> "Grado no válido".',
    dificultad: 'Avanzado',
    plantilla_codigo: 'public class Solucion {\n    public static String evaluar(String letra) {\n        // Usa switch(letra)\n        return "";\n    }\n}',
    casos_prueba: [{ entrada: ['A'], salida: 'Excelente' }, { entrada: ['D'], salida: 'Insuficiente' }, { entrada: ['X'], salida: 'Grado no válido' }]
  }
];

async function seed() {
  try {
    await pool.query('TRUNCATE TABLE ejercicios;');
    
    for (const ej of ejercicios) {
      await pool.query(
        'INSERT INTO ejercicios (titulo, descripcion, dificultad, plantilla_codigo, casos_prueba) VALUES ($1, $2, $3, $4, $5)',
        [ej.titulo, ej.descripcion, ej.dificultad, ej.plantilla_codigo, JSON.stringify(ej.casos_prueba)]
      );
    }
    console.log('30 ejercicios de Java (IF, IF-ELSE, IF-ELSE-IF, SWITCH) insertados con éxito.');
  } catch (err) {
    console.error('Error al poblar la base de datos:', err);
  } finally {
    await pool.end();
  }
}

seed();