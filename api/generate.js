// api/generate.js

// 1. CONFIGURACIÓN CLAVE: Cambiamos a 'edge' para que la función no muera a los 10 segundos.
export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // En Edge Runtime no usamos res.status(), usamos el estándar de Response de la Web.
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const {
      nombre = '',
      edad = '',
      peso = '',
      estatura = '',
      sexo = '',
      objetivo = 'mantener',
      actividad = 'medio',
      presupuesto = 'medio',
      restricciones = '',
      calorias = '',
      imc = ''
    } = body || {};

    // 2. OPTIMIZACIÓN DEL PROMPT: Pedimos solo 3 días para asegurar que Claude termine antes de que Vercel corte la conexión.
    const prompt = `Eres un nutriólogo profesional mexicano, experto en planes personalizados y realistas.
Paciente: ${nombre}, ${edad} años, ${peso}kg, ${estatura}cm, ${sexo}. Objetivo: ${objetivo}.
Actividad: ${actividad}. Presupuesto: ${presupuesto}. Restricciones: ${restricciones || 'Ninguna'}.
Calorías sugeridas: ${calorias} kcal. IMC: ${imc}.

Genera un plan nutricional JSON EXACTO (sin texto extra fuera de las llaves):

{
  "macros": { "calorias": ${calorias || 1800}, "proteina": 0, "carbohidratos": 0, "grasas": 0 },
  "plan_semanal": {
    "Lunes": { "desayuno": "", "comida": "", "cena": "", "colacion1": "", "colacion2": "" },
    "Martes": { "desayuno": "", "comida": "", "cena": "", "colacion1": "", "colacion2": "" },
    "Miércoles": { "desayuno": "", "comida": "", "cena": "", "colacion1": "", "colacion2": "" }
  },
  "lista_super": { "proteinas": [], "carbohidratos": [], "frutas_verduras": [], "lacteos": [], "extras": [] },
  "tips": ["", "", ""],
  "mensaje_whatsapp": "Mensaje cálido para el paciente..."
}

IMPORTANTE: Solo genera Lunes, Martes y Miércoles para optimizar tiempo. Usa alimentos mexicanos.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1500, // Menos tokens = más rápido
        temperature: 0,    // 0 es mejor para generar JSON sin errores
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      return new Response(JSON.stringify({ error: `Anthropic Error: ${response.status}`, details: errorData }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || '';

    // Extraer solo el JSON por si Claude agrega texto decorativo
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    let planData = jsonMatch ? JSON.parse(jsonMatch[0]) : { plan: rawText };

    return new Response(JSON.stringify(planData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error en /api/generate:', error);
    return new Response(JSON.stringify({ error: 'Error al generar el plan', message: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
