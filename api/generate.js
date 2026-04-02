// api/generate.js
export default async function handler(req, res) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
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
    } = req.body || {};

    const prompt = `Eres un nutriólogo profesional mexicano, experto en planes personalizados y realistas.

Paciente:
- Nombre: ${nombre}
- Edad: ${edad} años
- Peso: ${peso} kg
- Estatura: ${estatura} cm
- Sexo: ${sexo}
- Objetivo: ${objetivo}
- Nivel de actividad: ${actividad}
- Presupuesto semanal: ${presupuesto}
- Restricciones / intolerancias: ${restricciones || 'Ninguna'}

Calorías diarias aproximadas: ${calorias} kcal
IMC: ${imc}

Genera un plan nutricional **realista y profesional** en formato JSON **exacto** con esta estructura (no agregues texto fuera del JSON):

{
  "macros": {
    "calorias": ${calorias || 1800},
    "proteina": 0,
    "carbohidratos": 0,
    "grasas": 0
  },
  "plan_semanal": {
    "Lunes": { "desayuno": "", "comida": "", "cena": "", "colacion1": "", "colacion2": "" },
    "Martes": { "desayuno": "", "comida": "", "cena": "", "colacion1": "", "colacion2": "" },
    "Miércoles": { "desayuno": "", "comida": "", "cena": "", "colacion1": "", "colacion2": "" },
    "Jueves": { "desayuno": "", "comida": "", "cena": "", "colacion1": "", "colacion2": "" },
    "Viernes": { "desayuno": "", "comida": "", "cena": "", "colacion1": "", "colacion2": "" }
  },
  "lista_super": {
    "proteinas": [],
    "carbohidratos": [],
    "frutas_verduras": [],
    "lacteos": [],
    "extras": []
  },
  "tips": ["", "", "", ""],
  "mensaje_whatsapp": "Mensaje cálido, profesional y motivador listo para copiar y enviar por WhatsApp al paciente..."
}

Usa alimentos comunes en México, sé específico con cantidades aproximadas y adapta todo al objetivo y presupuesto.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 3500,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Anthropic error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || '';

    // Extraer solo el JSON (Claude a veces agrega texto extra)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    let planData = {};

    if (jsonMatch) {
      try {
        planData = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error("Error parsing JSON from Claude:", e);
        planData = { error: "No se pudo parsear el JSON" };
      }
    } else {
      planData = { plan: rawText };
    }

    return res.status(200).json(planData);

  } catch (error) {
    console.error('Error en /api/generate:', error);
    return res.status(500).json({
      error: 'Error al generar el plan con Claude',
      message: error.message
    });
  }
}
