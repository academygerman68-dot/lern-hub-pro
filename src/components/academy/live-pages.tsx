import { useEffect, useMemo, useState } from "react";
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Send,
  Users,
  Video,
} from "lucide-react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClasses } from "@/hooks/use-academy-data";
import { useRealAccount } from "@/hooks/use-real-account";
import { clearLiveClassId, getLiveClassId, setLiveClassId } from "@/lib/live-class-session";
import { useAcademy } from "./academy-context";
import { QueryState } from "./query-state";
import { PageHeader, Status, Surface } from "./primitives";

export function LiveClassesPage({ meeting }: { meeting: boolean }) {
  const account = useRealAccount();

  if (account.checking) return <div className="min-h-[50vh] bg-background" />;
  if (!account.authenticated) return <RealAccountRequired />;
  if (meeting) return <LiveMeetingRoom />;
  return <LiveClassLobby />;
}

function RealAccountRequired() {
  const { l, setRole } = useAcademy();
  return (
    <Surface className="mx-auto max-w-xl space-y-4 p-8 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-lg bg-secondary text-primary">
        <Lock className="size-5" />
      </span>
      <h2 className="text-xl font-semibold">
        {l("Compte réel requis", "مطلوب حساب حقيقي")}
      </h2>
      <p className="text-sm text-muted-foreground">
        {l(
          "Les cours en direct sont réservés aux comptes réels de l’académie. Connectez-vous avec votre adresse e-mail et votre mot de passe pour rejoindre une salle.",
          "الدروس المباشرة مخصّصة لحسابات الأكاديمية الحقيقية. سجّل الدخول ببريدك الإلكتروني وكلمة المرور للانضمام إلى القاعة.",
        )}
      </p>
      <Button onClick={() => setRole(null)}>
        {l("Se connecter avec un compte réel", "تسجيل الدخول بحساب حقيقي")}
      </Button>
    </Surface>
  );
}

