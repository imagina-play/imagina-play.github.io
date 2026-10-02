# IMAGINA Learn

Demo educativo funcional de vocabulario en inglés. Aplicación estática, sin dependencias JavaScript externas ni servidor de cuentas. La interfaz funciona en español y las palabras/frases se escuchan en inglés americano.

## Empezar

Abre `/learn/` en un navegador moderno y pulsa **Comenzar mi aventura**. El inicio recomendado es escuchar y elegir, cuatro palabras por sesión. No es necesario escribir, hablar al micrófono ni registrarse.

En **Espacio de adultos → Personalizar práctica** puedes cambiar el apodo, elegir a Milo o Lumi, ajustar sesiones de 4/6/8 palabras, bajar la velocidad del audio, ocultar la traducción y añadir armado de palabras o teclado. La biblioteca ofrece trazado libre para ratón, dedo y lápiz digital; no reconoce ni califica la escritura.

## Contenido y comportamiento

- 96 palabras en 12 mundos: animales, frutas, colores, números, comida, cuerpo, ropa, casa, escuela, transporte, naturaleza y emociones.
- 192 segmentos de palabras/frases en inglés y 10 instrucciones en español. Audio pregrabado con voces sintéticas Microsoft Zira Desktop y Microsoft Sabina Desktop; no necesita micrófono ni una API de pago. Respaldo con síntesis de voz del navegador si falla el archivo.
- Tres modalidades: escuchar y señalar, armar palabras tocando letras, escribir con teclado. Pistas, repetición de audio y opción de omitir escritura.
- Repasos: prioridad a palabras pendientes; un acierto sin ayuda puede avanzar una etapa por día. Intervalos de 1, 3, 7 y 14 días; con error o ayuda se programa para el día siguiente. Son decisiones de diseño, no un protocolo clínico validado.
- Reto semanal: hasta 10 palabras ya practicadas, sin tiempo límite. Se guarda un registro cada 7 días; entre registros se puede practicar libremente.
- Una estrella por palabra practicada cada día, independientemente de acertar. Seis insignias por hitos. No se pierden recompensas ni se exige una racha.
- Hasta cuatro exploradores locales, progreso por palabra, sesiones y reporte CSV. Respaldo/importación JSON con validación y confirmación antes de reemplazar datos.
- Espacio para familias, escuelas y equipos profesionales. Formulario de consulta para adultos con revisión previa y enlace a WhatsApp de IMAGINA. El mensaje no adjunta datos del niño ni resultados.

## Datos y alcance real

El progreso se guarda en `localStorage` (`imagina.learn.v1`) de este navegador y dominio. No se sincroniza automáticamente entre dispositivos. Borrar los datos del navegador puede borrarlo; exporta un respaldo para conservarlo. La pregunta aritmética para adultos evita toques accidentales; no es autenticación segura.

Esta entrega no incluye cuentas en la nube, cobros, panel multiinstitución, diagnóstico, terapia ni evaluación de pronunciación. No incorpora analítica ni formularios de datos infantiles. GitHub Pages sirve los archivos y puede procesar datos técnicos de conexión según sus políticas. Los enlaces a fuentes y WhatsApp son externos. No se promete funcionamiento sin conexión.

## Criterios pedagógicos y fuentes

Se eligieron vocabulario cotidiano, conjuntos cortos, ilustraciones, oportunidades repetidas y escritura gradual. El diseño se informa en fuentes generales; la eficacia de esta aplicación no se ha evaluado en un ensayo ni debe presentarse como tratamiento.

- [IES / What Works Clearinghouse: Teaching Academic Content and Literacy to English Learners](https://ies.ed.gov/ncee/wwc/PracticeGuide/19). Recomienda trabajar un conjunto de vocabulario a lo largo de varios días con actividades variadas e integrar lenguaje oral y escrito. Esta guía escolar no valida por sí sola los intervalos ni el contenido de esta demo.
- [ASHA: Learning More Than One Language](https://www.asha.org/public/speech/development/learning-more-than-one-language/). Orientación general para acompañar el aprendizaje multilingüe y dar oportunidades de práctica. La personalización clínica corresponde a un profesional que conozca al niño.

## Identidad y atribución

Milo: personaje azul cielo, sudadera azul profundo, distintivo de chispa. Lumi: personaje lavanda, pequeño broche melocotón y libro amarillo. Se crearon con generación de imágenes a partir de la referencia proporcionada por el cliente. Logo IMAGINA Learn en lavanda y amarillo; SVG con letras convertidas a curvas para evitar sustituciones de fuente.

- Ilustraciones 3D: [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji), licencia MIT en `assets/LICENSE-Fluent-Emoji.txt`. Colores y números son SVG propios.
- Tipografía Nunito: fuente variable, licencia SIL OFL en `assets/LICENSE-Nunito.txt`.
- La tipografía de IMAGINA en la interfaz reutiliza la fuente de marca existente en `../assets/display-latin.woff2`.
- Mascotas optimizadas en WebP con transparencia; original conservado en la entrega local.

## Desarrollo y mantenimiento

Sirve la raíz del sitio por HTTP; por ejemplo `python -m http.server 8193` y visita `/learn/`. No abras directamente `index.html` como `file://`, porque el catálogo y el índice de audio se cargan con `fetch`.

- `core.js`: perfiles, validación de respaldos, calendario, repasos y recompensas.
- `app.js`: navegación, biblioteca, ajustes, audio, reportes y contacto.
- `lesson.js`: sesiones, respuestas, pistas, escritura y trazado.
- `catalog.json`: categorías y vocabulario.
- `audio/segments.json`: tiempos del sprite `audio/vocabulary.mp3`.
- `learn.css`: interfaz responsive y movimiento reducido.

La landing principal incorpora `learn-section.css` y enlaces a Learn. Se conservan los tres demos de videojuegos existentes y su orden. Para actualizar, modifica solamente los archivos correspondientes; no reemplaces el resto de la carpeta de juegos.

Las pruebas de lógica y los scripts de producción están en la entrega local `work/learn-build`. La revisión funcional se realizó con navegador Chromium en escritorio y tamaños 390×844 y 768×1024; eso no equivale a una prueba en hardware iOS/Android físico.
