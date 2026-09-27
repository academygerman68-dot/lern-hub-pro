import { mkdirSync, writeFileSync } from "node:fs";

const tf = ["Richtig", "Falsch"];
const mc = (a, b, c) => [
  { id: "A", text: a },
  { id: "B", text: b },
  { id: "C", text: c },
];
const ab = (a, b) => [
  { id: "A", text: a },
  { id: "B", text: b },
];

const lesen = [
  {
    id: "A1-SIM-01-L01", part: 1, order: 1, type: "true_false", points: 1,
    instruction: "Lesen Sie die Texte und die Aufgaben 1 bis 5. Kreuzen Sie an: Richtig oder Falsch.",
    passage: "Liebe Sofia,\nich bin von Freitag bis Sonntag in Bonn. Am Freitag muss ich bis 17 Uhr arbeiten. Hast du am Samstag Zeit? Wir können uns um 11 Uhr vor dem Stadtmuseum treffen und danach zusammen essen.\nViele Grüße\nMila",
    prompt: "Mila bleibt drei Tage in Bonn.", choices: tf, correct_answer: "Richtig",
    explanation: "Mila ist von Freitag bis Sonntag in Bonn.",
  },
  {
    id: "A1-SIM-01-L02", part: 1, order: 2, type: "true_false", points: 1,
    passage: "Liebe Sofia,\nich bin von Freitag bis Sonntag in Bonn. Am Freitag muss ich bis 17 Uhr arbeiten. Hast du am Samstag Zeit? Wir können uns um 11 Uhr vor dem Stadtmuseum treffen und danach zusammen essen.\nViele Grüße\nMila",
    prompt: "Mila und Sofia treffen sich am Freitagabend.", choices: tf, correct_answer: "Falsch",
    explanation: "Das Treffen ist für Samstag um 11 Uhr geplant.",
  },
  {
    id: "A1-SIM-01-L03", part: 1, order: 3, type: "true_false", points: 1,
    passage: "Hallo zusammen,\nunser Ausflug ist am 14. Juni. Der Bus fährt um 8.30 Uhr vor der Sporthalle ab. Bitte bringt etwas zu trinken mit. Das Mittagessen im Restaurant kostet 12 Euro. Kinder bezahlen 7 Euro.\nEuer Sportverein",
    prompt: "Der Bus wartet vor der Sporthalle.", choices: tf, correct_answer: "Richtig",
    explanation: "Der Bus fährt vor der Sporthalle ab.",
  },
  {
    id: "A1-SIM-01-L04", part: 1, order: 4, type: "true_false", points: 1,
    passage: "Hallo zusammen,\nunser Ausflug ist am 14. Juni. Der Bus fährt um 8.30 Uhr vor der Sporthalle ab. Bitte bringt etwas zu trinken mit. Das Mittagessen im Restaurant kostet 12 Euro. Kinder bezahlen 7 Euro.\nEuer Sportverein",
    prompt: "Die Teilnehmer sollen Getränke mitbringen.", choices: tf, correct_answer: "Richtig",
    explanation: "Im Text steht: Bitte bringt etwas zu trinken mit.",
  },
  {
    id: "A1-SIM-01-L05", part: 1, order: 5, type: "true_false", points: 1,
    passage: "Hallo zusammen,\nunser Ausflug ist am 14. Juni. Der Bus fährt um 8.30 Uhr vor der Sporthalle ab. Bitte bringt etwas zu trinken mit. Das Mittagessen im Restaurant kostet 12 Euro. Kinder bezahlen 7 Euro.\nEuer Sportverein",
    prompt: "Alle bezahlen 12 Euro für das Mittagessen.", choices: tf, correct_answer: "Falsch",
    explanation: "Kinder bezahlen nur 7 Euro.",
  },
  {
    id: "A1-SIM-01-L06", part: 2, order: 6, type: "single_choice", points: 1,
    instruction: "Wo finden Sie die Information? Wählen Sie A oder B.",
    passage: "A — www.stadtbibliothek.de: Öffnungszeiten, Ausweis, Bücher verlängern.\n\nB — www.buchladen-kern.de: Romane und Reiseführer online kaufen.",
    prompt: "Sie möchten wissen, ob die Bibliothek am Samstag geöffnet ist.",
    choices: ab("www.stadtbibliothek.de", "www.buchladen-kern.de"), correct_answer: "A",
    explanation: "Öffnungszeiten der Bibliothek finden Sie auf Seite A.",
  },
  {
    id: "A1-SIM-01-L07", part: 2, order: 7, type: "single_choice", points: 1,
    passage: "A — www.mobil-bonn.de: Busse und Bahnen, Fahrpläne, Tickets.\n\nB — www.rad-bonn.de: Fahrräder kaufen und reparieren.",
    prompt: "Sie suchen eine Busverbindung zum Bahnhof.",
    choices: ab("www.mobil-bonn.de", "www.rad-bonn.de"), correct_answer: "A",
    explanation: "Fahrpläne für Busse stehen auf Seite A.",
  },
  {
    id: "A1-SIM-01-L08", part: 2, order: 8, type: "single_choice", points: 1,
    passage: "A — www.hotel-am-park.de: Zimmer und Frühstück in Leipzig.\n\nB — www.wohnung-leipzig.de: Wohnungen langfristig mieten.",
    prompt: "Sie brauchen für zwei Nächte ein Zimmer in Leipzig.",
    choices: ab("www.hotel-am-park.de", "www.wohnung-leipzig.de"), correct_answer: "A",
    explanation: "Für zwei Nächte ist die Hotelseite richtig.",
  },
  {
    id: "A1-SIM-01-L09", part: 2, order: 9, type: "single_choice", points: 1,
    passage: "A — www.deutsch-abends.de: Deutschkurse Montag und Mittwoch, 18–20 Uhr.\n\nB — www.deutsch-morgens.de: Deutschkurse täglich, 9–12 Uhr.",
    prompt: "Sie arbeiten bis 17 Uhr und möchten Deutsch lernen.",
    choices: ab("www.deutsch-abends.de", "www.deutsch-morgens.de"), correct_answer: "A",
    explanation: "Der Abendkurs beginnt nach der Arbeit.",
  },
  {
    id: "A1-SIM-01-L10", part: 2, order: 10, type: "single_choice", points: 1,
    passage: "A — www.tierarzt-west.de: Praxis für Hunde, Katzen und kleine Tiere.\n\nB — www.arztzentrum-west.de: Hausärzte und Kinderärzte.",
    prompt: "Ihre Katze ist krank.", choices: ab("www.tierarzt-west.de", "www.arztzentrum-west.de"),
    correct_answer: "A", explanation: "Eine kranke Katze muss zum Tierarzt.",
  },
  {
    id: "A1-SIM-01-L11", part: 3, order: 11, type: "true_false", points: 1,
    instruction: "Lesen Sie die Informationen und die Aufgaben 11 bis 15. Kreuzen Sie an: Richtig oder Falsch.",
    passage: "Arztpraxis Dr. Klein\nHeute Nachmittag geschlossen.\nIn dringenden Fällen: 030 445 82 11",
    prompt: "Heute Nachmittag kann man Dr. Klein besuchen.", choices: tf, correct_answer: "Falsch",
    explanation: "Die Praxis ist heute Nachmittag geschlossen.",
  },
  {
    id: "A1-SIM-01-L12", part: 3, order: 12, type: "true_false", points: 1,
    passage: "Café Morgen\nFrühstück Montag bis Samstag 7–11 Uhr\nSonntag 8–12 Uhr",
    prompt: "Am Sonntag gibt es bis 12 Uhr Frühstück.", choices: tf, correct_answer: "Richtig",
    explanation: "Sonntags wird Frühstück von 8 bis 12 Uhr angeboten.",
  },
  {
    id: "A1-SIM-01-L13", part: 3, order: 13, type: "true_false", points: 1,
    passage: "Aufzug außer Betrieb.\nBitte benutzen Sie die Treppe.",
    prompt: "Man kann heute mit dem Aufzug fahren.", choices: tf, correct_answer: "Falsch",
    explanation: "Der Aufzug ist außer Betrieb.",
  },
  {
    id: "A1-SIM-01-L14", part: 3, order: 14, type: "true_false", points: 1,
    passage: "Schwimmbad Nord\nWegen eines Kurses ist das große Becken von 16 bis 18 Uhr geschlossen. Das kleine Becken ist geöffnet.",
    prompt: "Zwischen 16 und 18 Uhr sind alle Becken geschlossen.", choices: tf, correct_answer: "Falsch",
    explanation: "Das kleine Becken bleibt geöffnet.",
  },
  {
    id: "A1-SIM-01-L15", part: 3, order: 15, type: "true_false", points: 1,
    passage: "Fahrrad zu verkaufen\nCitybike, drei Jahre alt, 90 Euro. Besichtigung am Wochenende möglich.",
    prompt: "Man kann das Fahrrad am Wochenende ansehen.", choices: tf, correct_answer: "Richtig",
    explanation: "Eine Besichtigung ist am Wochenende möglich.",
  },
];

