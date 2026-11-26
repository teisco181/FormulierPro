import { GoogleGenAI } from '@google/genai';

export interface GeneratedQuestion {
  category: string;
  questionType: 'multiple_choice' | 'open';
  questionText: string;
  options?: string[];
  correctAnswer: string;
  rubric: string;
  points: number;
}

export async function generateQuestionsWithAI(
  topicPrompt: string,
  count: number = 5,
  openAiKey?: string | null
): Promise<GeneratedQuestion[]> {
  const prompt = `Genereer ${count} professionele onderwijsvragen of toetsvragen op basis van de volgende vraag van de maker:
"${topicPrompt}"

Zorg voor een goede mix van 'multiple_choice' (meerkeuze met 4 opties) en 'open' (open vragen).
Voor 'multiple_choice' moeten 4 opties worden gegeven, en 'correctAnswer' moet exact overeenkomen met één van de opties.
Voor 'open' is 'correctAnswer' het ideale modelantwoord, en 'rubric' beschrijft duidelijke criteria voor het nakijken / automatische feedback.

Reageer UITSLUITEND met een JSON-array (geen markdown backticks) met objecten in dit formaat:
[
  {
    "category": "<categorie naam, bijv. Algemeen, Theorie, Praktijk>",
    "questionType": "multiple_choice" | "open",
    "questionText": "<de duidelijke vraag>",
    "options": ["Optie A", "Optie B", "Optie C", "Optie D"], // alleen bij multiple_choice
    "correctAnswer": "<het juiste antwoord>",
    "rubric": "<beoordelingscriteria of toelichting voor feedback>",
    "points": 1 // of 2, 3 etc.
  }
]`;

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
              content: 'Je bent een deskundige toetsenmaker. Antwoord altijd in pure JSON array.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        let content = data.choices?.[0]?.message?.content || '[]';
        content = content.replace(/^```json/g, '').replace(/```$/g, '').trim();
        return JSON.parse(content);
      }
    } catch (e) {
      console.warn('OpenAI question generation failed, falling back to Gemini', e);
    }
  }

  try {
    const ai = new GoogleGenAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text?.trim() || '[]';
    return JSON.parse(text);
  } catch (error) {
    console.error('Failed to generate questions with AI:', error);
    throw new Error('Kon geen vragen genereren met AI. Probeer het opnieuw.');
  }
}
