import { GoogleGenAI } from '@google/genai';

interface GradingInput {
  questionText: string;
  category: string;
  rubric?: string | null;
  studentAnswer: string;
  maxPoints: number;
}

interface GradingResult {
  scoreAwarded: number;
  isCorrect: boolean;
  feedback: string;
}

export async function gradeOpenQuestion(
  input: GradingInput,
  openAiKey?: string | null
): Promise<GradingResult> {
  const { questionText, category, rubric, studentAnswer, maxPoints } = input;

  if (!studentAnswer || studentAnswer.trim() === '') {
    return {
      scoreAwarded: 0,
      isCorrect: false,
      feedback: 'Er is geen antwoord ingevuld.',
    };
  }

  const prompt = `Je bent een ervaren en eerlijke docent/examinator. Beoordeel het antwoord van de leerling op de onderstaande open vraag.

Categorie: ${category}
Vraag: "${questionText}"
Beoordelingsrubriek / Modelantwoord: "${rubric || 'Geen specifieke rubriek opgegeven. Beoordeel op feitelijke juistheid, diepgang en helderheid.'}"
Maximaal te behalen punten: ${maxPoints}

Antwoord van de leerling:
"${studentAnswer}"

Geef je beoordeling UITSLUITEND als een geldig JSON-object in dit exacte formaat (geen markdown backticks, alleen pure JSON):
{
  "scoreAwarded": <getal tussen 0 en ${maxPoints}>,
  "isCorrect": <true als score >= ${Math.max(1, Math.round(maxPoints * 0.5))}, anders false>,
  "feedback": "<Korte, bemoedigende en constructieve Nederlandse feedback waarin je uitlegt wat goed was, wat ontbreekt volgens de rubriek, en eventuele verbeterpunten.>"
}`;

  // If OpenAI Key is provided and starts with sk-
  if (openAiKey && openAiKey.trim().startsWith('sk-')) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openAiKey.trim()}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Je bent een deskundige examinator. Reageer altijd in valide JSON zonder markdown quotes.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        const parsed = JSON.parse(content);
        const score = Math.min(maxPoints, Math.max(0, Number(parsed.scoreAwarded) || 0));
        return {
          scoreAwarded: score,
          isCorrect: score >= Math.max(1, Math.round(maxPoints * 0.5)),
          feedback: parsed.feedback || 'Beoordeeld via OpenAI.',
        };
      } else {
        const errText = await response.text();
        console.warn('OpenAI grading call failed, falling back to Gemini:', errText);
      }
    } catch (openAiErr) {
      console.warn('OpenAI error during grading:', openAiErr);
    }
  }

  // Use Gemini as default high-speed high-accuracy engine
  try {
    const ai = new GoogleGenAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text?.trim() || '{}';
    const parsed = JSON.parse(text);
    const score = Math.min(maxPoints, Math.max(0, Number(parsed.scoreAwarded) || 0));
    return {
      scoreAwarded: score,
      isCorrect: score >= Math.max(1, Math.round(maxPoints * 0.5)),
      feedback: parsed.feedback || 'Geautomatiseerde AI feedback verwerkt.',
    };
  } catch (error) {
    console.error('AI grading error:', error);
    // Graceful fallback
    return {
      scoreAwarded: 0,
      isCorrect: false,
      feedback: 'Automatisch nakijken tijdelijk niet beschikbaar. De docent zal dit antwoord handmatig controleren.',
    };
  }
}