const audio = (part) => `/exam-media/a1-sim-01/hoeren-teil-${part}.mp3`;
const horen = [
  [1, 1, "Was kostet der Pullover?", mc("25 Euro", "35 Euro", "45 Euro"), "B", "Frau: Entschuldigung, was kostet dieser Pullover?; Mann: Er kostet fünfunddreißig Euro. Heute ist er zehn Euro billiger.", "Der Pullover kostet 35 Euro."],
  [1, 2, "Wann fährt der Zug?", mc("um 9.10 Uhr", "um 9.20 Uhr", "um 9.30 Uhr"), "C", "Mann: Fährt der Zug nach Köln um neun Uhr zehn?; Frau: Nein, heute hat er zwanzig Minuten Verspätung. Er fährt um neun Uhr dreißig.", "Der Zug fährt um 9.30 Uhr."],
  [1, 3, "Was bestellt die Frau?", mc("Suppe", "Salat", "Fisch"), "B", "Mann: Möchten Sie die Suppe oder den Fisch?; Frau: Nein danke. Ich nehme nur einen Salat.", "Die Frau bestellt einen Salat."],
  [1, 4, "Wo treffen sie sich?", mc("vor dem Kino", "im Café", "am Bahnhof"), "A", "Frau: Treffen wir uns im Café?; Mann: Das ist heute geschlossen. Warte bitte um Viertel vor acht vor dem Kino.", "Sie treffen sich vor dem Kino."],
  [1, 5, "Wie kommt die Frau zur Arbeit?", mc("mit dem Bus", "mit dem Fahrrad", "mit dem Auto"), "B", "Mann: Fährst du morgens mit dem Bus zur Arbeit?; Frau: Nein, meistens fahre ich mit dem Fahrrad. Nur bei Regen nehme ich das Auto.", "Meistens fährt sie mit dem Fahrrad."],
  [1, 6, "Welche Zimmernummer hat Herr Yilmaz?", mc("214", "240", "241"), "C", "Frau: Herr Yilmaz liegt in Zimmer zweihunderteinundvierzig. Das ist im zweiten Stock.; Mann: Danke, Zimmer zweihunderteinundvierzig.", "Herr Yilmaz ist in Zimmer 241."],
  [2, 7, "Der Bus nach Zentrum fährt heute von Haltestelle C.", tf, "Richtig", "Ansage: Achtung, Fahrgäste der Linie zwölf Richtung Zentrum. Ihr Bus fährt heute nicht von Haltestelle A, sondern von Haltestelle C.", "Die Ansage nennt Haltestelle C."],
  [2, 8, "Das Kaufhaus schließt heute um 20 Uhr.", tf, "Falsch", "Ansage: Liebe Kundinnen und Kunden. Unser Kaufhaus schließt heute ausnahmsweise schon um neunzehn Uhr. Bitte gehen Sie jetzt zur Kasse.", "Das Kaufhaus schließt um 19 Uhr."],
  [2, 9, "Frau Sommer soll zur Information kommen.", tf, "Richtig", "Ansage: Frau Eva Sommer wird an der Information im Erdgeschoss erwartet. Frau Sommer, bitte kommen Sie zur Information.", "Frau Sommer wird zur Information gerufen."],
  [2, 10, "Der Flug nach Wien startet pünktlich.", tf, "Falsch", "Ansage: Der Flug fünfhundertachtzehn nach Wien startet heute vierzig Minuten später. Neuer Abflug ist um sechzehn Uhr zehn.", "Der Flug startet später."],
  [3, 11, "Wann soll Lara anrufen?", mc("vor 12 Uhr", "zwischen 12 und 14 Uhr", "nach 18 Uhr"), "B", "Ansage: Hallo Lara, hier ist Nina. Ruf mich bitte in der Mittagspause an, am besten zwischen zwölf und zwei. Am Abend bin ich nicht zu Hause.", "Lara soll zwischen 12 und 14 Uhr anrufen."],
  [3, 12, "Was soll Tom mitbringen?", mc("Brot", "Saft", "Kuchen"), "A", "Ansage: Hallo Tom. Für das Picknick haben wir schon Saft und Kuchen. Kannst du bitte Brot mitbringen? Danke.", "Tom soll Brot mitbringen."],
  [3, 13, "Warum kommt Frau Berg später?", mc("Sie arbeitet länger.", "Ihr Bus kommt nicht.", "Sie ist beim Arzt."), "C", "Ansage: Guten Tag, hier Berg. Ich komme heute eine halbe Stunde später ins Büro. Ich habe um acht Uhr noch einen Termin beim Arzt.", "Frau Berg hat einen Arzttermin."],
  [3, 14, "Wo liegt das Paket?", mc("bei der Nachbarin", "vor der Tür", "in der Postfiliale"), "A", "Ansage: Guten Tag, Paketdienst. Sie waren nicht zu Hause. Ihr Paket ist bei Ihrer Nachbarin Frau Winter, Wohnung zwölf.", "Das Paket ist bei Frau Winter."],
  [3, 15, "Wann beginnt der Deutschkurs?", mc("am Montag", "am Mittwoch", "am Freitag"), "B", "Ansage: Guten Tag, Sprachschule Aktiv. Ihr Deutschkurs beginnt nicht am Montag, sondern am Mittwoch, dem dritten September, um neun Uhr.", "Der Kurs beginnt am Mittwoch."],
].map(([part, order, prompt, choices, correct_answer, audio_script, explanation]) => ({
  id: `A1-SIM-01-H${String(order).padStart(2, "0")}`,
  part, order, type: part === 2 ? "true_false" : "single_choice", points: 1,
  instruction: part === 1
    ? "Was ist richtig? Wählen Sie A, B oder C. Sie hören jeden Text zweimal."
    : part === 2
      ? "Kreuzen Sie an: Richtig oder Falsch. Sie hören jeden Text einmal."
      : "Was ist richtig? Wählen Sie A, B oder C. Sie hören jeden Text zweimal.",
  prompt, choices, correct_answer, audio_script, explanation,
  audio_url: audio(part), playback_count: part === 2 ? 1 : 2,
}));

