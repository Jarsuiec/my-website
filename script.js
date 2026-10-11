(function () {
  var cfg = window.SITE_CONFIG || { services: [] };

  // ---------- Тексты на трёх языках ----------
  var T = {
    ru: {
      "pr.title": "Что случилось?", "pr.slow": "Тормозит и долго грузится", "pr.hot": "Греется и шумит", "pr.boot": "Не загружается Windows", "pr.fps": "Мало FPS в играх", "pr.buy": "Хочу купить или собрать ПК", "tg.float": "Написать в Telegram",
      "nav.services": "Услуги", "nav.how": "Как работаю", "nav.faq": "Вопросы", "nav.contact": "Оставить заявку",
      "hero.tag": "Варшава · Прушкув · удалённо по всей Польше",
      "hero.title": "Компьютер тормозит, греется или не включается? Помогу — на понятном вам языке.",
      "hero.sub": "Переустановка Windows, чистка и замена термопасты, установка SSD, сборка и настройка игровых ПК. Объясняю, что сломалось и сколько стоит, до начала работы.",
      "hero.cta": "Описать проблему",
      "hero.f1": "Опыт сервисного мастера с 2021 года", "hero.f2": "Русский, українська, polski", "hero.f3": "Цена согласуется до начала работы",
      "services.title": "Услуги и ориентировочные цены",
      "services.note": "Точная цена зависит от модели и состояния устройства. Запчасти оплачиваются отдельно по чеку.",
      "from": "от", "currency": "zł",
      "how.title": "Как это работает",
      "how.s1t": "Заявка", "how.s1": "Напишите, что случилось: форма ниже или мессенджер.",
      "how.s2t": "Предварительная оценка", "how.s2": "Задам пару вопросов и назову ориентировочную цену и срок.",
      "how.s3t": "Работа", "how.s3": "Удалённо, с выездом или вы привозите устройство — как удобнее.",
      "how.s4t": "Проверка и оплата", "how.s4": "Тестируем вместе, объясняю, что было сделано. Оплата после результата.",
      "faq.title": "Частые вопросы",
      "faq.q1": "Можно ли решить проблему удалённо?",
      "faq.a1": "Многие программные проблемы — да: настройка Windows, драйверы, программы, медленная работа. Нужен интернет и бесплатная программа удалённого доступа, которую я помогу установить. Вы видите всё, что я делаю.",
      "faq.q2": "Сохранятся ли мои файлы при переустановке Windows?",
      "faq.a2": "Перед переустановкой обсуждаем, какие данные важны, и сохраняем их. Если диск повреждён, честно скажу об этом заранее.",
      "faq.q3": "Что вы не делаете?",
      "faq.a3": "Не меняю матрицы (экраны) и не занимаюсь пайкой материнских плат. В таких случаях подскажу, куда обратиться.",
      "faq.q4": "Помогаете выбрать компьютер или комплектующие?",
      "faq.a4": "Да. Подберу конфигурацию под ваш бюджет и задачи (работа, учёба, игры, стриминг), проверю совместимость и могу собрать ПК.",
      "form.title": "Оставить заявку", "form.sub": "Отвечаю обычно в течение дня. Вечером и в выходные — тоже.",
      "form.name": "Имя", "form.contact": "Телефон или Telegram", "form.service": "Что нужно сделать",
      "form.where": "Где удобно", "form.w1": "Удалённо", "form.w2": "Выезд (Варшава / Прушкув)", "form.w3": "Привезу сам(а)",
      "form.desc": "Опишите проблему и модель устройства",
      "form.descPh": "Например: ноутбук Lenovo, после включения долго грузится и шумит",
      "form.consent": "Согласен(на) на обработку моих данных для ответа на заявку.",
      "form.send": "Отправить заявку",
      "form.ok": "Спасибо! Заявка отправлена, скоро свяжусь с вами.",
      "form.err": "Не удалось отправить. Напишите, пожалуйста, в мессенджер или попробуйте ещё раз.",
      "form.sending": "Отправляю…",
      "form.privacy": "Данные из формы используются только для связи по вашей заявке, не передаются третьим лицам для рекламы и удаляются по вашей просьбе.",
      "form.other": "Другое / не знаю",
      "foot.area": "Варшава, Прушкув и окрестности",
      "s.windows": ["Переустановка Windows", "Установка, драйверы, базовые программы, перенос важных файлов"],
      "s.cleaning": ["Чистка и замена термопасты", "Ноутбук или ПК греется, шумит, выключается под нагрузкой"],
      "s.ssd": ["Установка SSD", "Замена HDD на SSD с переносом системы — компьютер в разы быстрее"],
      "s.speedup": ["Ускорение старого ноутбука", "Автозагрузка, лишние программы, настройка Windows"],
      "s.remote": ["Удалённая помощь", "Программы, ошибки, настройки — без выезда, через интернет"],
      "s.gaming": ["Игровой ПК: FPS и настройка", "Диагностика просадок FPS, настройка Windows и игр (CS2, Warzone)"],
      "s.build": ["Сборка ПК", "Сборка, настройка BIOS, установка системы и тестирование"],
      "s.advice": ["Подбор комплектующих", "Конфигурация под бюджет, проверка совместимости, консультация перед покупкой"],
      "s.wifi": ["Wi‑Fi и роутер", "Настройка интернета, слабый сигнал, подключение устройств"]
    },
    uk: {
      "pr.title": "Що сталося?", "pr.slow": "Гальмує і довго вантажиться", "pr.hot": "Гріється і шумить", "pr.boot": "Не завантажується Windows", "pr.fps": "Мало FPS в іграх", "pr.buy": "Хочу купити або зібрати ПК", "tg.float": "Написати в Telegram",
      "nav.services": "Послуги", "nav.how": "Як працюю", "nav.faq": "Питання", "nav.contact": "Залишити заявку",
      "hero.tag": "Варшава · Прушкув · віддалено по всій Польщі",
      "hero.title": "Комп'ютер гальмує, гріється або не вмикається? Допоможу — зрозумілою вам мовою.",
      "hero.sub": "Перевстановлення Windows, чистка і заміна термопасти, встановлення SSD, збірка та налаштування ігрових ПК. Пояснюю, що зламалося і скільки коштує, до початку роботи.",
      "hero.cta": "Описати проблему",
      "hero.f1": "Досвід сервісного майстра з 2021 року", "hero.f2": "Українська, русский, polski", "hero.f3": "Ціна погоджується до початку роботи",
      "services.title": "Послуги та орієнтовні ціни",
      "services.note": "Точна ціна залежить від моделі та стану пристрою. Запчастини оплачуються окремо за чеком.",
      "from": "від", "currency": "zł",
      "how.title": "Як це працює",
      "how.s1t": "Заявка", "how.s1": "Напишіть, що сталося: форма нижче або месенджер.",
      "how.s2t": "Попередня оцінка", "how.s2": "Поставлю кілька питань і назву орієнтовну ціну та термін.",
      "how.s3t": "Робота", "how.s3": "Віддалено, з виїздом або ви привозите пристрій — як зручніше.",
      "how.s4t": "Перевірка й оплата", "how.s4": "Тестуємо разом, пояснюю, що було зроблено. Оплата після результату.",
      "faq.title": "Часті питання",
      "faq.q1": "Чи можна вирішити проблему віддалено?",
      "faq.a1": "Багато програмних проблем — так: налаштування Windows, драйвери, програми, повільна робота. Потрібен інтернет і безкоштовна програма віддаленого доступу, яку я допоможу встановити. Ви бачите все, що я роблю.",
      "faq.q2": "Чи збережуться мої файли при перевстановленні Windows?",
      "faq.a2": "Перед перевстановленням обговорюємо, які дані важливі, і зберігаємо їх. Якщо диск пошкоджений, чесно скажу про це заздалегідь.",
      "faq.q3": "Що ви не робите?",
      "faq.a3": "Не міняю матриці (екрани) і не займаюся пайкою материнських плат. У таких випадках підкажу, куди звернутися.",
      "faq.q4": "Допомагаєте вибрати комп'ютер або комплектуючі?",
      "faq.a4": "Так. Підберу конфігурацію під ваш бюджет і задачі (робота, навчання, ігри, стрімінг), перевірю сумісність і можу зібрати ПК.",
      "form.title": "Залишити заявку", "form.sub": "Відповідаю зазвичай протягом дня. Ввечері та у вихідні — теж.",
      "form.name": "Ім'я", "form.contact": "Телефон або Telegram", "form.service": "Що потрібно зробити",
      "form.where": "Де зручно", "form.w1": "Віддалено", "form.w2": "Виїзд (Варшава / Прушкув)", "form.w3": "Привезу сам(а)",
      "form.desc": "Опишіть проблему та модель пристрою",
      "form.descPh": "Наприклад: ноутбук Lenovo, після ввімкнення довго вантажиться і шумить",
      "form.consent": "Погоджуюсь на обробку моїх даних для відповіді на заявку.",
      "form.send": "Надіслати заявку",
      "form.ok": "Дякую! Заявку надіслано, скоро зв'яжуся з вами.",
      "form.err": "Не вдалося надіслати. Напишіть, будь ласка, у месенджер або спробуйте ще раз.",
      "form.sending": "Надсилаю…",
      "form.privacy": "Дані з форми використовуються лише для зв'язку щодо вашої заявки, не передаються третім особам для реклами і видаляються на ваше прохання.",
      "form.other": "Інше / не знаю",
      "foot.area": "Варшава, Прушкув та околиці",
      "s.windows": ["Перевстановлення Windows", "Встановлення, драйвери, базові програми, перенесення важливих файлів"],
      "s.cleaning": ["Чистка і заміна термопасти", "Ноутбук або ПК гріється, шумить, вимикається під навантаженням"],
      "s.ssd": ["Встановлення SSD", "Заміна HDD на SSD з перенесенням системи — комп'ютер у рази швидший"],
      "s.speedup": ["Прискорення старого ноутбука", "Автозавантаження, зайві програми, налаштування Windows"],
      "s.remote": ["Віддалена допомога", "Програми, помилки, налаштування — без виїзду, через інтернет"],
      "s.gaming": ["Ігровий ПК: FPS і налаштування", "Діагностика просідань FPS, налаштування Windows та ігор (CS2, Warzone)"],
      "s.build": ["Збірка ПК", "Збірка, налаштування BIOS, встановлення системи і тестування"],
      "s.advice": ["Підбір комплектуючих", "Конфігурація під бюджет, перевірка сумісності, консультація перед покупкою"],
      "s.wifi": ["Wi‑Fi і роутер", "Налаштування інтернету, слабкий сигнал, підключення пристроїв"]
    },
    pl: {
      "pr.title": "Co się stało?", "pr.slow": "Zwalnia i długo się uruchamia", "pr.hot": "Grzeje się i hałasuje", "pr.boot": "Windows się nie uruchamia", "pr.fps": "Mało FPS w grach", "pr.buy": "Chcę kupić lub złożyć komputer", "tg.float": "Napisz na Telegramie",
      "nav.services": "Usługi", "nav.how": "Jak pracuję", "nav.faq": "Pytania", "nav.contact": "Zostaw zgłoszenie",
      "hero.tag": "Warszawa · Pruszków · zdalnie w całej Polsce",
      "hero.title": "Komputer zwalnia, grzeje się albo się nie włącza? Pomogę — w zrozumiałym dla Ciebie języku.",
      "hero.sub": "Reinstalacja Windows, czyszczenie i wymiana pasty termoprzewodzącej, montaż SSD, składanie i konfiguracja komputerów do gier. Przed rozpoczęciem pracy wyjaśniam, co się zepsuło i ile to kosztuje.",
      "hero.cta": "Opisz problem",
      "hero.f1": "Doświadczenie w serwisie komputerowym od 2021 roku", "hero.f2": "Polski, українська, русский", "hero.f3": "Cenę ustalamy przed rozpoczęciem pracy",
      "services.title": "Usługi i orientacyjne ceny",
      "services.note": "Dokładna cena zależy od modelu i stanu urządzenia. Części płatne osobno według paragonu.",
      "from": "od", "currency": "zł",
      "how.title": "Jak to działa",
      "how.s1t": "Zgłoszenie", "how.s1": "Napisz, co się stało: formularz poniżej albo komunikator.",
      "how.s2t": "Wstępna wycena", "how.s2": "Zadam kilka pytań i podam orientacyjną cenę oraz termin.",
      "how.s3t": "Naprawa", "how.s3": "Zdalnie, z dojazdem albo przywozisz urządzenie — jak wygodniej.",
      "how.s4t": "Sprawdzenie i płatność", "how.s4": "Testujemy razem, wyjaśniam, co zostało zrobione. Płatność po wykonaniu.",
      "faq.title": "Częste pytania",
      "faq.q1": "Czy problem da się rozwiązać zdalnie?",
      "faq.a1": "Wiele problemów z oprogramowaniem — tak: konfiguracja Windows, sterowniki, programy, wolne działanie. Potrzebny jest internet i darmowy program do zdalnego dostępu, który pomogę zainstalować. Widzisz wszystko, co robię.",
      "faq.q2": "Czy moje pliki zostaną zachowane przy reinstalacji Windows?",
      "faq.a2": "Przed reinstalacją ustalamy, które dane są ważne, i je zabezpieczamy. Jeśli dysk jest uszkodzony, uczciwie powiem o tym wcześniej.",
      "faq.q3": "Czego nie robisz?",
      "faq.a3": "Nie wymieniam matryc (ekranów) i nie wykonuję lutowania płyt głównych. W takich przypadkach podpowiem, gdzie się zgłosić.",
      "faq.q4": "Czy pomagasz wybrać komputer lub podzespoły?",
      "faq.a4": "Tak. Dobiorę konfigurację do budżetu i zadań (praca, nauka, gry, streaming), sprawdzę kompatybilność i mogę złożyć komputer.",
      "form.title": "Zostaw zgłoszenie", "form.sub": "Zwykle odpowiadam w ciągu dnia. Wieczorami i w weekendy też.",
      "form.name": "Imię", "form.contact": "Telefon lub Telegram", "form.service": "Co trzeba zrobić",
      "form.where": "Gdzie wygodnie", "form.w1": "Zdalnie", "form.w2": "Dojazd (Warszawa / Pruszków)", "form.w3": "Przywiozę sam(a)",
      "form.desc": "Opisz problem i model urządzenia",
      "form.descPh": "Na przykład: laptop Lenovo, po włączeniu długo się uruchamia i hałasuje",
      "form.consent": "Wyrażam zgodę na przetwarzanie moich danych w celu odpowiedzi na zgłoszenie.",
      "form.send": "Wyślij zgłoszenie",
      "form.ok": "Dziękuję! Zgłoszenie wysłane, wkrótce się odezwę.",
      "form.err": "Nie udało się wysłać. Napisz proszę na komunikatorze albo spróbuj ponownie.",
      "form.sending": "Wysyłam…",
      "form.privacy": "Dane z formularza są używane wyłącznie do kontaktu w sprawie zgłoszenia, nie są przekazywane osobom trzecim w celach reklamowych i zostaną usunięte na Twoją prośbę.",
      "form.other": "Inne / nie wiem",
      "foot.area": "Warszawa, Pruszków i okolice",
      "s.windows": ["Reinstalacja Windows", "Instalacja, sterowniki, podstawowe programy, przeniesienie ważnych plików"],
      "s.cleaning": ["Czyszczenie i wymiana pasty", "Laptop lub komputer grzeje się, hałasuje, wyłącza się pod obciążeniem"],
      "s.ssd": ["Montaż dysku SSD", "Wymiana HDD na SSD z przeniesieniem systemu — komputer działa wielokrotnie szybciej"],
      "s.speedup": ["Przyspieszenie starego laptopa", "Autostart, zbędne programy, konfiguracja Windows"],
      "s.remote": ["Pomoc zdalna", "Programy, błędy, ustawienia — bez dojazdu, przez internet"],
      "s.gaming": ["Komputer do gier: FPS i konfiguracja", "Diagnoza spadków FPS, konfiguracja Windows i gier (CS2, Warzone)"],
      "s.build": ["Składanie komputera", "Montaż, konfiguracja BIOS, instalacja systemu i testy"],
      "s.advice": ["Dobór podzespołów", "Konfiguracja pod budżet, sprawdzenie kompatybilności, konsultacja przed zakupem"],
      "s.wifi": ["Wi‑Fi i router", "Konfiguracja internetu, słaby zasięg, podłączanie urządzeń"]
    }
  };


  // Иконки услуг (простые линии, цвет берётся из CSS)
  var ICONS = {
    windows: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    cleaning: '<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 3-6 5-4s-1 5-5 4M14 12c4 0 6 3 4 5s-5-1-4-5M12 14c0 4-3 6-5 4s1-5 5-4M10 12c-4 0-6-3-4-5s5 1 4 5"/>',
    ssd: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 14h.01M11 14h.01M15 10h2"/>',
    speedup: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    remote: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M9 10l3 3 3-3"/>',
    gaming: '<rect x="2" y="7" width="20" height="10" rx="5"/><path d="M7 12h4M9 10v4M15 11h.01M17 13h.01"/>',
    build: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
    advice: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01"/>',
    wifi: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01"/>'
  };
  function icon(id) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[id] || "") + "</svg>";
  }

  var lang = "ru";
  try { lang = localStorage.getItem("lang") || lang; } catch (e) {}
  if (!T[lang]) lang = "ru";

  function t(key) { return T[lang][key] !== undefined ? T[lang][key] : T.ru[key]; }

  function renderServices() {
    var grid = document.getElementById("price-list");
    var select = document.getElementById("service-select");
    var current = select.value;
    grid.innerHTML = "";
    select.innerHTML = "";
    cfg.services.forEach(function (s) {
      var text = t("s." + s.id);
      if (!text) return;
      var card = document.createElement("div");
      card.className = "card";
      card.innerHTML = "<div class=\"card__icon\">" + icon(s.id) + "</div><h3></h3><p></p><div class=\"price\"></div>";
      card.querySelector("h3").textContent = text[0];
      card.querySelector("p").textContent = text[1];
      card.querySelector(".price").textContent = t("from") + " " + s.price + " " + t("currency");
      grid.appendChild(card);

      var opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = text[0];
      select.appendChild(opt);
    });
    var other = document.createElement("option");
    other.value = "other";
    other.textContent = t("form.other");
    select.appendChild(other);
    if (current) select.value = current;
  }

  function applyLang(l) {
    lang = l;
    try { localStorage.setItem("lang", l); } catch (e) {}
    document.documentElement.lang = l === "uk" ? "uk" : l;
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var v = t(el.getAttribute("data-i18n"));
      if (typeof v === "string") el.textContent = v;
    });
    document.querySelectorAll("[data-i18n-ph]").forEach(function (el) {
      el.placeholder = t(el.getAttribute("data-i18n-ph"));
    });
    document.querySelectorAll(".lang button").forEach(function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-lang") === l);
    });
    document.querySelector("input[name=lang]").value = l;
    renderServices();
  }

  function setupContacts() {
    var tg = document.querySelector(".js-telegram");
    var wa = document.querySelector(".js-whatsapp");
    var ph = document.querySelector(".js-phone");
    if (cfg.telegram) {
      tg.href = "https://t.me/" + cfg.telegram; tg.hidden = false;
      var fl = document.querySelector(".tg-float");
      fl.href = tg.href; fl.hidden = false;
    }
    if (cfg.whatsapp) { wa.href = "https://wa.me/" + cfg.whatsapp; wa.hidden = false; }
    if (cfg.phone) { ph.href = "tel:" + cfg.phone; ph.textContent = cfg.phone; ph.hidden = false; }
  }

  // Отправка формы без перезагрузки (Netlify Forms принимает POST на "/")
  function setupForm() {
    var form = document.getElementById("lead-form");
    var status = document.getElementById("form-status");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      status.textContent = t("form.sending");
      fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(new FormData(form)).toString()
      }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        form.reset();
        document.querySelector("input[name=lang]").value = lang;
        status.textContent = t("form.ok");
      }).catch(function () {
        status.textContent = t("form.err");
      }).then(function () { btn.disabled = false; });
    });
  }

  document.querySelectorAll(".lang button").forEach(function (b) {
    b.addEventListener("click", function () { applyLang(b.getAttribute("data-lang")); });
  });

  // Кнопки «Что случилось?» — выбирают услугу в форме и прокручивают к ней
  document.querySelectorAll(".problem").forEach(function (b) {
    b.addEventListener("click", function () {
      document.getElementById("service-select").value = b.getAttribute("data-service");
      document.getElementById("contact").scrollIntoView({ behavior: "smooth" });
      setTimeout(function () { document.querySelector("#lead-form input[name=name]").focus({ preventScroll: true }); }, 500);
    });
  });

  setupContacts();
  setupForm();
  applyLang(lang);
})();
