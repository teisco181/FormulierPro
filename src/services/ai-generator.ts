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

export interface StudyFlowGenerateParams {
  vak: string;
  titel: string;
  tekst: string;
  count: 5 | 10 | 15;
  questionType: 'meerkeuze' | 'open' | 'gemengd';
  difficulty: 'makkelijk' | 'gemiddeld' | 'moeilijk';
}

function createGeminiClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseJsonArrayResponse(raw: string): GeneratedQuestion[] {
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/g, '').trim();
  const parsed = JSON.parse(cleaned);
  return Array.isArray(parsed) ? parsed : [];
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
Voor 'open' is 'correctAnswer' het ideale modelantwoord, en 'rubric' beschft duidelijke criteria voor het nakijken / automatische feedback.

Reageer UITSLUITEND met een JSON-array (geen markdown backticks) met objecten in dit formaat:
[
  {
    "category": "<categorie naam, bijv. Algemeen, Theorie, Praktijk>",
    "questionType": "multiple_choice" | "open",
    "questionText": "<de duidelijke vraag>",
    "options": ["Optie A", "Optie B", "Optie C", "Optie D"],
    "correctAnswer": "<het juiste antwoord>",
    "rubric": "<beoordelingscriteria of toelichting voor feedback>",
    "points": 1
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
        const content = data.choices?.[0]?.message?.content || '[]';
        return parseJsonArrayResponse(content);
      }
    } catch (e) {
      console.warn('OpenAI question generation failed, falling back to Gemini', e);
    }
  }

  try {
    const ai = createGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text?.trim() || '[]';
    return parseJsonArrayResponse(text);
  } catch (error) {
    console.error('Failed to generate questions with AI:', error);
    throw new Error('Kon geen vragen genereren met AI. Probeer het opnieuw.');
  }
}

export async function generateStudyFlowQuiz(
  params: StudyFlowGenerateParams
): Promise<GeneratedQuestion[]> {
  const { vak, titel, tekst, count, questionType, difficulty } = params;

  const typeInstruction =
    questionType === 'meerkeuze'
      ? `Maak UITSLUITEND 'multiple_choice' vragen (alle ${count} vragen moeten questionType "multiple_choice" hebben met elk 4 plausibele antwoordopties).`
      : questionType === 'open'
      ? `Maak UITSLUITEND 'open' vragen (alle ${count} vragen moeten questionType "open" hebben, zonder options).`
      : `Maak een evenwichtige mix van 'multiple_choice' (ongeveer de helft, elk met 4 opties) en 'open' vragen.`;

  const difficultyInstruction =
    difficulty === 'makkelijk'
      ? 'Moeilijkheid MAKKELIJK: richt je op basiskennis, definities en direct herkenbare feiten uit de tekst.'
      : difficulty === 'moeilijk'
      ? 'Moeilijkheid MOEILIJK: richt je op dieper begrip, verbanden, toepassing en oorzaak-gevolg binnen de gegeven tekst.'
      : 'Moeilijkheid GEMIDDELD: richt je op begrip, uitleg in eigen woorden en verbanden uit de tekst.';

  const prompt = `Je bent een deskundige Nederlandse docent voor het vak "${vak}".
Maak een toets van exact ${count} vragen in het Nederlands, passend bij het niveau van de leerling, over het onderwerp "${titel}".

STRIKTE BRONREGEL:
Gebruik UITSLUITEND de onderstaande lesstof als bron. Verzin geen externe feiten die niet in de tekst staan. Elke vraag en elk juist antwoord moet aantoonbaar over deze lesstof gaan.

ALS DE LESSTOF EEN WOORDENLIJST OF BEGRIPPENLIJST IS (bijv. Nederlands - Duits/Engels/Frans, gescheiden met tabs en enters of dubbele punten):
- Elke regel of elk paar vormt één apart woord/begrip met bijbehorende vertaling of uitleg.
- Zet NOOIT de hele woordenlijst in de vraagtekst!
- Stel per vraag één duidelijke, korte overhoorvraag over één specifiek woord of begrip (bijv. "Wat betekent 'der Fahrplan'?", "Hoe zeg je 'de halte' in het Duits?", of een korte invulzin met één woord uit de lijst).
- Kies bij meerkeuze realistische afleiders uit de andere woorden in dezelfde woordenlijst (bij voorkeur met hetzelfde lidwoord of woordsoort).
- Sla eventueel onvolledige of afgebroken termen (zoals alleen een los lidwoord zonder zelfstandig naamwoord) over.

${typeInstruction}
${difficultyInstruction}

Voor 'multiple_choice':
- Geef altijd exact 4 opties in "options".
- "correctAnswer" moet EXACT overeenkomen met één van de 4 strings in "options".
- Zet "points" op 1.

Voor 'open':
- Laat "options" weg of geef [].
- Zet in "correctAnswer" het volledige, duidelijke modelantwoord op basis van de lesstof.
- Zet in "rubric" duidelijke nakijkcriteria op basis van de lesstof.
- Zet "points" op 2.

LESSTOF:
"""
${tekst}
"""

Reageer UITSLUITEND met een geldige JSON-array met exact ${count} objecten:
[
  {
    "category": "${vak}",
    "questionType": "multiple_choice" | "open",
    "questionText": "<duidelijke Nederlandse vraag over de lesstof>",
    "options": ["Optie 1", "Optie 2", "Optie 3", "Optie 4"],
    "correctAnswer": "<exact juiste optie of modelantwoord>",
    "rubric": "<korte toelichting of nakijkcriteria>",
    "points": 1
  }
]`;

  try {
    const ai = createGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text?.trim() || '[]';
    const rawList = parseJsonArrayResponse(text);

    return rawList.slice(0, count).map((q) => {
      const normalizedType: 'multiple_choice' | 'open' =
        questionType === 'meerkeuze'
          ? 'multiple_choice'
          : questionType === 'open'
          ? 'open'
          : q.questionType === 'open'
          ? 'open'
          : 'multiple_choice';

      const options =
        normalizedType === 'multiple_choice'
          ? Array.isArray(q.options) && q.options.length >= 2
            ? q.options.slice(0, 4).map(String)
            : [String(q.correctAnswer || 'Optie A'), 'Optie B', 'Optie C', 'Optie D']
          : undefined;

      let correctAnswer = String(q.correctAnswer || '').trim();
      if (normalizedType === 'multiple_choice' && options && !options.includes(correctAnswer)) {
        correctAnswer = options[0];
      }

      return {
        category: String(q.category || vak || 'Algemeen'),
        questionType: normalizedType,
        questionText: String(q.questionText || '').trim(),
        options,
        correctAnswer,
        rubric: String(q.rubric || '').trim(),
        points: normalizedType === 'open' ? Math.max(1, Number(q.points) || 2) : Math.max(1, Number(q.points) || 1),
      };
    });
  } catch (error) {
    console.error('Failed to generate StudyFlow quiz with Gemini:', error);
    throw new Error('Kon geen toets genereren uit de lesstof met Gemini. Probeer het opnieuw.');
  }
}
