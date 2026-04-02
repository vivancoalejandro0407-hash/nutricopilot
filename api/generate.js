// api/generate.js
const { Anthropic } = require("@anthropic-ai/sdk");

function sharesForObjective(objetivo) {
  // Shares aproximados para que el frontend reciba macros consistentes
  if (objetivo === "bajar") return { p: 0.30, c: 0.40, f: 0.30 };
  if (objetivo === "muscular") return { p: 0.35, c: 0.40, f: 0.25 };
  return { p: 0.30, c: 0.35, f: 0.35 }; // mantener
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
      return res.status(500).json({ error: "Falta ANTHROPIC_API_KEY en Vercel." });
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

    if (!nombre || !objetivo || !actividad || !calorias) {
      return res.status(400).json({ error: "Payload incompleto." });
    }

    const shares = sharesForObjective(objetivo);
    const proteina = Math.round((calorias * shares.p) / 4);
    const carbohidratos = Math.round((calorias * shares.c) / 4);
    const grasas = Math.round((calorias * shares.f) / 9);

    const anthropic = new Anthropic({ apiKey });

    const system = [
      "Eres un asistente experto en nutrición para generar planes semanales en español.",
      "Devuelve ÚNICAMENTE JSON válido (sin markdown, sin backticks, sin texto extra).",
      "El JSON debe respetar EXACTAMENTE esta forma de llaves y tipos:",
      "{",
      "\"macros\": {\"calorias\": number, \"proteina\": number, \"carbohidratos\": number, \"grasas\": number},",
      "\"plan_semanal\": {",
      "\"Lunes\": {\"desayuno\": string, \"comida\": string, \"cena\": string, \"colacion1\": string, \"colacion2\": string},",
      "\"Martes\": {\"desayuno\": string, \"comida\": string, \"cena\": string, \"colacion1\": string, \"colacion2\": string},",
      "\"Miércoles\": {\"desayuno\": string, \"comida\": string, \"cena\": string, \"colacion1\": string, \"colacion2\": string},",
      "\"Jueves\": {\"desayuno\": string, \"comida\": string, \"cena\": string, \"colacion1\": string, \"colacion2\": string},",
      "\"Viernes\": {\"desayuno\": string, \"comida\": string, \"cena\": string, \"colacion1\": string, \"colacion2\": string}",
      "},",
      "\"lista_super\": {\"proteinas\": string[], \"carbohidratos\": string[], \"frutas_verduras\": string[], \"lacteos\": string[], \"extras\": string[]},",
      "\"tips\": string[],",
      "\"mensaje_whatsapp\": string",
      "}"
    ].join("\n");

    const userPrompt = `
Genera un plan semanal (5 días: Lunes a Viernes) con 5 comidas por día (desayuno, comida, cena, colación1, colación2).
Objetivo: ${objetivo}
Actividad: ${actividad}
Presupuesto semanal: ${presupuesto}
Restricciones/intolerancias: ${restricciones || "ninguna"}
Datos del paciente: ${nombre}, ${edad} años, ${peso}kg, ${estatura}cm, sexo: ${sexo}, IMC: ${imc}
Calorías objetivo: ${calorias} kcal/día

Macros YA calculados:
- proteina: ${proteina} g
- carbohidratos: ${carbohidratos} g
- grasas: ${grasas} g

Instrucciones:
- Mantén las porciones sugeridas en el texto (ej: "1 porción", "1 taza", "1 pieza").
- Evita alimentos que contradigan las restricciones.
- Lista del súper: 5 categorías, con 6-10 ítems por categoría.
- tips: 6 tips cortos y accionables, alineados al objetivo.
- mensaje_whatsapp: amable, listo para copiar, incluyendo nombre, calorías, macros aproximados y recordatorio de restricciones.

Devuelve SOLO el JSON válido con los campos solicitados.
    `.trim();

    const resp = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      temperature: 0.7,
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
