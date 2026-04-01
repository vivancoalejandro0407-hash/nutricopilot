export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { nombre, edad, peso, estatura, sexo, objetivo, actividad, presupuesto, restricciones, calorias, imc } = req.body;

  const objetivoLabel = { bajar: 'bajar grasa corporal', muscular: 'ganar masa muscular', mantener: 'mantener peso' }[objetivo];
  const actividadLabel = { bajo: 'sedentario', medio: 'actividad moderada', alto: 'actividad alta' }[actividad];
  const presupuestoLabel = { bajo: 'bajo', medio: 'medio', alto: 'alto' }[presupuesto];

  const prompt = `Genera un plan nutricional semanal profesional para:
Nombre: ${nombre}
Edad: ${edad}
Peso: ${peso}
Estatura: ${estatura}
Objetivo: ${objetivoLabel}
Actividad: ${actividadLabel}
Presupuesto: ${presupuestoLabel}
Restricciones: ${restricciones || 'ninguna'}
Calorías: ${calorias}`;

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
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({ error: 'Error al generar plan' });
  }
}