const schreiben = [
  {
    id: "A1-SIM-01-W01", part: 1, order: 1, type: "form_fill", automatic_grading: true,
    points: 5,
    instruction: "Ihr Freund Amir Rahmani möchte einen Deutschkurs besuchen. Er ist am 8. Februar 1998 in Rabat geboren. Seine Muttersprache ist Arabisch. Er möchte den Abendkurs ab 5. Oktober besuchen. Helfen Sie Amir und ergänzen Sie die fünf fehlenden Informationen.",
    source_data: { Familienname: "Rahmani", Geburtsdatum: "08.02.1998", Geburtsort: "Rabat", Muttersprache: "Arabisch", Kursbeginn: "05.10." },
    fields: ["Familienname", "Geburtsdatum", "Geburtsort", "Muttersprache", "Kursbeginn"].map((key) => ({ key, points: 1 })),
  },
  {
    id: "A1-SIM-01-W02", part: 2, order: 2, type: "writing", automatic_grading: false,
    points: 10,
    instruction: "Sie möchten am Samstag mit Ihrer Freundin Anna einen Ausflug machen. Schreiben Sie an Anna.",
    requirements: ["Warum schreiben Sie?", "Wohin möchten Sie fahren?", "Wann und wo treffen Sie sich?"],
    recommended_words: "environ 30",
    sample_answer: "Liebe Anna, hast du am Samstag Zeit? Ich möchte mit dir nach Potsdam fahren. Wir können den Park besuchen. Treffen wir uns um 9 Uhr am Bahnhof? Bitte antworte mir. Liebe Grüße, Samir",
    rubric: { content_point_1: 3, content_point_2: 3, content_point_3: 3, communicative_design: 1 },
    allowed_scores: { content_point_1: [0, 1.5, 3], content_point_2: [0, 1.5, 3], content_point_3: [0, 1.5, 3], communicative_design: [0, 0.5, 1] },
  },
];

