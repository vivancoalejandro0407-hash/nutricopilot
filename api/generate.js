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

// 🧠 ICC controlado por backend (NO IA)
function interpretarICC(icc, sexo) {
  if (sexo === "Mujer") {
    if (icc < 0.80) return { nivel: "bajo", mensaje: "Riesgo bajo" };
    if (icc < 0.85) return { nivel: "moderado", mensaje: "Riesgo moderado" };
    return {
      nivel: "alto",
      mensaje: "Riesgo aumentado de acumulación abdominal. Se recomienda mejorar hábitos y seguimiento."
    };
  }

  if (sexo === "Hombre") {
    if (icc < 0.90) return { nivel: "bajo", mensaje: "Riesgo bajo" };
    if (icc < 1.00) return { nivel: "moderado", mensaje: "Riesgo moderado" };
    return {
      nivel: "alto",
      mensaje: "Riesgo aumentado de acumulación abdominal. Se recomienda mejorar hábitos y seguimiento."
    };
  }

  return null;
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

    // 🔒 BLINDAR CALORÍAS
    let caloriasAjustadas = calorias;

    if (sexo === "Mujer" && calorias < 1200) caloriasAjustadas = 1200;
    if (sexo === "Hombre" && calorias < 1400) caloriasAjustadas = 1400;

    const shares = sharesForObjective(objetivo);
    const proteina = Math.round((caloriasAjustadas * shares.p) / 4);
    const carbohidratos = Math.round((caloriasAjustadas * shares.c) / 4);
    const grasas = Math.round((caloriasAjustadas * shares.f) / 9);

    const anthropic = new Anthropic({ apiKey });

    // 🧠 SYSTEM PROMPT CONTROLADO
    const system = `
Eres un nutriólogo clínico profesional especializado en población mexicana.

Generas planes nutricionales:
- Clínicamente coherentes
- Económicos y realistas en México
- Sin alarmismo
- Claros y prácticos

REGLAS:

1. NO exageres riesgos ni uses lenguaje alarmista.
2. NO diagnostiques enfermedades.
3. Respeta EXACTAMENTE las calorías proporcionadas.
4. Usa alimentos accesibles si el presupuesto es bajo:
   huevo, pollo, atún, sardina, frijoles, lentejas, arroz, avena, tortillas.
5. Evita alimentos caros (salmón, quinoa, frutos rojos caros).
6. Plan simple, repetible y fácil de preparar.
7. Tono profesional, claro y motivador.

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

    // 🔒 VALIDACIÓN FINAL CALORÍAS
    if (data.macros?.calorias !== caloriasAjustadas) {
      data.macros.calorias = caloriasAjustadas;
    }

    // 🧠 ICC FINAL
    let iccData = null;

    if (cintura && cadera) {
      const icc = cintura / cadera;
      const interpretacion = interpretarICC(icc, sexo);

      iccData = {
        valor: icc.toFixed(2),
        nivel: interpretacion?.nivel,
        mensaje: interpretacion?.mensaje
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
