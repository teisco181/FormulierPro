export interface StudyFlowQuestion {
  id: number;
  category: string;
  questionType: 'multiple_choice' | 'open';
  questionText: string;
  options?: string[];
  correctAnswer: string;
  rubric: string;
  points: number;
}

export interface VocabPair {
  left: string;
  right: string;
}

const BARE_ARTICLES = new Set(['der', 'die', 'das', 'de', 'het', 'een', 'le', 'la', 'les', 'un', 'une', 'the', 'a', 'an']);

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function cleanHeaderPrefix(text: string): string {
  return text
    .replace(/^\s*(woordenlijst\s*\/\s*begrippen|woordenlijst|begrippenlijst|begrippen|vocabulaire|samenvatting)\s*:\s*/i, '')
    .trim();
}

/**
 * Extract clean (left, right) pairs from word lists / glossaries such as:
 * "Woordenlijst/Begrippen: - de bus: der Bus - de dienstregeling: der Fahrplan ..."
 * or newline-separated "term: definition" / "term = definition" / "term - definition"
 */
export function extractVocabPairs(rawText: string): VocabPair[] {
  const cleaned = cleanHeaderPrefix(rawText);
  if (!cleaned) return [];

  // Prefer explicit tab-separated + newline-separated lines ("woord\tbetekenis\n")
  const lines = cleaned
    .split(/\r?\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const tabLines = lines.filter((l) => l.includes('\t'));
  if (tabLines.length >= 2) {
    const tabPairs: VocabPair[] = [];
    for (const line of tabLines) {
      const parts = line.split(/\t+/).map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const left = parts[0];
        const right = parts.slice(1).join(' - ');
        if (
          left.length >= 1 &&
          right.length >= 1 &&
          left.length <= 140 &&
          right.length <= 180 &&
          !BARE_ARTICLES.has(right.toLowerCase()) &&
          !BARE_ARTICLES.has(left.toLowerCase())
        ) {
          tabPairs.push({ left, right });
        }
      }
    }
    if (tabPairs.length >= 2) {
      const seenTab = new Set<string>();
      return tabPairs.filter((p) => {
        const key = `${p.left.toLowerCase()}::${p.right.toLowerCase()}`;
        if (seenTab.has(key)) return false;
        seenTab.add(key);
        return true;
      });
    }
  }

  // Split by newlines, bullets, semicolons, " - ", or "word- nextTerm:"
  const rawChunks = cleaned
    .split(/(?:\r?\n+|;\s+|(?:\s+|^)[•*]\s+|\s+-\s+|(?<=[a-zA-Z0-9!?])-\s+(?=[^:\n]{1,65}:))/)
    .map((c) => c.trim().replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);

  // Re-attach fragments that don't have a colon (e.g. "abgebogen" after "afslaan, inslaan: abbiegen - abgebogen")
  const mergedChunks: string[] = [];
  for (const chunk of rawChunks) {
    if (chunk.includes(':')) {
      mergedChunks.push(chunk);
    } else if (mergedChunks.length > 0 && mergedChunks[mergedChunks.length - 1].includes(':')) {
      mergedChunks[mergedChunks.length - 1] = `${mergedChunks[mergedChunks.length - 1]} - ${chunk}`;
    } else {
      mergedChunks.push(chunk);
    }
  }

  const pairs: VocabPair[] = [];
  for (const item of mergedChunks) {
    const colonIdx = item.indexOf(':');
    if (colonIdx > 0) {
      const left = item.slice(0, colonIdx).trim();
      const right = item.slice(colonIdx + 1).trim();
      if (
        left.length >= 2 &&
        right.length >= 2 &&
        left.length <= 120 &&
        right.length <= 160 &&
        !BARE_ARTICLES.has(right.toLowerCase()) &&
        !BARE_ARTICLES.has(left.toLowerCase())
      ) {
        pairs.push({ left, right });
      }
      continue;
    }

    // Fallback for line-based "term = definition" or "term - definition"
    const eqMatch = item.match(/^([^=\n]{2,80})\s*=\s*([^=\n]{2,140})$/);
    if (eqMatch) {
      pairs.push({ left: eqMatch[1].trim(), right: eqMatch[2].trim() });
      continue;
    }

    const dashMatch = item.match(/^([^-]{2,60})\s+-\s+([^-]{2,140})$/);
    if (dashMatch) {
      pairs.push({ left: dashMatch[1].trim(), right: dashMatch[2].trim() });
    }
  }

  // Deduplicate by normalized left+right
  const seen = new Set<string>();
  return pairs.filter((p) => {
    const key = `${p.left.toLowerCase()}::${p.right.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getLeadingTag(text: string): string {
  const firstWord = text.trim().split(/\s+/)[0]?.toLowerCase() || '';
  if (['der', 'die', 'das', 'de', 'het', 'een', 'le', 'la', 'the'].includes(firstWord)) {
    return firstWord;
  }
  return '';
}

function pickDistractors(
  targetValue: string,
  candidates: string[],
  count: number,
  difficulty: 'makkelijk' | 'gemiddeld' | 'moeilijk'
): string[] {
  const targetLower = targetValue.toLowerCase();
  const targetTag = getLeadingTag(targetValue);
  const uniqueOthers = Array.from(
    new Set(candidates.filter((c) => c.trim() && c.toLowerCase() !== targetLower))
  );

  // On medium/hard, prefer distractors with the same leading article (e.g. der/die/das) so it's a real test
  const sameTag = targetTag
    ? shuffleArray(uniqueOthers.filter((c) => getLeadingTag(c) === targetTag))
    : [];
  const otherTag = shuffleArray(uniqueOthers.filter((c) => !sameTag.includes(c)));

  const orderedPool =
    difficulty === 'makkelijk'
      ? shuffleArray(uniqueOthers)
      : [...sameTag, ...otherTag];

  const picked = orderedPool.slice(0, count);
  let fallbackNum = 1;
  while (picked.length < count) {
    picked.push(`Andere optie ${fallbackNum++}`);
  }
  return picked;
}

function generateFromVocabPairs(
  pairs: VocabPair[],
  params: {
    vak: string;
    titel: string;
    count: 5 | 10 | 15;
    questionType: 'meerkeuze' | 'open' | 'gemengd';
    difficulty: 'makkelijk' | 'gemiddeld' | 'moeilijk';
  }
): StudyFlowQuestion[] {
  const { vak, titel, count, questionType, difficulty } = params;
  const shuffledPairs = shuffleArray(pairs);
  const allLefts = pairs.map((p) => p.left);
  const allRights = pairs.map((p) => p.right);

  const questions: StudyFlowQuestion[] = [];

  for (let i = 0; i < count; i++) {
    const pair = shuffledPairs[i % shuffledPairs.length];
    const useOpen =
      questionType === 'open'
        ? true
        : questionType === 'meerkeuze'
        ? false
        : i % 3 === 2; // In mixed mode, ~2/3 MC and ~1/3 open for great practice

    if (!useOpen) {
      // Alternate NL -> target language and target language -> NL
      const askRightToLeft =
        difficulty === 'makkelijk' ? i % 2 === 0 : i % 3 === 0;

      if (askRightToLeft) {
        const distractors = pickDistractors(pair.left, allLefts, 3, difficulty);
        const options = shuffleArray([pair.left, ...distractors]);
        questions.push({
          id: i + 1,
          category: vak,
          questionType: 'multiple_choice',
          questionText: `Wat betekent "${pair.right}"?`,
          options,
          correctAnswer: pair.left,
          rubric: `"${pair.right}" betekent "${pair.left}" (${titel}).`,
          points: 1,
        });
      } else {
        const distractors = pickDistractors(pair.right, allRights, 3, difficulty);
        const options = shuffleArray([pair.right, ...distractors]);
        const prompt =
          difficulty === 'moeilijk'
            ? `Welke juiste vertaling of omschrijving hoort bij "${pair.left}"?`
            : `Hoe zeg je "${pair.left}"?`;

        questions.push({
          id: i + 1,
          category: vak,
          questionType: 'multiple_choice',
          questionText: prompt,
          options,
          correctAnswer: pair.right,
          rubric: `"${pair.left}" = "${pair.right}" (${titel}).`,
          points: 1,
        });
      }
    } else {
      const askRightToLeft = difficulty === 'makkelijk' && i % 2 === 0;

      if (askRightToLeft) {
        questions.push({
          id: i + 1,
          category: vak,
          questionType: 'open',
          questionText: `Wat is de betekenis van "${pair.right}"?`,
          correctAnswer: pair.left,
          rubric: `${pair.right} = ${pair.left}`,
          points: 1,
        });
      } else {
        const prompt =
          difficulty === 'moeilijk'
            ? `Geef de volledige juiste vorm/vertaling voor "${pair.left}" (inclusief eventueel lidwoord of werkwoordsvorm).`
            : `Wat is de vertaling / het begrip voor "${pair.left}"?`;

        questions.push({
          id: i + 1,
          category: vak,
          questionType: 'open',
          questionText: prompt,
          correctAnswer: pair.right,
          rubric: `${pair.left} = ${pair.right}`,
          points: 1,
        });
      }
    }
  }

  return questions;
}

export function generateLocalStudyFlowQuiz(params: {
  vak: string;
  titel: string;
  tekst: string;
  count: 5 | 10 | 15;
  questionType: 'meerkeuze' | 'open' | 'gemengd';
  difficulty: 'makkelijk' | 'gemiddeld' | 'moeilijk';
}): StudyFlowQuestion[] {
  const { vak, titel, tekst, count, questionType, difficulty } = params;

  // 1. Detect glossary / vocabulary lists first!
  const vocabPairs = extractVocabPairs(tekst);
  if (vocabPairs.length >= 3) {
    return generateFromVocabPairs(vocabPairs, {
      vak,
      titel,
      count,
      questionType,
      difficulty,
    });
  }

  // 2. Prose / summary fallback (never dump the entire text into a single question)
  const stopWords = new Set([
    'deze', 'dit', 'dat', 'voor', 'naar', 'door', 'met', 'van', 'een', 'het', 'zijn', 'worden',
    'wordt', 'heeft', 'hebben', 'maar', 'want', 'omdat', 'zoals', 'waarbij', 'waarin', 'tussen',
    'onder', 'boven', 'over', 'tegen', 'zonder', 'tijdens', 'alleen', 'ook', 'nog', 'wel', 'niet',
    'geen', 'meer', 'veel', 'weinig', 'vaak', 'soms', 'altijd', 'nooit', 'hier', 'daar', 'toen',
    'wanneer', 'waarom', 'welke', 'welk', 'iedere', 'elke', 'alle', 'sommige', 'andere', 'ander',
  ]);

  const rawSentences: string[] = cleanHeaderPrefix(tekst)
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+|\r?\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 25);

  // Keep individual sentence fragments concise (max ~190 chars)
  const usableSentences = (rawSentences.length > 0 ? rawSentences : [tekst.slice(0, 190)]).map((s) =>
    s.length > 190 ? `${s.slice(0, 187).replace(/\s+\S*$/, '')}...` : s
  );

  const keyTerms: string[] = Array.from(
    new Set<string>(
      tekst
        .split(/[^a-zA-Z0-9àáâäèéêëìíîïòóôöùúûüÀÁÂÄÈÉÊËÌÍÎÏÒÓÔÖÙÚÛÜ-]+/)
        .map((w) => w.trim())
        .filter((w) => w.length >= 5 && !stopWords.has(w.toLowerCase()))
    )
  );

  const shuffledSentences = shuffleArray(usableSentences);
  const questionsOut: StudyFlowQuestion[] = [];

  for (let i = 0; i < count; i++) {
    const sentence = shuffledSentences[i % shuffledSentences.length];
    const useOpen =
      questionType === 'open'
        ? true
        : questionType === 'meerkeuze'
        ? false
        : i % 3 === 2;

    const sentenceWords = sentence
      .split(/[^a-zA-Z0-9àáâäèéêëìíîïòóôöùúûüÀÁÂÄÈÉÊËÌÍÎÏÒÓÔÖÙÚÛÜ-]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 5 && !stopWords.has(w.toLowerCase()));

    const targetWord =
      sentenceWords.slice().sort((a, b) => b.length - a.length)[0] ||
      keyTerms[i % Math.max(1, keyTerms.length)] ||
      titel;

    if (!useOpen && targetWord && sentence.toLowerCase().includes(targetWord.toLowerCase())) {
      const masked = sentence.replace(
        new RegExp(`\\b${targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
        '________'
      );

      const distractors = pickDistractors(targetWord, keyTerms, 3, difficulty);
      const options = shuffleArray([targetWord, ...distractors]);

      questionsOut.push({
        id: i + 1,
        category: vak,
        questionType: 'multiple_choice',
        questionText: `Welk begrip uit "${titel}" past op de open plek?\n"${masked}"`,
        options,
        correctAnswer: targetWord,
        rubric: `Volledige zin uit de lesstof: "${sentence}"`,
        points: 1,
      });
    } else {
      questionsOut.push({
        id: i + 1,
        category: vak,
        questionType: 'open',
        questionText:
          difficulty === 'moeilijk'
            ? `Leg in eigen woorden de rol of betekenis van "${targetWord}" uit op basis van "${titel}".`
            : `Wat wordt er in "${titel}" verteld over "${targetWord}"?`,
        correctAnswer: sentence,
        rubric: `Kern uit de lesstof: ${sentence}`,
        points: 2,
      });
    }
  }

  return questionsOut;
}

