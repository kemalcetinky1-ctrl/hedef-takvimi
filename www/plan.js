// Onboarding questions + rule-based plan generator. Runs fully on the device.
// Each habit question: yes/no, then (if it has amounts) "how much per day?". A "yes" becomes a habit + a monthly goal line.
(function () {
const Q = {
  tr: {
    wzNext: "Devam", wzBack: "Geri", wzSkip: "Atla", yes: "Evet 👍", no: "Hayır",
    wzStep: "{a} / {b}",
    qGoal: "Bu yıl ulaşmak istediğin en büyük hedef ne?", qGoalH: "Tek cümle yeter. Örn: 1 milyon TL kazanmak, 10 kilo vermek, akıcı İngilizce.", qGoalPh: "Büyük hedefim…",
    qDay: "Günün nasıl geçiyor?", qDayWake: "Genelde kaçta kalkıp kaçta yatıyorsun?", qDayPart: "Günün hangi saatinde daha verimlisin?",
    howMuch: "Harika! Günde ne kadar ayırabilirsin?",
    packPrice: "Bir paketin fiyatı", cur: "Para birimi", priceQ: "Bir paket sigarayı kaça alıyorsun?", priceHint: "Kendi aldığın markanın fiyatını yaz. Türkiye'de paketler genelde 115–140 ₺.", perDay: "Günde {d} harcıyorsun. Bırakırsan bu para senin. 💰",
    smokeTitle: "🚭 Sigarasız {n} gün", smokeSaved: "{m} biriktirdin", smokeHint: "Bu parayı kenara koy ya da yatırıma ayır. Ayda {mo}, 1 yılda {y} birikir.", smokeZero: "Bugün içmezsen {m} cebinde kalır. 💪", smokeSet: "Sigara: günde kaç paket ve fiyatı",
    q6: "Planın hazır ✨", q6h: "İstemediğini sil, eksik olanı ekle. Sonra Ayarlar'dan da değiştirebilirsin.",
    startPlan: "Bu planla başla",
    routine: "Günlük rutin", routineHint: "Bu maddeler her yeni günün planına kendiliğinden eklenir.",
    newRoutine: "Yeni rutin maddesi", redo: "Soruları yeniden cevapla", redoHint: "Yeni plan oluşturur. Geçmiş işaretlerin ve notların silinmez.",
    parts: ["🌅 Sabah", "☀️ Öğle", "🌙 Akşam"],
    QS: {
      read:   { q: "Kitap okumayı sever misin?", sub: "Her gün biraz okumaya ne dersin?", amts: ["15 dk", "30 dk", "1 saat", "2 saat"], h: "📖 Kitap oku ({a})", g: "Okuma: bu ay en az 1 kitap bitir" },
      sport:  { q: "Egzersiz yapabilir misin?", sub: "Yürüyüş, spor salonu, ev egzersizi… hepsi sayılır.", amts: ["15 dk", "30 dk", "45 dk", "1 saat"], h: "🏋️ Egzersiz ({a})", g: "Sağlık: haftada en az 5 gün hareket" },
      lang:   { q: "İngilizce çalışmak ister misin?", sub: "Ya da öğrenmek istediğin başka bir dil.", amts: ["15 dk", "30 dk", "45 dk", "1 saat"], h: "🇬🇧 İngilizce çalış ({a})", g: "Dil: ay sonunda 5 dakika İngilizce konuşabil" },
      work:   { q: "İşin ya da kariyerin için her gün odaklı çalışmak ister misin?", sub: "Telefonsuz, tek işe odaklandığın bir zaman dilimi.", amts: ["30 dk", "1 saat", "2 saat", "3 saat"], h: "💼 Odaklı çalışma ({a})", g: "Kariyer: her hafta 1 somut çıktı (proje, başvuru, müşteri)" },
      money:  { q: "Harcamalarını takip etmek ister misin?", sub: "Her akşam o günün harcamalarını yazarsın.", amts: null, h: "💰 Harcamalarını yaz", g: "Para: ay sonunda harcamalarını çıkar, birikim tutarını belirle" },
      mind:   { q: "Her gün meditasyon yapmak ya da rahatlamak ister misin?", sub: "Nefes, sessizlik ya da günlük yazmak. Zihnini toplamak için kısa bir mola.", amts: ["5 dk", "10 dk", "20 dk"], h: "🧘 Meditasyon / rahatlama ({a})", g: "Zihin: her gün kendine sessiz bir an ayır" },
      pray:   { q: "Her gün namaz kılmak ister misin?", sub: "İnancın varsa, gününe manevi bir düzen katar.", amts: ["5 vakit", "Kılabildiğim kadar"], amtQ: "Hedefin hangisi?", h: "🕌 Namaz ({a})", g: "Maneviyat: namazlarını aksatmadan kıl" },
      social: { q: "Sosyal medyayı azaltmak ister misin?", sub: "Telefonda kaybolan saatleri hedeflerine geri kazan.", amts: ["30 dk", "1 saat", "2 saat"], amtQ: "Günde en fazla ne kadar bakmak istersin?", h: "📵 Sosyal medya en fazla {a}", g: "Odak: sosyal medyayı günlük sınırının altında tut" },
      smoke:  { q: "Sigarayı bırakmak ister misin?", sub: "Her sigarasız gün hem sağlığına hem cebine yazılır.", amts: ["Yarım paket", "1 paket", "1,5 paket", "2 paket"], amtQ: "Günde ne kadar içiyorsun?", h: "🚭 Bugün sigara içmedim", g: "Sigara: bu ay biriktirdiğin parayı kenara koy" },
      create: { q: "İçerik üretmek ister misin?", sub: "Yazı, video, çizim, müzik…", amts: ["15 dk", "30 dk", "1 saat", "2 saat"], h: "🎨 Üret ({a})", g: "Üretkenlik: haftada 2 içerik yayınla" },
      family: { q: "Sevdiklerine her gün vakit ayırmak ister misin?", sub: "Ailen, partnerin, arkadaşların.", amts: ["15 dk", "30 dk", "1 saat"], h: "❤️ Sevdiklerine vakit ({a})", g: "İlişkiler: haftada 1 kez sevdiklerinle plansız vakit" },
      care:   { q: "Günlük kişisel bakım yapıyor musun?", sub: "Cilt bakımı, tıraş, saç… Gün sonunda kendine ayırdığın birkaç dakika.", amts: ["5 dk", "10 dk", "15 dk", "20 dk"], h: "🧴 Kişisel bakım ({a})", g: "Bakım: her akşam kendine birkaç dakika ayır" },
      water:  { q: "Günde yeterince su içiyor musun?", sub: "Evet dersen günde 2 litre suyu plana eklerim.", amts: null, h: "💧 2 litre su iç", g: null, yesLabel: "Ekle 💧", noLabel: "Gerek yok" },
      sleep:  { q: "Her gün aynı saatte yatmak ister misin?", sub: "Düzenli uyku, diğer bütün hedeflerin yakıtıdır.", amts: null, h: "😴 Yatış saati: {s}", g: "Uyku: her gün aynı saatte yat ve kalk" }
    },
    bigGoal: "🎯 Büyük hedef: {g} → bu ay ilk somut adımı at",
    R: { wake: "Kalk, su iç, günün 3 önceliğini seç", focus: "Odak bloğu: {g}", review: "Günü değerlendir, yarını planla", sleep: "Ekranı bırak, yatışa hazırlan" },
    focusDefault: "en önemli işin"
  },
  en: {
    wzNext: "Next", wzBack: "Back", wzSkip: "Skip", yes: "Yes 👍", no: "No",
    wzStep: "{a} / {b}",
    qGoal: "What's the biggest goal you want to reach this year?", qGoalH: "One sentence is enough. E.g. save $10k, lose 10 kg, speak fluent English.", qGoalPh: "My big goal…",
    qDay: "What does your day look like?", qDayWake: "When do you usually get up and go to bed?", qDayPart: "When are you most productive?",
    howMuch: "Great! How much time a day can you give it?",
    packPrice: "Price of one pack", cur: "Currency", priceQ: "How much do you pay for one pack?", priceHint: "Type the price of the brand you buy.", perDay: "You spend {d} a day. Quit and it's yours. 💰",
    smokeTitle: "🚭 {n} smoke-free days", smokeSaved: "You saved {m}", smokeHint: "Put this money aside or invest it. That's {mo} a month and {y} a year.", smokeZero: "Skip it today and {m} stays in your pocket. 💪", smokeSet: "Smoking: packs per day and price",
    q6: "Your plan is ready ✨", q6h: "Delete what you don't want, add what's missing. You can change it later in Settings.",
    startPlan: "Start with this plan",
    routine: "Daily routine", routineHint: "These items are added to every new day's plan automatically.",
    newRoutine: "New routine item", redo: "Answer the questions again", redoHint: "Builds a new plan. Your past marks and notes are kept.",
    parts: ["🌅 Morning", "☀️ Midday", "🌙 Evening"],
    QS: {
      read:   { q: "Do you like reading books?", sub: "How about reading a little every day?", amts: ["15 min", "30 min", "1 hour", "2 hours"], h: "📖 Read ({a})", g: "Reading: finish at least 1 book this month" },
      sport:  { q: "Can you exercise?", sub: "Walking, gym, home workouts… it all counts.", amts: ["15 min", "30 min", "45 min", "1 hour"], h: "🏋️ Exercise ({a})", g: "Health: move at least 5 days a week" },
      lang:   { q: "Do you want to learn a language?", sub: "English, Spanish, German… any language.", amts: ["15 min", "30 min", "45 min", "1 hour"], h: "🗣️ Language practice ({a})", g: "Language: speak for 5 minutes by month end" },
      work:   { q: "Do you want daily deep work for your job or career?", sub: "Phone away, one task, full focus.", amts: ["30 min", "1 hour", "2 hours", "3 hours"], h: "💼 Deep work ({a})", g: "Career: 1 concrete output every week (project, application, client)" },
      money:  { q: "Do you want to track your spending?", sub: "Each evening you write down what you spent.", amts: null, h: "💰 Log your spending", g: "Money: review spending at month end, set a savings amount" },
      mind:   { q: "Would you like to meditate or relax every day?", sub: "Breathing, silence or journaling. A short break to clear your head.", amts: ["5 min", "10 min", "20 min"], h: "🧘 Meditate / relax ({a})", g: "Mind: a quiet moment for yourself every day" },
      pray:   { q: "Would you like to pray every day?", sub: "If you have a faith, it adds a spiritual rhythm to your day.", amts: ["Every prayer", "As often as I can"], amtQ: "What is your aim?", h: "🙏 Prayer ({a})", g: "Faith: keep your daily prayers" },
      social: { q: "Do you want to cut down on social media?", sub: "Win back the hours lost on your phone.", amts: ["30 min", "1 hour", "2 hours"], amtQ: "What's your daily limit?", h: "📵 Social media max {a}", g: "Focus: stay under your daily social media limit" },
      smoke:  { q: "Do you want to quit smoking?", sub: "Every smoke-free day pays off for your health and your wallet.", amts: ["Half a pack", "1 pack", "1.5 packs", "2 packs"], amtQ: "How much do you smoke a day?", h: "🚭 No cigarettes today", g: "Smoking: set aside the money you save this month" },
      create: { q: "Do you want to create content?", sub: "Writing, video, drawing, music…", amts: ["15 min", "30 min", "1 hour", "2 hours"], h: "🎨 Create ({a})", g: "Creating: publish 2 pieces a week" },
      family: { q: "Do you want daily time with loved ones?", sub: "Family, partner, friends.", amts: ["15 min", "30 min", "1 hour"], h: "❤️ Time with loved ones ({a})", g: "Relationships: unplanned time with loved ones once a week" },
      care:   { q: "Do you have a daily self-care routine?", sub: "Skincare, shaving, hair… a few minutes for yourself at the end of the day.", amts: ["5 min", "10 min", "15 min", "20 min"], h: "🧴 Self-care ({a})", g: "Self-care: a few minutes for yourself every evening" },
      water:  { q: "Do you drink enough water?", sub: "Tap Add and I'll put 2 litres a day in your plan.", amts: null, h: "💧 Drink 2 litres of water", g: null, yesLabel: "Add 💧", noLabel: "No need" },
      sleep:  { q: "Do you want to go to bed at the same time every day?", sub: "Good sleep fuels every other goal.", amts: null, h: "😴 Bedtime: {s}", g: "Sleep: same bedtime and wake time every day" }
    },
    bigGoal: "🎯 Big goal: {g} → take the first concrete step this month",
    R: { wake: "Get up, drink water, pick today's top 3", focus: "Focus block: {g}", review: "Review the day, plan tomorrow", sleep: "Screens off, get ready for bed" },
    focusDefault: "your most important task"
  }
};
Object.keys(Q).forEach(l => Object.assign(I18N[l], Q[l]));

const ORDER = ["read", "sport", "lang", "work", "money", "mind", "pray", "social", "smoke", "create", "family", "water", "care", "sleep"];
const toMin = s => { const [h, m] = (s || "0:0").split(":").map(Number); return h * 60 + m; };
const toHM = m => { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };

// answers: {goal, wake, sleep, part, yes:{id:amountIndex|-1}}
function build(lang, a, uid) {
  const L = I18N[lang] || I18N.en; const QS = L.QS; const yes = a.yes || {};
  const habits = [], goals = [];
  if ((a.goal || "").trim()) goals.push(L.bigGoal.replace("{g}", a.goal.trim()));
  ORDER.forEach(id => { if (!(id in yes)) return; const q = QS[id]; const amt = q.amts ? q.amts[yes[id]] || q.amts[1] || q.amts[0] : "";
    const hb = { id: uid(), name: q.h.replace("{a}", amt).replace("{s}", a.sleep || "23:00") }; if (id === "smoke") hb.kind = "smoke";
    habits.push(hb); if (q.g) goals.push("- " + q.g); });
  const smoke = ("smoke" in yes) ? { packs: [0.5, 1, 1.5, 2][yes.smoke < 0 ? 1 : yes.smoke], price: +a.price || 0, cur: a.cur || "₺" } : null;
  const wake = toMin(a.wake || "07:00"), sleep = toMin(a.sleep || "23:30");
  const focusAt = [wake + 60, 13 * 60, Math.max(wake + 60, sleep - 210)][a.part || 0];
  const focusLen = "work" in yes ? " (" + QS.work.amts[yes.work] + ")" : "";
  const routine = [
    { id: uid(), time: toHM(wake), t: L.R.wake },
    { id: uid(), time: toHM(focusAt), t: L.R.focus.replace("{g}", (a.goal || "").trim() || L.focusDefault) + focusLen },
    { id: uid(), time: toHM(sleep - 45), t: L.R.review },
    { id: uid(), time: toHM(sleep - 20), t: L.R.sleep }
  ];
  return { habits, goals: goals.join("\n"), routine, smoke };
}
window.PLAN = { ORDER, build };
})();
