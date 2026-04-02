const { Anthropic } = require("@anthropic-ai/sdk");

function sharesForObjective(objetivo) {
  if (objetivo === "bajar") return { p: 0.30, c: 0.40, f: 0.30 };
  if (objetivo === "muscular") return { p: 0.35, c: 0.40, f: 0.25 };
  return { p: 0.30, c: 0.35, f: 0.35 };
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No se encontró JSON en la respuesta de IA.");
  return JSON.parse(match[0]);
}

// 🧠 ICC backend (blindado)
function interpretarICC(icc, sexo) {
  if (sexo === "Mujer") {
    if (icc < 0.80) return { nivel: "bajo", color: "verde" };
    if (icc < 0.85) return { nivel: "moderado", color: "amarillo" };
    return { nivel: "alto", color: "rojo" };
  }

  if (sexo === "Hombre") {
    if (icc < 0.90) return { nivel: "bajo", color: "verde" };
    if (icc < 1.00) return { nivel: "moderado", color: "amarillo" };
    return { nivel: "alto", color: "rojo" };
  }

  return { nivel: "desconocido", color: "gris" };
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Falta ANTHROPIC_API_KEY." });
    }

    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const {
      nombre,
      edad,
      peso,
      estatura,
      sexo,
      objetivo,
      actividad,
      presupuesto,
      restricciones,
      calorias,
      imc,
      cintura,
      cadera
    } = payload || {};

    if (!nombre || !objetivo || !actividad || !calorias || !sexo) {
      return res.status(400).json({ error: "Payload incompleto." });
    }

    // 🔒 CALORÍAS BLINDADAS
    let caloriasAjustadas = calorias;

    if (sexo === "Mujer" && calorias < 1200) caloriasAjustadas = 1200;
    if (sexo === "Hombre" && calorias < 1400) caloriasAjustadas = 1400;

    const shares = sharesForObjective(objetivo);

    const proteina = Math.max(
      Math.round((caloriasAjustadas * shares.p) / 4),
      Math.round(peso * 1.4) // 💪 mínimo clínico
    );

    const carbohidratos = Math.round((caloriasAjustadas * shares.c) / 4);
    const grasas = Math.round((caloriasAjustadas * shares.f) / 9);

    const anthropic = new Anthropic({ apiKey });

    // 🧠 PROMPT PRO
    const system = `
Eres un nutriólogo clínico profesional especializado en población mexicana.

OBJETIVO:
Generar planes nutricionales realistas, económicos y clínicamente coherentes.

REGLAS CRÍTICAS:

1. RIESGO
- PROHIBIDO usar: "muy alto", "urgente", "extremo", "derivar".
- SOLO usar: "bajo", "moderado", "alto".
- NO diagnosticar enfermedades.
- Usar lenguaje prudente.

2. CALORÍAS
- Ya están validadas clínicamente.
- NO puedes modificarlas.
- Deben coincidir EXACTAMENTE.

3. PROTEÍNA
- Mínimo 1.4 g por kg de peso.

4. PRESUPUESTO BAJO
- Usar alimentos mexicanos accesibles:
  huevo, pollo, atún, sardina, frijoles, lentejas, arroz, avena, tortillas.
- Evitar alimentos caros.

5. CALIDAD ALIMENTARIA
- PROHIBIDO uso frecuente de:
  galletas, azúcar añadida, miel libre.
- Solo ocasional y con porción específica.

6. VARIEDAD (MUY IMPORTANTE)
- Cada día debe ser diferente.
- NO repetir comidas.
- Variar proteínas, carbohidratos y preparaciones.

7. COLACIONES
- Basadas en proteína + fibra.

8. TONO
- Profesional, claro, motivador.
- SIN alarmismo.

Devuelve SOLO JSON válido.
`.trim();

    const userPrompt = `
Genera un plan nutricional semanal (Lunes a Viernes).

Paciente:
Nombre: ${nombre}
Edad: ${edad}
Peso: ${peso} kg
Estatura: ${estatura} cm
Sexo: ${sexo}
IMC: ${imc}

Objetivo: ${objetivo}
Actividad: ${actividad}
Presupuesto: ${presupuesto}
Restricciones: ${restricciones || "ninguna"}

Calorías objetivo: ${caloriasAjustadas}

Macros:
Proteína: ${proteina} g
Carbohidratos: ${carbohidratos} g
Grasas: ${grasas} g

REQUISITOS:
- 5 comidas por día
- Porciones claras
- Lista del súper realista en México
- 6 tips útiles
- Mensaje WhatsApp claro y profesional

ESTRUCTURA JSON:

{
  "macros": { "calorias": number, "proteina": number, "carbohidratos": number, "grasas": number },
  "plan_semanal": {
    "Lunes": { "desayuno": string, "comida": string, "cena": string, "colacion1": string, "colacion2": string },
    "Martes": { "desayuno": string, "comida": string, "cena": string, "colacion1": string, "colacion2": string },
    "Miércoles": { "desayuno": string, "comida": string, "cena": string, "colacion1": string, "colacion2": string },
    "Jueves": { "desayuno": string, "comida": string, "cena": string, "colacion1": string, "colacion2": string },
    "Viernes": { "desayuno": string, "comida": string, "cena": string, "colacion1": string, "colacion2": string }
  },
  "lista_super": {
    "proteinas": string[],
    "carbohidratos": string[],
    "frutas_verduras": string[],
    "lacteos": string[],
    "extras": string[]
  },
  "tips": string[],
  "mensaje_whatsapp": string
}

Devuelve SOLO JSON válido.
`.trim();

    const resp = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      temperature: 0.6,
      system,
      messages: [{ role: "user", content: userPrompt }]
    });

    const text = resp?.content?.[0]?.text;
    if (!text) return res.status(500).json({ error: "Respuesta vacía de la IA." });

    const data = extractJson(text);

    // 🔒 VALIDACIÓN FINAL
    data.macros.calorias = caloriasAjustadas;

    // 🧠 ICC FINAL (BLINDADO)
    let iccData = null;

    if (cintura && cadera) {
      const icc = cintura / cadera;
      const interpretacion = interpretarICC(icc, sexo);

      iccData = {
        valor: icc.toFixed(2),
        nivel: interpretacion.nivel,
        color: interpretacion.color,
        mensaje: interpretacion.nivel === "alto"
          ? "Se recomienda mejorar hábitos y dar seguimiento."
          : interpretacion.nivel === "moderado"
          ? "Se recomienda mantener y mejorar hábitos."
          : "Buen control de distribución de grasa corporal."
      };
    }

    res.status(200).json({
      ...data,
      icc: iccData
    });

  } catch (err) {
    res.status(500).json({ error: err?.message || "Error al generar con IA" });
  }
};
