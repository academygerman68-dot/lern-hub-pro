import type { Locale } from "@/types/academy";

const fr = {
  "brand.tagline": "Apprendre l’allemand. Construire l’avenir.",
  "login.welcome": "Bon retour",
  "login.title": "Connexion à l’académie",
  "login.subtitle": "Reprenez votre parcours d’allemand.",
  "login.email": "E-mail",
  "login.password": "Mot de passe",
  "login.forgot": "Mot de passe oublié ?",
  "login.submit": "Se connecter",
  "login.signing": "Connexion…",
  "login.demo": "ACCÈS DÉMO RAPIDE",
  "login.footer": "Environnement prototype · Données de démonstration",
  "login.invalid": "E-mail ou mot de passe incorrect.",
  "login.reset": "Si cet e-mail existe, un lien de réinitialisation a été envoyé.",
  "nav.home": "Accueil",
  "nav.overview": "Vue d’ensemble",
  "nav.learning": "Apprentissage",
  "nav.live": "Direct",
  "nav.assignments": "Devoirs",
  "nav.exams": "Examens",
  "nav.progress": "Progression",
  "nav.payments": "Paiements",
  "nav.messages": "Messages",
  "nav.profile": "Profil",
  "nav.materials": "Ressources",
  "nav.calendar": "Calendrier",
  "nav.classes": "Mes classes",
  "nav.lessons": "Leçons",
  "nav.attendance": "Présences",
  "nav.students": "Étudiants",
  "nav.teachers": "Professeurs",
  "nav.courses": "Cours",
  "nav.levels": "Niveaux",
  "nav.subscriptions": "Abonnements",
  "nav.invoices": "Factures",
  "nav.reports": "Rapports",
  "nav.settings": "Paramètres",
  "nav.audit": "Journal d’audit",
  "nav.signout": "Déconnexion",
  "shell.admin": "Administration de l’académie",
  "shell.teacher": "Studio pédagogique",
  "shell.student": "Lundi · 14 septembre",
  "shell.notifications": "Notifications",
  "role.student": "Étudiant",
  "role.teacher": "Professeur",
  "role.director": "Direction",
};

const ar: typeof fr = {
  "brand.tagline": "تعلّم الألمانية. وابنِ مستقبلك.",
  "login.welcome": "مرحباً بعودتك",
  "login.title": "تسجيل الدخول إلى الأكاديمية",
  "login.subtitle": "واصل رحلتك في تعلّم اللغة الألمانية.",
  "login.email": "البريد الإلكتروني",
  "login.password": "كلمة المرور",
  "login.forgot": "نسيت كلمة المرور؟",
  "login.submit": "تسجيل الدخول",
  "login.signing": "جارٍ تسجيل الدخول…",
  "login.demo": "دخول سريع للعرض التجريبي",
  "login.footer": "بيئة تجريبية · بيانات توضيحية فقط",
  "login.invalid": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  "login.reset": "إذا كان الحساب موجوداً، فسيتم إرسال رابط الاستعادة.",
  "nav.home": "الرئيسية",
  "nav.overview": "نظرة عامة",
  "nav.learning": "التعلّم",
  "nav.live": "الدروس المباشرة",
  "nav.assignments": "الواجبات",
  "nav.exams": "الامتحانات",
  "nav.progress": "التقدّم",
  "nav.payments": "المدفوعات",
  "nav.messages": "الرسائل",
  "nav.profile": "الملف الشخصي",
  "nav.materials": "الموارد",
  "nav.calendar": "التقويم",
  "nav.classes": "صفوفي",
  "nav.lessons": "الدروس",
  "nav.attendance": "الحضور",
  "nav.students": "الطلاب",
  "nav.teachers": "الأساتذة",
  "nav.courses": "الدورات",
  "nav.levels": "المستويات",
  "nav.subscriptions": "الاشتراكات",
  "nav.invoices": "الفواتير",
  "nav.reports": "التقارير",
  "nav.settings": "الإعدادات",
  "nav.audit": "سجل النشاط",
  "nav.signout": "تسجيل الخروج",
  "shell.admin": "إدارة الأكاديمية",
  "shell.teacher": "مساحة التدريس",
  "shell.student": "الاثنين · 14 سبتمبر",
  "shell.notifications": "الإشعارات",
  "role.student": "طالب",
  "role.teacher": "أستاذ",
  "role.director": "الإدارة",
};

const dictionaries: Record<Locale, Record<string, string>> = { fr, ar };

export function translate(locale: Locale, key: string) {
  return dictionaries[locale][key] ?? dictionaries.fr[key] ?? key;
}

export function translateKnownValue(locale: Locale, value: string) {
  for (const dictionaryKey of Object.keys(dictionaries.fr)) {
    const key = dictionaryKey as keyof typeof fr;
    if (dictionaries.fr[key] === value || dictionaries.ar[key] === value) {
      return dictionaries[locale][key] ?? value;
    }
  }
  return value;
}

export const localeLabels: Record<Locale, string> = { fr: "FR", ar: "العربية" };