function LiveClassLobby() {
  const { navigate } = useAcademy();
  const classesQuery = useClasses();
  const liveEligible = useMemo(
    () =>
      (classesQuery.data ?? []).filter(
        (item) => item.status === "active" || item.status === "planned",
      ),
    [classesQuery.data],
  );

  return (
    <>
      <PageHeader
        title="Live Classes"
        subtitle="Join an authorized class room. Access is validated by the academy backend."
      />
      <QueryState
        isLoading={classesQuery.isLoading}
        isError={classesQuery.isError}
        error={classesQuery.error}
        isEmpty={liveEligible.length === 0}
        emptyTitle="No live classes available"
        emptyMessage="When you are enrolled in (or assigned to) an active class, it will appear here."
        onRetry={() => void classesQuery.refetch()}
      >
        <div className="space-y-3">
          {liveEligible.map((item) => (
            <Surface className="p-5" key={item.id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <span className="grid size-12 place-items-center rounded-lg bg-secondary text-primary">
                  <Video className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold">{item.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.level} · {item.schedule || "Schedule TBD"} ·{" "}
                    {item.teacher || "Teacher TBD"}
                  </p>
                </div>
                <Status tone={item.status === "active" ? "green" : "amber"}>{item.status}</Status>
                <Button
                  onClick={() => {
                    setLiveClassId(item.id);
                    navigate("meeting");
                  }}
                >
                  <Video className="size-4" />
                  Rejoindre le cours
                </Button>
              </div>
            </Surface>
          ))}
        </div>
      </QueryState>
    </>
  );
}

function LiveMeetingRoom() {
  const { navigate, l } = useAcademy();
  const classesQuery = useClasses();
  const [classId, setClassId] = useState<string | null>(null);
  const [clientReady, setClientReady] = useState(false);
  const [microphoneOn, setMicrophoneOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([
    l("Anna : Bonjour à tous, nous commençons dans un instant.", "آنا: مرحباً بالجميع، سنبدأ بعد لحظات."),
    l("Youssef : Bonjour professeure !", "يوسف: مرحباً أستاذة!"),
  ]);
  const selectedClass = (classesQuery.data ?? []).find((item) => item.id === classId);

  useEffect(() => {
    setClassId(getLiveClassId());
    setClientReady(true);
  }, []);

  const leave = () => {
    clearLiveClassId();
    navigate("live");
  };

  if (!clientReady) return <div className="min-h-[50vh] bg-background" />;

  if (!classId) {
    return (
      <Surface className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <Video className="mx-auto size-8 text-primary" />
        <h2 className="text-lg font-semibold">{l("Aucun cours sélectionné", "لم يتم اختيار درس")}</h2>
        <p className="text-sm text-muted-foreground">
          {l("Choisissez d’abord un cours dans l’espace Live.", "اختر درساً أولاً من مساحة البث المباشر.")}
        </p>
        <Button onClick={() => navigate("live")}>{l("Retour aux cours", "العودة إلى الدروس")}</Button>
      </Surface>
    );
  }

  return (
    <div className="-m-4 flex min-h-[calc(100vh-4.25rem)] flex-col bg-meeting text-primary-foreground sm:-m-7">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-primary-foreground/10 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="text-xs text-primary-foreground/60">
            {l("Cours en direct · Salle de démonstration", "درس مباشر · قاعة تجريبية")}
          </p>
          <h1 className="truncate text-lg font-semibold">
            {selectedClass?.name ?? l("A2 — Groupe 02", "A2 — المجموعة 02")}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Status tone="green">{l("En direct", "مباشر")}</Status>
          <Button variant="destructive" size="sm" onClick={leave}>
            <PhoneOff className="size-4" />
            {l("Quitter", "مغادرة")}
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-px bg-primary-foreground/10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="flex min-h-[34rem] flex-col bg-meeting p-4 sm:p-6">
          <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-md bg-meeting-panel">
            <div className="text-center">
              <div className="mx-auto grid size-24 place-items-center rounded-full bg-primary text-3xl font-semibold text-primary-foreground shadow-lg">AS</div>
              <h2 className="mt-5 text-xl font-semibold">Anna Schneider</h2>
              <p className="mt-1 text-sm text-primary-foreground/60">
                {l("Professeure · Conversation au bureau", "الأستاذة · محادثة في المكتب")}
              </p>
            </div>
            <span className="absolute top-4 left-4 rounded-sm bg-alert px-2 py-1 text-xs font-semibold text-primary-foreground">LIVE</span>
            <div className="absolute right-4 bottom-4 flex gap-2">
              {["AB", "YE", "SM"].map((initials) => (
                <span key={initials} className="grid size-10 place-items-center rounded-md border border-primary-foreground/15 bg-meeting text-xs font-semibold">{initials}</span>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button size="icon" variant={microphoneOn ? "secondary" : "destructive"} onClick={() => setMicrophoneOn((value) => !value)} aria-label={l("Activer ou couper le microphone", "تشغيل أو كتم الميكروفون")}>
              {microphoneOn ? <Mic /> : <MicOff />}
            </Button>
            <Button size="icon" variant={cameraOn ? "secondary" : "destructive"} onClick={() => setCameraOn((value) => !value)} aria-label={l("Activer ou couper la caméra", "تشغيل أو إيقاف الكاميرا")}>
              {cameraOn ? <Camera /> : <CameraOff />}
            </Button>
            <Button size="icon" variant="secondary" aria-label={l("Partager l’écran", "مشاركة الشاشة")}>
              <MonitorUp />
            </Button>
            <Button size="icon" variant="secondary" aria-label={l("Voir les participants", "عرض المشاركين")}>
              <Users />
            </Button>
          </div>
        </section>

        <aside className="flex min-h-[22rem] flex-col bg-meeting-panel p-4">
          <div className="border-b border-primary-foreground/10 pb-3">
            <h2 className="font-semibold">{l("Discussion du cours", "محادثة الدرس")}</h2>
            <p className="mt-1 text-xs text-primary-foreground/55">15 {l("participants", "مشاركاً")}</p>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto py-4">
            {messages.map((item, index) => (
              <div key={`${item}-${index}`} className="rounded-md bg-primary-foreground/8 p-3 text-sm leading-6">{item}</div>
            ))}
          </div>
          <form className="flex gap-2 border-t border-primary-foreground/10 pt-3" onSubmit={(event) => {
            event.preventDefault();
            const value = message.trim();
            if (!value) return;
            setMessages((items) => [...items, value]);
            setMessage("");
          }}>
            <input className="min-w-0 flex-1 rounded-md border border-primary-foreground/15 bg-meeting px-3 text-sm text-primary-foreground outline-none placeholder:text-primary-foreground/40" value={message} onChange={(event) => setMessage(event.target.value)} placeholder={l("Écrire un message…", "اكتب رسالة…")} />
            <Button size="icon" type="submit" aria-label={l("Envoyer", "إرسال")}><Send /></Button>
          </form>
        </aside>
      </div>
    </div>
  );
}
