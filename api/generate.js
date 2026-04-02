 export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

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
  } = req.body;

  const objetivoLabel = {
    bajar: 'bajar grasa corporal',
    muscular: 'ganar masa muscular',
    mantener: 'mantener peso'
  }[objetivo];

  const actividadLabel = {
    bajo: 'sedentario',
    medio: 'actividad moderada',
    alto: 'actividad alta'
  }[actividad];

  const presupuestoLabel = {
    bajo: 'bajo',
    medio: 'medio',
    alto: 'alto'
  }[presupuesto];

  const prompt = `Genera un plan nutricional semanal profesional para:
Nombre: ${nombre}
Edad: ${edad}
Peso: ${peso}
Estatura: ${estatura}
Sexo: ${sexo}
Objetivo: ${objetivoLabel}
Actividad: ${actividadLabel}
Presupuesto: ${presupuestoLabel}
Restricciones: ${restricciones || 'ninguna'}
Calorías: ${calorias}
IMC: ${imc}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    // Extraer el texto del plan
    const plan = data.content?.[0]?.text || 'No se pudo generar el plan';

    return res.status(200).json({ plan });
  } catch (error) {
    console.error('Error en generate:', error);
    return res.status(500).json({ error: 'Error al generar plan' });
  }
}

