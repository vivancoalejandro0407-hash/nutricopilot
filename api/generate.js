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
      imc
    } = payload || {};

    if (!nombre || !objetivo || !actividad || !calorias || !sexo) {
      return res.status(400).json({ error: "Payload incompleto." });
    }

    // 🔥 Ajuste mínimo de calorías (evita planes extremos)
    let caloriasAjustadas = calorias;
    if (sexo === "Mujer" && calorias < 1200) caloriasAjustadas = 1200;
    if (sexo === "Hombre" && calorias < 1400) caloriasAjustadas = 1400;

    const shares = sharesForObjective(objetivo);
    const proteina = Math.round((caloriasAjustadas * shares.p) / 4);
    const carbohidratos = Math.round((caloriasAjustadas * shares.c) / 4);
    const grasas = Math.round((caloriasAjustadas * shares.f) / 9);

    const anthropic = new Anthropic({ apiKey });

    // 🧠 SYSTEM PROMPT PRO (CLÍNICO + MÉXICO + SIN ALARMISMO)
    const system = `
Eres un nutriólogo clínico profesional especializado en población mexicana.

Tu objetivo es generar planes nutricionales:
- Clínicamente coherentes
- Realistas para México
- Sin alarmismo
- Económicamente viables

REGLAS OBLIGATORIAS:

1. COHERENCIA CLÍNICA
- Usa correctamente el sexo del paciente.
- NO generes diagnósticos exagerados.
- Si IMC es normal, NO hables de obesidad ni riesgos severos.

2. INTERPRETACIÓN DE RIESGO
- Usa términos: bajo, moderado o alto.
- NO uses "urgente", "muy alto", "riesgo extremo".
- Mantén lenguaje prudente y profesional.

3. CALORÍAS
- Respeta las calorías dadas.
- Ya vienen ajustadas, NO las modifiques.

4. PROTEÍNA
- Asegura que sea suficiente para preservar masa muscular.

5. PRESUPUESTO (CRÍTICO)
Si presupuesto = "bajo":
- Usa alimentos accesibles en México:
  huevo, pollo, atún, sardina, frijoles, lentejas, arroz, avena, tortillas
- EVITA:
  salmón, quinoa, frutos rojos caros, almendras frecuentes

6. PLAN
- 5 comidas por día
- Fácil de preparar
- Porciones claras

7. TONO
- Profesional
- Claro
- Motivador
- SIN asustar

8. FORMATO
Devuelve ÚNICAMENTE JSON válido, sin texto adicional.
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
- 6 tips útiles y accionables
- Mensaje WhatsApp profesional, breve y claro

ESTRUCTURA JSON EXACTA:

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

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err?.message || "Error al generar con IA" });
  }
};
