-- Manual de apoyo para Iris: entradas de texto (escritas por Master, con
-- sus propias palabras, a partir de material de consulta) que describen
-- patrones generales de iridologia por tema (ej. estomago, huesos). La IA
-- las usa junto con el banco de imagenes de referencia al comparar la
-- foto de un paciente — nunca se muestran al paciente, y el resultado
-- siempre lleva el disclaimer de que esto no es un diagnostico medico.

CREATE TABLE IF NOT EXISTS iris_manual_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic       TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_iris_manual_entries_active
  ON iris_manual_entries (created_at) WHERE deleted_at IS NULL;

INSERT INTO iris_manual_entries (topic, content) VALUES
('Estómago',
'En la teoría de la iridología, el área del estómago se considera una de las zonas que con más frecuencia muestra señales, porque se le atribuye un papel central en la digestión y en cómo el cuerpo procesa lo que come.

Grados de alteración (misma escala que se usa para cualquier otro órgano en esta teoría):
- Agudo: la zona se ve de un blanco claro y como "en relieve" sobre el resto de la fibra. Se interpreta como una reacción activa o irritación reciente.
- Subagudo: el blanco se vuelve más grisáceo y parece estar justo debajo de la superficie, no tan "saltado" como en el agudo.
- Crónico: el tono gris se oscurece más, se ve más profundo dentro de la fibra. Se asocia a un estado que lleva ya tiempo presente.
- Degenerativo: la zona se ve negra y muy profunda, como si la fibra ahí estuviera "borrada" o destruida. Es el grado más avanzado en esta escala.

Dos patrones distintos descritos para el área estomacal:
- Posible exceso de acidez: la zona se ve de un color muy claro y bien delimitado, con el reborde alrededor de la pupila nítido.
- Posible falta de acidez: la zona se ve de un blanco grisáceo más disperso y sin bordes definidos. Si el caso es "crónico", puede aparecer una franja oscura y dentada alrededor de la pupila; si esa franja se torna de color café oscuro, se interpreta como una falta más marcada.

Anillo alrededor del área del estómago: cuando se observa una especie de anillo o línea que atraviesa justo la zona estomacal, en esta teoría se asocia con un estado de irritación funcional del estómago (lo que tradicionalmente llaman "gastritis" o "indigestión nerviosa" dentro de la iridología, sin que esto sea un diagnóstico real).

Relación con el estado general: esta teoría conecta un exceso de acidez en el área estomacal con un cuadro general de nerviosismo, metabolismo acelerado y mayor actividad en otras zonas (como la tiroidea). También sugiere, sin evidencia científica, que los estados de acidez prolongada podrían relacionarse con molestias articulares.'),

('Huesos / estructura ósea',
'La teoría ubica el área ósea general en la periferia del iris, con la pierna (muslo, rodilla, pie) como la zona a la que se le da más peso dentro de esta categoría.

Señal de fractura o lesión ósea antigua: se describe como una línea que corta las fibras de esa zona, generalmente orientada hacia afuera (hacia el borde del iris). Entre más "cerrada" o definida se vea esa línea, se interpreta como una lesión ya consolidada o antigua; si se ve más abierta o con pequeños huecos, se asocia a un proceso que aún no terminó de resolverse del todo.

Tendencia articular / "ácido reumático": se describe una especie de película o velo blanco que cubre una zona amplia del iris (no solo el área ósea), interpretado como una posible tendencia a la acumulación de ácidos relacionados con molestias articulares. También, cuando el área de la columna se ve como la más débil, pueden aparecer pequeñas marcas puntuales a lo largo de esa franja.

Relación con la columna vertebral: el área ósea de la espalda se conecta con una posible predisposición heredada hacia cierta debilidad de la columna, que podría acentuarse si hay además un desequilibrio nutricional (por ejemplo, poco calcio en la dieta, según esta teoría).

Heridas o intervenciones previas: una cicatriz o intervención quirúrgica antigua se describe como un hueco oscuro y bien delimitado dentro de la fibra correspondiente a esa zona.'),

('Pelvis',
'A diferencia del estómago y los huesos, esta teoría no desarrolla un capítulo propio dedicado a la pelvis. Sí la ubica como una zona específica dentro del mapa general del iris: se sitúa en la región inferior, entre el área abdominal y el área de la pierna.

En un caso de ejemplo se describe una marca en esta zona (junto con el área de la ingle) como señal de "debilidad inherente" — una predisposición heredada a que esa zona sea más sensible o vulnerable, sin que esto implique por sí mismo una enfermedad activa. Más allá de este señalamiento puntual, no hay una guía detallada sobre cómo distinguir distintos grados o tipos de alteración específicamente en el área pélvica.'),

('Esófago',
'No se encontró, dentro del material de consulta revisado, un capítulo ni una sección dedicada específicamente al esófago. Es posible que esta teoría no le dé un tratamiento propio y separado del área estomacal. Por ahora no hay una descripción de patrones visuales propia para esófago en este manual.');