const sprechen = [
  {
    id: "A1-SIM-01-SP01", part: 1, order: 1, type: "speaking", automatic_grading: false, points: 3,
    instruction: "Stellen Sie sich vor. Sprechen Sie über Name, Alter, Land, Wohnort, Sprachen, Beruf und Hobby. Buchstabieren Sie danach Ihren Familiennamen und nennen Sie Ihre Telefonnummer.",
    requirements: ["Sich vorstellen", "Ein Wort buchstabieren", "Eine Nummer nennen"],
    rubric: { introduction: 1, spelling: 1, number: 1 },
    allowed_scores: { introduction: [0, 0.5, 1], spelling: [0, 0.5, 1], number: [0, 0.5, 1] },
  },
  {
    id: "A1-SIM-01-SP02", part: 2, order: 2, type: "speaking", automatic_grading: false, points: 6,
    instruction: "Bitten Sie um Informationen und geben Sie Informationen. Stellen und beantworten Sie zu jedem Thema eine einfache Frage.",
    requirements: ["Thema Einkaufen — Karte: Preis", "Thema Wochenende — Karte: Freunde"],
    rubric: { question_1: 1.5, answer_1: 1.5, question_2: 1.5, answer_2: 1.5 },
    allowed_scores: { question_1: [0, 0.75, 1.5], answer_1: [0, 0.75, 1.5], question_2: [0, 0.75, 1.5], answer_2: [0, 0.75, 1.5] },
  },
  {
    id: "A1-SIM-01-SP03", part: 3, order: 3, type: "speaking", automatic_grading: false, points: 6,
    instruction: "Formulieren Sie Bitten und reagieren Sie auf Bitten Ihres Partners oder Ihrer Partnerin.",
    requirements: ["Karte 1: ein Glas Wasser", "Karte 2: das Fenster schließen"],
    rubric: { request_1: 1.5, response_1: 1.5, request_2: 1.5, response_2: 1.5 },
    allowed_scores: { request_1: [0, 0.75, 1.5], response_1: [0, 0.75, 1.5], request_2: [0, 0.75, 1.5], response_2: [0, 0.75, 1.5] },
  },
];

