exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { nombre, edad, peso, estatura, sexo, objetivo, actividad, presupuesto, restricciones, calorias, imc } = JSON.parse(event.body);

  const objetivoLabel = { bajar: 'bajar grasa corporal', muscular: 'ganar masa muscular', mantener: 'mantener peso' }[objetivo];
  const actividadLabel = { bajo: 'sedentario (sin ejercicio)', medio: 'actividad moderada (1-3 días/semana)', alto: 'actividad alta (4-6 días/semana)' }[actividad];
  const presupuestoLabel = { bajo: 'bajo (alimentos económicos accesibles en México)', medio: 'medio', alto: 'alto (productos premium)' }[presupuesto];

  const prompt = `Eres una nutrióloga mexicana certificada con 10 años de experiencia. Genera un plan nutricional semanal completo y profesional para este paciente.

DATOS DEL PACIENTE:
- Nombre: ${nombre}
- Edad: ${edad} años
- Peso: ${peso} kg
- Estatura: ${estatura} cm
- IMC: ${imc}
- Sexo: ${sexo}
- Objetivo: ${objetivoLabel}
- Nivel de actividad: ${actividadLabel}
- Presupuesto: ${presupuestoLabel}
- Calorías diarias calculadas: ${calorias} kcal
- Restricciones/intolerancias: ${restricciones || 'ninguna'}

INSTRUCCIONES:
- Usa alimentos comunes y accesibles en México (tortillas, frijoles, nopal, jamaica, epazote, chayote, jícama, etc.)
- Adapta el presupuesto: bajo = mercado/tianguis, medio = supermercado, alto = productos premium
- Sé específico en cantidades cuando sea relevante (ej. "2 huevos revueltos" no solo "huevos")
- Las comidas deben ser variadas entre días (no repitas el mismo platillo)
- El mensaje de WhatsApp debe sonar cálido, personal y motivador — como si fuera de su nutrióloga de confianza

Responde ÚNICAMENTE con este JSON exacto, sin texto adicional, sin markdown, sin explicaciones:

{
  "macros": {
    "calorias": ${calorias},
    "proteina": <número en gramos>,
    "carbohidratos": <número en gramos>,
    "grasas": <número en gramos>
  },
  "plan_semanal": {
    "Lunes":     { "desayuno": "...", "comida": "...", "cena": "...", "colacion1": "...", "colacion2": "..." },
    "Martes":    { "desayuno": "...", "comida": "...", "cena": "...", "colacion1": "...", "colacion2": "..." },
    "Miércoles": { "desayuno": "...", "comida": "...", "cena": "...", "colacion1": "...", "colacion2": "..." },
    "Jueves":    { "desayuno": "...", "comida": "...", "cena": "...", "colacion1": "...", "colacion2": "..." },
    "Viernes":   { "desayuno": "...", "comida": "...", "cena": "...", "colacion1": "...", "colacion2": "..." }
  },
  "lista_super": {
    "proteinas":       ["...", "..."],
    "carbohidratos":   ["...", "..."],
    "frutas_verduras": ["...", "..."],
    "lacteos":         ["...", "..."],
    "extras":          ["...", "..."]
  },
  "tips": ["...", "...", "...", "..."],
  "mensaje_whatsapp": "..."
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    const texto = data.content[0].text.trim();

    // Limpiar posibles backticks que Claude a veces agrega
    const limpio = texto.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const plan = JSON.parse(limpio);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(plan)
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Error al generar el plan. Intenta de nuevo.' })
    };
  }
};