function normalizeAnswer(str: string): string {
  return str
    .toLowerCase()
    .replace(/[!?.,;:()"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function gradeLocalStudyFlowOpen(
  correctAnswer: string,
  rubric: string,
  studentAnswer: string,
  maxPoints: number
): { scoreAwarded: number; isCorrect: boolean; feedback: string } {
  const trimmed = studentAnswer.trim();
  if (!trimmed) {
    return {
      scoreAwarded: 0,
      isCorrect: false,
      feedback: `Geen antwoord ingevuld. Juiste antwoord: ${correctAnswer}`,
    };
  }

  const studentNorm = normalizeAnswer(trimmed);
  const correctNorm = normalizeAnswer(correctAnswer);

  // Split comma/slash alternatives like "der Bahnsteig, das Gleis" or "het plein, plaats"
  const rawVariants = correctAnswer
    .split(/[,;]|\s+\/\s+/)
    .flatMap((v) => {
      const cleaned = v.trim();
      const withoutCaseMarker = cleaned.replace(/\s+\d+\/\d+$/, '').trim();
      const slashParts = cleaned.includes('/') && !/\d+\/\d+$/.test(cleaned)
        ? cleaned.split('/')
        : [cleaned];
      return [cleaned, withoutCaseMarker, ...slashParts];
    })
    .map((v) => normalizeAnswer(v))
    .filter((v) => v.length >= 2);

  const variants = Array.from(new Set(rawVariants));

  if (
    studentNorm === correctNorm ||
    variants.some((v) => v === studentNorm)
  ) {
    return {
      scoreAwarded: maxPoints,
      isCorrect: true,
      feedback: `Helemaal goed! (${correctAnswer})`,
    };
  }

  // Strip leading article (der/die/das/de/het) to check if the core word matches
  const stripArticle = (s: string) =>
    s.replace(/^(der|die|das|de|het|een|le|la|the)\s+/i, '').trim();

  const studentNoArt = stripArticle(studentNorm);
  if (
    studentNoArt.length >= 3 &&
    (studentNoArt === stripArticle(correctNorm) ||
      variants.some((v) => stripArticle(v) === studentNoArt))
  ) {
    const partial = Math.max(1, Math.round(maxPoints * 0.8));
    return {
      scoreAwarded: maxPoints === 1 ? 1 : partial,
      isCorrect: true,
      feedback: `Goed! Let wel op het lidwoord/de volledige vorm: "${correctAnswer}".`,
    };
  }

  // Keyword overlap fallback for longer explanations
  const refWords = Array.from(
    new Set(
      `${correctAnswer} ${rubric}`
        .toLowerCase()
        .split(/[^a-zA-Z0-9àáâäèéêëìíîïòóôöùúûü]+/)
        .filter((w) => w.length >= 4)
    )
  );

  if (refWords.length >= 3) {
    const matched = refWords.filter((w) => studentNorm.includes(w));
    const ratio = matched.length / refWords.length;
    const scoreAwarded = Math.min(maxPoints, Math.round(ratio * maxPoints));
    const isCorrect = scoreAwarded >= Math.ceil(maxPoints * 0.5);
    return {
      scoreAwarded,
      isCorrect,
      feedback: isCorrect
        ? `Goed beantwoord! Modelantwoord: ${correctAnswer}`
        : `Niet helemaal volledig. Juiste antwoord: ${correctAnswer}`,
    };
  }

  return {
    scoreAwarded: 0,
    isCorrect: false,
    feedback: `Niet juist. Het juiste antwoord is: ${correctAnswer}`,
  };
}