const exam = {
  schema_version: "2.0",
  bank: { name: "German Academy — simulation A1 complète", level: "A1", language: "de", exams_count: 1 },
  exams: [{
    id: "A1-SIM-01",
    level: "A1",
    format_profile: "goethe_a1_adult_v1",
    title: "Examen blanc A1 complet — Alltag",
    subtitle: "Simulation indépendante A1 adultes — non affiliée au Goethe-Institut",
    duration_minutes: 80,
    written_duration_minutes: 65,
    speaking_duration_minutes: 15,
    total_points: 60,
    automatic_points: 35,
    manual_points: 25,
    conversion_factor: 1.66,
    pass_score_100: 60,
    sections: [
      { id: "A1-SIM-01-HOEREN", type: "hoeren", title: "Hören", max_points: 15, duration_minutes: 20, questions: horen },
      { id: "A1-SIM-01-LESEN", type: "lesen", title: "Lesen", max_points: 15, duration_minutes: 25, questions: lesen },
      { id: "A1-SIM-01-SCHREIBEN", type: "schreiben", title: "Schreiben", max_points: 15, duration_minutes: 20, questions: schreiben },
      { id: "A1-SIM-01-SPRECHEN", type: "sprechen", title: "Sprechen", max_points: 15, duration_minutes: 15, questions: sprechen },
    ],
  }],
};

mkdirSync("data/exams/a1-complete", { recursive: true });
writeFileSync("data/exams/a1-complete/a1-sim-01.json", `${JSON.stringify(exam, null, 2)}\n`);
console.log("Wrote data/exams/a1-complete/a1-sim-01.json");

