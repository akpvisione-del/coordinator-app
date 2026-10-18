/* AKP COMMANDER v10 — first production candidate UI. No fake users, no client-side security theater. */
'use strict';
const $=id=>document.getElementById(id);

const ALLOWED_STATUS=[
  'NOWE','DO_KONTAKTU','DO_UMOWIENIA','UMOWIONE','POMIAR','DO_WYCENY','WYCENA_W_TOKU',
  'OCZEKUJE_NA_KLIENTA','OCZEKUJE_NA_MATERIAL','OCZEKUJE_NA_DOSTAWE','DO_REALIZACJI',
  'W_REALIZACJI','WSTRZYMANE','DO_ODBIORU','DO_ROZLICZENIA','ZAKONCZONE','REKLAMACJA',
  'SERWIS','ANULOWANE'
];
const ALLOWED_PRIORITY=['NORMALNY','WYSOKI','KRYTYCZNY'];

const NAV={
  coordinator:[['overview','⌂','Pulpit'],['jobs','▤','Zlecenia'],['schedule','▦','Harmonogram'],['chat','✉','Wiadomości'],['team','♙','Zespół'],['settings','⚙','System']],
  worker:[['jobs','▤','Moje zlecenia'],['settings','⚙','Konto']]
};

const STATE={
  me:null,
  sessionEpoch:0,
  view:'overview',
  jobs:[],
  reports:[],
  team:[],
  canCreateWorker:false,
  chatUnread:0,
  teamSearch:'',
  teamStatus:'ALL',
  workerFilter:'',
  teamHistory:{},
  audit:[],
  dashboard:{},
  openJob:null,
  editingJob:null,
  detail:null,
  detailTab:'info',
  filter:'',
  statusFilter:'ACTIVE',
  sortBy:'operational',
  quickFilter:'',
  advancedFilters:false,
  categoryFilter:'ALL',
  listScroll:0,
  financeDrafts:{},
  dueFilter:'ALL',
  scheduleDate:'',
  scheduleWorker:'ALL',
  scheduleDrafts:{},
  notes:{},
  issues:{},
  reviewNotes:{},
  search:'',
  offline:false,
  loading:false,
  brief:'',
  sources:null
};

const ESC={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
const LOCAL_PHOTO_PREVIEWS={};

// i18n Dictionary for Worker Panel — PL, UK, RU, EN
const I18N = {
  pl: {
    allActive: 'Wszystkie aktywne',
    dashboardActiveLabel: 'aktywne zlecenia',
    dashboardArchiveHint: 'Zakończone i anulowane znajdziesz w archiwum',
    dashboardMore: 'Więcej wskaźników',
    categoryEvidenceNotice: 'Zlecenia bez potwierdzonej kategorii są widoczne tylko pod „Wszystkie”. Wymagają uzupełnienia danych w systemie.',
    navOverview: 'Pulpit',
    dayPlan: 'Plan dnia',
    navSchedule: 'Harmonogram',
    scheduleWeek: 'Tydzień od',
    previousWeek: 'Poprzedni tydzień',
    nextWeek: 'Następny tydzień',
    allWorkers: 'Wszyscy monterzy',
    unassignedCrew: 'Bez przydziału',
    unscheduled: 'Bez terminu',
    saveDate: 'Zapisz termin',
    dateSaved: 'Termin zapisany.',
    scheduleWarning: 'Kilka zleceń tego samego montera w tym dniu. Sprawdź godziny — data dzienna nie dowodzi kolizji.',
    scheduleNotice: 'Plan pokazuje daty dzienne. Godziny i czas trwania nie są ustalone.',
    tomorrow: 'Jutro',
    toSchedule: 'Do umówienia',
    toAccept: 'Do odbioru',
    toSettle: 'Do rozliczeń',
    currentJobs: 'Obecne',
    workCategory: 'Branża',
    allCategories: 'Wszystkie branże',
    POMIARY: 'Pomiary',
    KUCHNIE: 'Kuchnie',
    REMONTY: 'Remonty',
    categoryMissing: 'Branża nieprzypisana — wybór dostępny po uzupełnieniu danych.',
    timeNotSet: 'Godzina nieustalona',
    appearance: 'Wygląd',
    toggleTheme: 'Zmień motyw jasny / ciemny',
    reportDraftLocal: 'Szkic notatki jest przechowywany tylko w tej karcie przeglądarki (maks. 24 godz.). Nie został wysłany na serwer.',

    advancedFilters: 'Więcej filtrów i sortowanie',
    workerHeroTitle: 'Panel terenowy',
    workerHeroSubtitle: 'Widzisz tylko przypisane, aktywne zlecenia. Wykonaj prace, dodaj zdjęcia i wyślij raport.',
    callClient: 'Zadzwoń do klienta',
    navigate: 'Nawiguj (Google Maps)',
    clientAddress: 'Adres montażu',
    clientPhone: 'Telefon',
    clientContact: 'Kontakt z klientem',
    clientLabel: 'Klient',
    noClientData: 'Brak danych klienta — skontaktuj się z koordynatorem.',
    jobInstructions: 'Instrukcja montażu',
    checklist: 'Checklista prac',
    loadingChecklist: 'Ładowanie checklisty...',
    photosTitle: 'Dokumentacja fotograficzna',
    photoStageBefore: 'Przed montażem',
    photoStageDuring: 'W trakcie prac',
    photoStageAfter: 'Po zakończeniu',
    photoStageIssue: 'Usterka / Przeszkoda',
    photoStageProtocol: 'Protokół / Odbiór',
    addPhotoBtn: '+ Dodaj zdjęcie',
    photoStageLabel: 'Etap zdjęcia',
    photoCaptionLabel: 'Opis zdjęcia',
    photoCaptionPlaceholder: 'np. Stan ściany przed montażem',
    photoFileLabel: 'Wybierz plik (Aparat / Galeria)',
    uploadingPhoto: 'Przesyłanie zdjęcia...',
    photoUploaded: 'Zarejestrowano metadane etapu (podgląd lokalny). Plik NIE został przesłany do chmury Storage.',
    photoInvalidUser: 'Nieprawidłowy identyfikator użytkownika. Zaloguj się ponownie.',
    noPhotos: 'Brak zdjęć do tego zlecenia.',
    photoSelectFile: 'Wybierz plik ze zdjęciem przed wysłaniem.',
    photoSizeLimit: 'Rozmiar pliku przekracza limit 10 MB.',
    storageNotice: 'Supabase Storage (bucket job-photos): NIEDOSTĘPNE — fizyczny upload do chmury wymaga zatwierdzenia migracji 004 i utworzenia bucketu w Supabase. W systemie zapisywane są wyłącznie metadane etapu montażu i lokalny podgląd.',
    reportTitle: 'Raport końcowy z prac',
    reportDoneWork: 'Wykonane prace (opis)',
    reportDonePlaceholder: 'Co zostało zamontowane/zrobione?',
    reportIssue: 'Problemy, usterki lub uwagi',
    reportIssuePlaceholder: 'Czy wystąpiły komplikacje na miejscu?',
    submitReportBtn: 'Przekaż raport koordynatorowi →',
    submittingReport: 'Przesyłanie raportu...',
    reportSubmitted: 'Raport przekazano do odbioru.',
    reportEmptyError: 'Wpisz opis wykonanych prac lub napotkanych problemów przed wysłaniem raportu.',
    selectLang: 'Język panelu / Мова / Language',
    langUpdated: 'Zaktualizowano preferowany język.',
    confirmSubmit: 'Czy na pewno chcesz przekazać gotowy raport koordynatorowi?',
    noJobs: 'Brak aktywnych zleceń przydzielonych do Ciebie.',
    noJobsHint: 'Nowe zlecenia pojawią się tutaj po przydzieleniu przez koordynatora.',
    noReports: 'Nie masz jeszcze żadnych raportów.',
    openJob: 'Otwórz zlecenie',
    closeJob: 'Zamknij szczegóły',
    navJobs: 'Moje zlecenia',
    navReports: 'Moje raporty',
    navSettings: 'Konto',
    searchPlaceholder: 'Szukaj numeru, zlecenia, klienta lub miejsca',
    tabInfo: 'Informacje',
    tabCrew: 'Ekipa',
    tabTasks: 'Zadania',
    tabPhotos: 'Zdjęcia',
    tabFinance: 'Wycena',
    filterStatusLabel: 'Status:',
    filterDueLabel: 'Termin:',
    filterAll: 'Wszystkie',
    filterActive: 'Aktywne',
    filterNew: 'Nowe',
    filterInProgress: 'W realizacji',
    filterDone: 'Zakończone',
    filterAnyDate: 'Każdy termin',
    filterToday: 'Dzisiaj',
    filterUpcoming: 'Nadchodzące',
    filterOverdue: 'Po terminie',
    filterReset: 'Zresetuj filtry',
    filterShown: 'Pokazano',
    filterOf: 'z',
    filterNone: 'Brak zleceń spełniających wybrane kryteria.',
    sortLabel: "Sortowanie",
    sortOperational: "Bez daty → najbliższy termin",
    sortPriority: "Najwyższy priorytet",
    sortRecent: "Ostatnia zmiana",
    sortReference: "Numer referencyjny",
    archiveLabel: "Zakończone / Archiwum",
    backToList: "← Wróć do listy",
    detailTitle: "Szczegóły zlecenia",
    jumpLabel: "Przejdź do sekcji",
    quickCall: "Zadzwoń",
    quickNavigate: "Nawiguj",
    quickPhoto: "Dodaj zdjęcie",
    quickPhotos: "Zdjęcia",
    quickEdit: "Edytuj",
    phoneMissing: "Brak numeru",
    addressMissing: "Brak potwierdzonego adresu",
    draftUnsaved: "Niezapisane kwoty",
    draftConfirm: "Masz niezapisane kwoty. Opuścić ekran? Wersja robocza pozostanie w tej sesji.",
    dashboardNoDate: "Bez terminu",
    dashboardOverdue: "Po terminie",
    dashboardToday: "Dzisiaj",
    dashboardUrgent: "Pilne",
    dashboardUnassigned: "Bez ekipy",
    dashboardAwaiting: "Do wyceny",
    dashboardActive: "Aktywne",
    dashboardPending: "Do odbioru"
  },
  uk: {
    allActive: 'Усі активні',
    dashboardActiveLabel: 'активних замовлень',
    dashboardArchiveHint: 'Завершені та скасовані — в архіві',
    dashboardMore: 'Інші показники',
    categoryEvidenceNotice: 'Замовлення без підтвердженої категорії видно лише в загальному списку. Категорію потрібно доповнити.',
    navOverview: 'Панель',
    dayPlan: 'План дня',
    navSchedule: 'Розклад',
    scheduleWeek: 'Тиждень від',
    previousWeek: 'Попередній тиждень',
    nextWeek: 'Наступний тиждень',
    allWorkers: 'Усі монтажники',
    unassignedCrew: 'Без виконавця',
    unscheduled: 'Без дати',
    saveDate: 'Зберегти дату',
    dateSaved: 'Дату збережено.',
    scheduleWarning: 'Кілька замовлень монтажника на один день. Перевірте час.',
    scheduleNotice: 'План показує дати. Час і тривалість не визначені.',
    tomorrow: 'Завтра',
    toSchedule: 'Узгодити дату',
    toAccept: 'До приймання',
    toSettle: 'До розрахунку',
    currentJobs: 'Поточні',
    workCategory: 'Тип робіт',
    allCategories: 'Усі типи',
    POMIARY: 'Заміри',
    KUCHNIE: 'Кухні',
    REMONTY: 'Ремонти',
    categoryMissing: 'Тип робіт не вказано — вибір після заповнення даних.',
    timeNotSet: 'Час не визначено',
    appearance: 'Вигляд',
    toggleTheme: 'Світла / темна тема',
    reportDraftLocal: 'Чернетка зберігається лише в цій вкладці браузера (до 24 год.). На сервер не надіслано.',

    advancedFilters: 'Більше фільтрів і сортування',
    workerHeroTitle: 'Панель монтажника',
    workerHeroSubtitle: 'Ви бачите лише призначені активні замовлення. Виконайте роботу, додайте фото та надішліть звіт.',
    callClient: 'Подзвонити клієнту',
    navigate: 'Навігація (Google Maps)',
    clientAddress: 'Адреса монтажу',
    clientPhone: 'Телефон',
    clientContact: 'Контакт із клієнтом',
    clientLabel: 'Клієнт',
    noClientData: 'Немає даних клієнта — зв’яжіться з координатором.',
    jobInstructions: 'Інструкція до замовлення',
    checklist: 'Чек-лист робіт',
    loadingChecklist: 'Завантаження чек-листа...',
    photosTitle: 'Фотофіксація робіт',
    photoStageBefore: 'До монтажу',
    photoStageDuring: 'В процесі',
    photoStageAfter: 'Після закінчення',
    photoStageIssue: 'Дефект / Проблема',
    photoStageProtocol: 'Акт / Протокол',
    addPhotoBtn: '+ Додати фото',
    photoStageLabel: 'Етап фото',
    photoCaptionLabel: 'Опис фото',
    photoCaptionPlaceholder: 'напр. Стан стіни до монтажу',
    photoFileLabel: 'Оберіть файл (Камера / Галерея)',
    uploadingPhoto: 'Завантаження фото...',
    photoUploaded: 'Метадані етапу зафіксовано (локальний перегляд). Файл НЕ завантажено до хмари Storage.',
    photoInvalidUser: 'Невірний ідентифікатор користувача. Увійдіть повторно.',
    noPhotos: 'Немає фото до цього замовлення.',
    photoSelectFile: 'Оберіть фотографію перед відправкою.',
    photoSizeLimit: 'Розмір файлу перевищує ліміт 10 МБ.',
    storageNotice: 'Supabase Storage (бакет job-photos): НЕДОСТУПНО — збереження файлів у хмарі очікує на міграцію 004. У системі фіксуються лише метадані етапу робіт та локальний перегляд.',
    reportTitle: 'Підсумковий звіт',
    reportDoneWork: 'Виконані роботи (опис)',
    reportDonePlaceholder: 'Що було змонтовано чи зроблено?',
    reportIssue: 'Проблеми чи зауваження',
    reportIssuePlaceholder: 'Чи виникли труднощі на об’єкті?',
    submitReportBtn: 'Передати звіт координатору →',
    submittingReport: 'Відправлення звіту...',
    reportSubmitted: 'Звіт успішно передано.',
    reportEmptyError: 'Будь ласка, опишіть виконану роботу або проблеми перед надсиланням.',
    selectLang: 'Мова панелі / Language',
    langUpdated: 'Мову успішно оновлено.',
    confirmSubmit: 'Передати готовий звіт координатору?',
    noJobs: 'Немає призначених замовлень.',
    noJobsHint: 'Нові замовлення з’являться тут після призначення координатором.',
    noReports: 'У вас ще немає звітів.',
    openJob: 'Otwórz zlecenie',
    closeJob: 'Zamknij szczegóły',
    navJobs: 'Мої замовлення',
    navReports: 'Мої звіти',
    navSettings: 'Профіль',
    searchPlaceholder: 'Пошук замовлення, клієнта або адреси',
    tabInfo: 'Інформація',
    tabCrew: 'Бригада',
    tabTasks: 'Завдання',
    tabPhotos: 'Фото',
    tabFinance: 'Кошторис',
    filterStatusLabel: 'Статус:',
    filterDueLabel: 'Термін:',
    filterAll: 'Усі',
    filterActive: 'Активні',
    filterNew: 'Нові',
    filterInProgress: 'У роботі',
    filterDone: 'Завершені',
    filterAnyDate: 'Будь-який термін',
    filterToday: 'Сьогодні',
    filterUpcoming: 'Майбутні',
    filterOverdue: 'Прострочені',
    filterReset: 'Скинути фільтри',
    filterShown: 'Показано',
    filterOf: 'з',
    filterNone: 'Немає замовлень за вибраними фільтрами.',
    sortLabel: "Сортування",
    sortOperational: "Без дати → найближчий термін",
    sortPriority: "Найвищий пріоритет",
    sortRecent: "Остання зміна",
    sortReference: "Номер замовлення",
    archiveLabel: "Завершені / Архів",
    backToList: "← До списку",
    detailTitle: "Деталі замовлення",
    jumpLabel: "Перейти до розділу",
    quickCall: "Подзвонити",
    quickNavigate: "Маршрут",
    quickPhoto: "Додати фото",
    quickPhotos: "Фото",
    quickEdit: "Редагувати",
    phoneMissing: "Немає номера",
    addressMissing: "Немає підтвердженої адреси",
    draftUnsaved: "Незбережені суми",
    draftConfirm: "Є незбережені суми. Вийти? Чернетка залишиться в цій сесії.",
    dashboardNoDate: "Без дати",
    dashboardOverdue: "Прострочені",
    dashboardToday: "Сьогодні",
    dashboardUrgent: "Термінові",
    dashboardUnassigned: "Без команди",
    dashboardAwaiting: "До оцінки",
    dashboardActive: "Активні",
    dashboardPending: "До приймання"
  },
  ru: {
    allActive: 'Все активные',
    dashboardActiveLabel: 'активных заказов',
    dashboardArchiveHint: 'Завершённые и отменённые находятся в архиве',
    dashboardMore: 'Другие показатели',
    categoryEvidenceNotice: 'Заказы без подтверждённой категории отображаются только в общем списке. Категорию необходимо указать.',
    navOverview: 'Панель',
    dayPlan: 'План дня',
    navSchedule: 'Расписание',
    scheduleWeek: 'Неделя с',
    previousWeek: 'Предыдущая неделя',
    nextWeek: 'Следующая неделя',
    allWorkers: 'Все монтажники',
    unassignedCrew: 'Без исполнителя',
    unscheduled: 'Без даты',
    saveDate: 'Сохранить дату',
    dateSaved: 'Дата сохранена.',
    scheduleWarning: 'Несколько заказов монтажника в один день. Проверьте время.',
    scheduleNotice: 'План показывает даты. Время и длительность не определены.',
    tomorrow: 'Завтра',
    toSchedule: 'Согласовать дату',
    toAccept: 'К приёмке',
    toSettle: 'К расчёту',
    currentJobs: 'Текущие',
    workCategory: 'Тип работ',
    allCategories: 'Все типы',
    POMIARY: 'Замеры',
    KUCHNIE: 'Кухни',
    REMONTY: 'Ремонты',
    categoryMissing: 'Тип работ не указан — выбор после заполнения данных.',
    timeNotSet: 'Время не назначено',
    appearance: 'Внешний вид',
    toggleTheme: 'Светлая / тёмная тема',
    reportDraftLocal: 'Черновик хранится только в этой вкладке браузера (до 24 часов). На сервер не отправлен.',

    advancedFilters: 'Другие фильтры и сортировка',
    workerHeroTitle: 'Панель монтажника',
    workerHeroSubtitle: 'Вы видите только назначенные активные заказы. Выполните монтаж, сделайте фото и сдайте отчет.',
    callClient: 'Позвонить клиенту',
    navigate: 'Навигация (Google Maps)',
    clientAddress: 'Адрес монтажа',
    clientPhone: 'Телефон',
    clientContact: 'Контакт с клиентом',
    clientLabel: 'Клиент',
    noClientData: 'Нет данных клиента — свяжитесь с координатором.',
    jobInstructions: 'Инструкция по монтажу',
    checklist: 'Чек-лист работ',
    loadingChecklist: 'Загрузка чек-листа...',
    photosTitle: 'Фотодокументация',
    photoStageBefore: 'До монтажа',
    photoStageDuring: 'В процессе',
    photoStageAfter: 'После завершения',
    photoStageIssue: 'Дефект / Препятствие',
    photoStageProtocol: 'Акт / Протокол',
    addPhotoBtn: '+ Добавить фото',
    photoStageLabel: 'Этап фото',
    photoCaptionLabel: 'Описание фото',
    photoCaptionPlaceholder: 'напр. Состояние стены до монтажа',
    photoFileLabel: 'Выберите файл (Камера / Галерея)',
    uploadingPhoto: 'Загрузка фото...',
    photoUploaded: 'Метаданные этапа зафиксированы (локальный просмотр). Файл НЕ загружен в облако Storage.',
    photoInvalidUser: 'Неверный идентификатор пользователя. Войдите повторно.',
    noPhotos: 'Нет фото к этому заказу.',
    photoSelectFile: 'Выберите фото перед отправкой.',
    photoSizeLimit: 'Размер файла превышает лимит 10 МБ.',
    storageNotice: 'Supabase Storage (бакет job-photos): НЕДОСТУПНО — загрузка файлов в облако ожидает миграции 004. В системе сохраняются только метаданные этапа и локальный просмотр.',
    reportTitle: 'Итоговый отчет о работе',
    reportDoneWork: 'Выполненные работы',
    reportDonePlaceholder: 'Что было сделано / установлено?',
    reportIssue: 'Проблемы или дефекты',
    reportIssuePlaceholder: 'Возникли ли сложности на месте?',
    submitReportBtn: 'Сдать отчет координатору →',
    submittingReport: 'Отправка отчета...',
    reportSubmitted: 'Отчет успешно передан.',
    reportEmptyError: 'Укажите выполненные работы или возникшие проблемы перед отправкой отчета.',
    selectLang: 'Язык интерфейса / Language',
    langUpdated: 'Язык интерфейса обновлен.',
    confirmSubmit: 'Передать готовый отчет координатору?',
    noJobs: 'Нет назначенных заказов.',
    noJobsHint: 'Новые заказы появятся здесь после назначения координатором.',
    noReports: 'У вас пока нет отчетов.',
    openJob: 'Открыть заказ',
    closeJob: 'Закрыть детали',
    navJobs: 'Мои заказы',
    navReports: 'Мои отчеты',
    navSettings: 'Профиль',
    searchPlaceholder: 'Поиск заказа, клиента или адреса',
    tabInfo: 'Информация',
    tabCrew: 'Бригада',
    tabTasks: 'Задачи',
    tabPhotos: 'Фото',
    tabFinance: 'Смета',
    filterStatusLabel: 'Статус:',
    filterDueLabel: 'Срок:',
    filterAll: 'Все',
    filterActive: 'Активные',
    filterNew: 'Новые',
    filterInProgress: 'В работе',
    filterDone: 'Завершены',
    filterAnyDate: 'Любой срок',
    filterToday: 'Сегодня',
    filterUpcoming: 'Предстоящие',
    filterOverdue: 'Просроченные',
    filterReset: 'Сбросить фильтры',
    filterShown: 'Показано',
    filterOf: 'из',
    filterNone: 'Нет заказов по выбранным фильтрам.',
    sortLabel: "Сортировка",
    sortOperational: "Без даты → ближайший срок",
    sortPriority: "Высший приоритет",
    sortRecent: "Последнее изменение",
    sortReference: "Номер заказа",
    archiveLabel: "Завершённые / Архив",
    backToList: "← К списку",
    detailTitle: "Детали заказа",
    jumpLabel: "Перейти к разделу",
    quickCall: "Позвонить",
    quickNavigate: "Маршрут",
    quickPhoto: "Добавить фото",
    quickPhotos: "Фото",
    quickEdit: "Изменить",
    phoneMissing: "Нет номера",
    addressMissing: "Нет подтверждённого адреса",
    draftUnsaved: "Несохранённые суммы",
    draftConfirm: "Есть несохранённые суммы. Выйти? Черновик сохранится в этой сессии.",
    dashboardNoDate: "Без даты",
    dashboardOverdue: "Просрочены",
    dashboardToday: "Сегодня",
    dashboardUrgent: "Срочные",
    dashboardUnassigned: "Без бригады",
    dashboardAwaiting: "К оценке",
    dashboardActive: "Активные",
    dashboardPending: "К приёмке"
  },
  en: {
    allActive: 'All active',
    dashboardActiveLabel: 'active jobs',
    dashboardArchiveHint: 'Completed and cancelled jobs are in the archive',
    dashboardMore: 'More indicators',
    categoryEvidenceNotice: 'Jobs without a verified category appear only in the full list. Category metadata must be added.',
    navOverview: 'Dashboard',
    dayPlan: 'Daily plan',
    navSchedule: 'Schedule',
    scheduleWeek: 'Week of',
    previousWeek: 'Previous week',
    nextWeek: 'Next week',
    allWorkers: 'All workers',
    unassignedCrew: 'Unassigned',
    unscheduled: 'No date',
    saveDate: 'Save date',
    dateSaved: 'Date saved.',
    scheduleWarning: 'Multiple jobs for the same worker on this day. Check times; dates alone do not prove a conflict.',
    scheduleNotice: 'This plan shows dates. Times and durations have not been set.',
    tomorrow: 'Tomorrow',
    toSchedule: 'To schedule',
    toAccept: 'For acceptance',
    toSettle: 'For settlement',
    currentJobs: 'Current',
    workCategory: 'Work type',
    allCategories: 'All types',
    POMIARY: 'Measurements',
    KUCHNIE: 'Kitchens',
    REMONTY: 'Renovations',
    categoryMissing: 'Work type not assigned — available after completing job data.',
    timeNotSet: 'Time not set',
    appearance: 'Appearance',
    toggleTheme: 'Toggle light / dark theme',
    reportDraftLocal: 'Your draft is kept only in this browser tab (up to 24 hours). It has not been sent to the server.',

    advancedFilters: 'More filters and sorting',
    workerHeroTitle: 'Worker Field Panel',
    workerHeroSubtitle: 'You only see active jobs assigned to you. Complete work, upload photos, and submit reports.',
    callClient: 'Call client',
    navigate: 'Navigate (Google Maps)',
    clientAddress: 'Job address',
    clientPhone: 'Phone',
    clientContact: 'Client contact',
    clientLabel: 'Client',
    noClientData: 'No client details — please contact coordinator.',
    jobInstructions: 'Instructions',
    checklist: 'Work checklist',
    loadingChecklist: 'Loading checklist...',
    photosTitle: 'Photo documentation',
    photoStageBefore: 'Before work',
    photoStageDuring: 'In progress',
    photoStageAfter: 'Completed',
    photoStageIssue: 'Issue / Defect',
    photoStageProtocol: 'Protocol / Signoff',
    addPhotoBtn: '+ Add photo',
    photoStageLabel: 'Photo stage',
    photoCaptionLabel: 'Photo caption',
    photoCaptionPlaceholder: 'e.g. Wall condition before installation',
    photoFileLabel: 'Choose file (Camera / Gallery)',
    uploadingPhoto: 'Uploading photo...',
    photoUploaded: 'Stage metadata recorded locally. File was NOT uploaded to cloud Storage.',
    photoInvalidUser: 'Invalid user ID. Please sign in again.',
    noPhotos: 'No photos for this job.',
    photoSelectFile: 'Please choose a photo file before submitting.',
    photoSizeLimit: 'File size exceeds 10 MB limit.',
    storageNotice: 'Supabase Storage (bucket job-photos): UNAVAILABLE — cloud file storage awaits migration 004. Only stage metadata and local preview are tracked in the system.',
    reportTitle: 'Work Report',
    reportDoneWork: 'Completed work description',
    reportDonePlaceholder: 'What was installed / completed?',
    reportIssue: 'Issues or obstacles',
    reportIssuePlaceholder: 'Any complications on site?',
    submitReportBtn: 'Submit report to coordinator →',
    submittingReport: 'Submitting report...',
    reportSubmitted: 'Report submitted for review.',
    reportEmptyError: 'Please enter description of completed work or issues before submitting.',
    selectLang: 'Language',
    langUpdated: 'Language preference updated.',
    confirmSubmit: 'Submit completed report to coordinator?',
    noJobs: 'No active jobs assigned.',
    noJobsHint: 'New jobs will appear here when assigned by the coordinator.',
    noReports: 'You have no reports yet.',
    openJob: 'Open job',
    closeJob: 'Close details',
    navJobs: 'My jobs',
    navReports: 'My reports',
    navSettings: 'Account',
    searchPlaceholder: 'Search job, client or address',
    tabInfo: 'Info',
    tabCrew: 'Crew',
    tabTasks: 'Tasks',
    tabPhotos: 'Photos',
    tabFinance: 'Quote',
    filterStatusLabel: 'Status:',
    filterDueLabel: 'Date:',
    filterAll: 'All',
    filterActive: 'Active',
    filterNew: 'New',
    filterInProgress: 'In progress',
    filterDone: 'Completed',
    filterAnyDate: 'Any date',
    filterToday: 'Today',
    filterUpcoming: 'Upcoming',
    filterOverdue: 'Overdue',
    filterReset: 'Reset filters',
    filterShown: 'Showing',
    filterOf: 'of',
    filterNone: 'No jobs match your filters.',
    sortLabel: "Sort",
    sortOperational: "No date → nearest due",
    sortPriority: "Highest priority",
    sortRecent: "Recently updated",
    sortReference: "Reference number",
    archiveLabel: "Completed / Archive",
    backToList: "← Back to list",
    detailTitle: "Job details",
    jumpLabel: "Jump to section",
    quickCall: "Call",
    quickNavigate: "Navigate",
    quickPhoto: "Add photo",
    quickPhotos: "Photos",
    quickEdit: "Edit",
    phoneMissing: "No phone number",
    addressMissing: "No verified address",
    draftUnsaved: "Unsaved amounts",
    draftConfirm: "You have unsaved amounts. Leave this view? The draft remains for this session.",
    dashboardNoDate: "No date",
    dashboardOverdue: "Overdue",
    dashboardToday: "Today",
    dashboardUrgent: "Urgent",
    dashboardUnassigned: "No crew",
    dashboardAwaiting: "Needs quote",
    dashboardActive: "Active",
    dashboardPending: "For review"
  }
};

function t(key){
  const lang = STATE.me?.preferred_lang || 'pl';
  return I18N[lang]?.[key] || I18N.pl[key] || key;
}


// F04A v08 — private, best-effort browser-tab report drafts. Not server storage.
const REPORT_DRAFT_PREFIX='akp_report_draft_v1:';
const REPORT_DRAFT_MAX_AGE=24*60*60*1000;
const REPORT_DRAFT_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function reportDraftKey(jobId){
 const uid=STATE.me?.id;
 if(STATE.me?.role!=='worker'||!REPORT_DRAFT_UUID.test(uid||'')||!REPORT_DRAFT_UUID.test(jobId||''))return null;
 return REPORT_DRAFT_PREFIX+uid+':'+jobId;
}
function saveReportDraft(jobId){
 const storageKey=reportDraftKey(jobId);
 if(!storageKey)return;
 const note=String(STATE.notes[jobId]||'').slice(0,2000);
 const issue=String(STATE.issues[jobId]||'').slice(0,1200);
 try{
  if(note||issue)sessionStorage.setItem(storageKey,JSON.stringify({note,issue,savedAt:Date.now()}));
  else sessionStorage.removeItem(storageKey);
 }catch(_){/* unavailable storage: keep in-memory edits; never claim server sync */}
}
function clearReportDraft(jobId){
 const storageKey=reportDraftKey(jobId);
 if(!storageKey)return;
 try{sessionStorage.removeItem(storageKey)}catch(_){}
}
function clearUserReportDrafts(){
 const uid=STATE.me?.id;
 if(STATE.me?.role!=='worker'||!REPORT_DRAFT_UUID.test(uid||''))return;
 const prefix=REPORT_DRAFT_PREFIX+uid+':';
 try{
  for(let i=sessionStorage.length-1;i>=0;i--){
   const key=sessionStorage.key(i);
   if(key?.startsWith(prefix))sessionStorage.removeItem(key);
  }
 }catch(_){}
 STATE.notes={};STATE.issues={};
}
function restoreReportDrafts(){
 // Discard old user state before loading this account's drafts.
 STATE.notes={};STATE.issues={};
 const uid=STATE.me?.id;
 if(STATE.me?.role!=='worker'||!REPORT_DRAFT_UUID.test(uid||''))return;
 const prefix=REPORT_DRAFT_PREFIX+uid+':';
 try{
  for(let i=sessionStorage.length-1;i>=0;i--){
   const key=sessionStorage.key(i);
   if(!key?.startsWith(prefix))continue;
   const jobId=key.slice(prefix.length);
   let obj=null;
   try{obj=JSON.parse(sessionStorage.getItem(key)||'null')}catch(_){}
   if(!REPORT_DRAFT_UUID.test(jobId||'')||!obj||typeof obj.savedAt!=='number'||!Number.isFinite(obj.savedAt)||obj.savedAt>Date.now()+60000||Date.now()-obj.savedAt>REPORT_DRAFT_MAX_AGE){
    sessionStorage.removeItem(key);continue;
   }
   if(typeof obj.note==='string')STATE.notes[jobId]=obj.note.slice(0,2000);
   if(typeof obj.issue==='string')STATE.issues[jobId]=obj.issue.slice(0,1200);
  }
 }catch(_){}
}

function stageLabel(stage) {
  const map = {
    BEFORE: t('photoStageBefore'),
    PRZED: t('photoStageBefore'),
    DURING: t('photoStageDuring'),
    W_TRAKCIE: t('photoStageDuring'),
    AFTER: t('photoStageAfter'),
    PO: t('photoStageAfter'),
    DEFECT: t('photoStageIssue'),
    USTERKA: t('photoStageIssue'),
    PROTOCOL: t('photoStageProtocol')
  };
  return map[stage] || stage;
}

function getNav(role) {
  if (role === 'worker') {
    return [
      ['jobs', '▤', t('navJobs')],
      ['schedule', '▦', t('navSchedule')],
      ['chat', '✉', ({uk:'Повідомлення',ru:'Сообщения',en:'Messages'})[STATE.me?.preferred_lang]||'Wiadomości'],
      ['settings', '⚙', t('navSettings')]
    ];
  }
  return NAV.coordinator;
}

function mobileNavName(key,fallback){
  const lang=STATE.me?.preferred_lang||'pl';
  const labels={
    pl:{overview:'Pulpit',jobs:'Zlecenia',schedule:'Terminy',chat:'Czat',team:'Zespół',settings:STATE.me?.role==='worker'?'Konto':'System'},
    uk:{overview:'Панель',jobs:'Роботи',schedule:'Терміни',chat:'Чат',team:'Команда',settings:STATE.me?.role==='worker'?'Акаунт':'Система'},
    ru:{overview:'Панель',jobs:'Работы',schedule:'Сроки',chat:'Чат',team:'Команда',settings:STATE.me?.role==='worker'?'Аккаунт':'Система'},
    en:{overview:'Home',jobs:'Jobs',schedule:'Dates',chat:'Chat',team:'Team',settings:STATE.me?.role==='worker'?'Account':'System'}
  };
  return labels[lang]?.[key]||fallback;
}

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>ESC[c])}
function fmtDate(s){if(!s)return 'Do ustalenia';const d=new Date(s+'T12:00:00');return Number.isFinite(+d)?d.toLocaleDateString('pl-PL',{day:'numeric',month:'short',year:'numeric'}):esc(s)}
function money(n){return n===null||n===undefined?'—':Number(n).toLocaleString('pl-PL')+' zł'}
function toast(msg,bad=false){const e=$('toast');e.textContent=msg;e.style.background=bad?'#9f2843':'#253c59';e.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>e.classList.remove('show'),3800)}
function connection(){const e=$('connectPill');e.classList.toggle('offline',STATE.offline);e.innerHTML='<span class="dot"></span> '+(STATE.offline?'BRAK POŁĄCZENIA':'SERWER AUTORYZOWANY')}

// Every request belongs to the currently visible account. An old response must
// never sign out or overwrite a subsequently signed-in coordinator/worker.
function staleSessionError(){return Object.assign(new Error('Poprzednia sesja została zakończona.'),{code:'STALE_SESSION'});}
async function api(path,opt={}){
  const epoch=STATE.sessionEpoch;
  const method=opt.method||'GET';const headers=method==='GET'?{}:{'Content-Type':'application/json','X-AKP-Request':'commander-v10'};
  const init={method,credentials:'same-origin',cache:'no-store',headers};
  if(opt.body!==undefined)init.body=JSON.stringify(opt.body);
  if(opt.file){init.body=opt.file;headers['Content-Type']=opt.file.type;}
  let response;
  try{response=await fetch('/api'+path,init);}catch{
    if(epoch!==STATE.sessionEpoch)throw staleSessionError();
    STATE.offline=true;connection();throw new Error('Brak połączenia. Nie zapisano zmian.');
  }
  if(epoch!==STATE.sessionEpoch)throw staleSessionError();
  STATE.offline=false;connection();
  if(opt.returnBlob&&response.ok){const blob=await response.blob();if(epoch!==STATE.sessionEpoch)throw staleSessionError();return blob;}
  let data={};try{data=await response.json()}catch{
    if(epoch!==STATE.sessionEpoch)throw staleSessionError();
    throw new Error('Serwer zwrócił nieprawidłową odpowiedź.');
  }
  if(epoch!==STATE.sessionEpoch)throw staleSessionError();
  if(!response.ok){
    if(response.status===401&&STATE.me)showLogin();
    const err=new Error(data.message||'Błąd serwera '+response.status);
    err.status=response.status;
    throw err;
  }
  return data;
}

// The browser may stay open while a different person signs in. Never retain
// data from an earlier role (especially finances), or apply stale API responses.
function resetSessionData(){
  STATE.sessionEpoch++;
  STATE.chatUnread=0;globalThis.AKPChat?.reset();globalThis.AKPPro?.reset();globalThis.AKPMaterials?.reset();globalThis.AKPMedia?.reset();globalThis.AKPDrawing?.reset();
  STATE.teamSearch='';STATE.teamStatus='ALL';STATE.workerFilter='';STATE.teamHistory={};
  STATE.jobs=[];STATE.reports=[];STATE.team=[];STATE.canCreateWorker=false;STATE.audit=[];STATE.dashboard={};
  STATE.sources=null;STATE.detail=null;STATE.openJob=null;STATE.editingJob=null;
  STATE.financeDrafts={};STATE.notes={};STATE.issues={};STATE.reviewNotes={};
  STATE.search='';STATE.filter='';STATE.statusFilter='ACTIVE';STATE.sortBy='operational';
  STATE.quickFilter='';STATE.advancedFilters=false;STATE.categoryFilter='ALL';
  STATE.listScroll=0;STATE.dueFilter='ALL';STATE.loading=false;STATE.offline=false;STATE.brief='';
  STATE.detailTab='info';STATE.scheduleDate='';STATE.scheduleWorker='ALL';STATE.scheduleDrafts={};
  for(const key of Object.keys(LOCAL_PHOTO_PREVIEWS))delete LOCAL_PHOTO_PREVIEWS[key];
}
function showLogin(){resetSessionData();STATE.me=null;$('appView').hidden=true;$('loginView').hidden=false;$('password').value='';$('loginError').hidden=true}
function showApp(me){resetSessionData();STATE.me=me;restoreReportDrafts();setTheme(document.documentElement.dataset.theme);STATE.view=me.role==='worker'?'jobs':'overview';STATE.statusFilter=me.role==='worker'?'CURRENT':'ACTIVE';$('appView').hidden=false;$('loginView').hidden=true;$('avatar').textContent=me.role==='worker'?'MO':'AK';renderNav();connection();}

function renderNav(){
  if(!STATE.me)return;
  const a=getNav(STATE.me.role);
  for(const id of ['sideNav','mobileNav']){
    $(id).innerHTML=a.map(([key,ico,name])=>`<button type="button" class="${id==='sideNav'?'nav-item ':''}${STATE.view===key?'active':''}" data-nav="${key}" aria-label="${esc(name)}" ${STATE.view===key?'aria-current="page"':''}><span ${id==='sideNav'?'class="navico"':''} aria-hidden="true">${ico}</span>${id==='mobileNav'?`<span>${esc(mobileNavName(key,name))}${key==='chat'&&STATE.chatUnread?' ('+STATE.chatUnread+')':''}</span>`:esc(name)+(key==='chat'&&STATE.chatUnread?' ('+STATE.chatUnread+')':'')}</button>`).join('');
  }
}

function go(v){STATE.view=v;STATE.openJob=null;STATE.editingJob=null;STATE.detail=null;render();if(v==='chat')void chatController()?.load();window.scrollTo({top:0,behavior:'smooth'})}
function chatController(){
 const chat=globalThis.AKPChat;if(!chat)return null;
 chat.configure({api,me:()=>STATE.me,jobs:()=>STATE.jobs,changed:()=>{if(STATE.view==='chat')render();},unread:n=>{STATE.chatUnread=n;if(STATE.me)renderNav();},openJob:id=>{STATE.view='jobs';void jobOpen(id);}});return chat;
}
function drawingController(){const d=globalThis.AKPDrawing;if(d)d.configure({api,me:()=>STATE.me,changed:()=>{if(STATE.openJob)render();},toast});return d;}
function mediaController(){drawingController();const m=globalThis.AKPMedia;if(m)m.configure({api,me:()=>STATE.me,changed:()=>{if(STATE.openJob)render();},toast});return m;}
function materialController(){const m=globalThis.AKPMaterials;if(m)m.configure({api,me:()=>STATE.me,changed:()=>{if(STATE.openJob)render();},toast});return m;}
function proController(){const pro=globalThis.AKPPro;if(pro)pro.configure({api,me:()=>STATE.me,changed:()=>{if(STATE.openJob)render();},toast});return pro;}
function chatPage(){return chatController()?.view()||empty('Komunikator nie jest dostępny.');}

async function refresh(){
  if(!STATE.me)return;
  const epoch=STATE.sessionEpoch;
  STATE.loading=true;
  const coordinator=STATE.me.role==='coordinator';
  try{
    const tasks=[api('/jobs'),api('/reports'),...(coordinator?[api('/dashboard'),api('/team'),api('/audit'),api('/sources')]:[])];
    const data=await Promise.all(tasks);
    if(epoch!==STATE.sessionEpoch||!STATE.me)return; // A different user signed in/out.
    STATE.jobs=data[0].items;
    if(STATE.categoryFilter!=='ALL'&&!STATE.jobs.some(j=>jobCategory(j)===STATE.categoryFilter))STATE.categoryFilter='ALL';
    STATE.reports=data[1].items;
    if(coordinator){
      STATE.dashboard=data[2];
      STATE.team=data[3].items;STATE.canCreateWorker=data[3].can_create===true;
      STATE.audit=data[4].items;
      STATE.sources=data[5];
    }
    STATE.offline=false;
  }catch(err){
    if(epoch!==STATE.sessionEpoch||!STATE.me)return;
    STATE.offline=true;
    connection();
    toast(err.message,true);
  }finally{
    if(epoch===STATE.sessionEpoch&&STATE.me){STATE.loading=false;render();void chatController()?.notifications();}
  }
}

function header(t,s,extra=''){
  const offlineHtml=STATE.offline?`<div class="offline-banner"><div><strong>⚠️ Brak połączenia z serwerem.</strong><span> Nie pobrano ani nie zapisano najnowszych zmian.</span></div><button class="btn small" data-action="refresh">↻ Ponów próbę</button></div>`:'';
  return offlineHtml+`<div class="page-hero"><div><h1>${t}</h1><p>${s}</p></div><div class="hero-actions">${extra}</div></div>`;
}
function card(t,c){return `<section class="card"><div class="card-head"><h2>${t}</h2></div>${c}</section>`}
function metric(ico,value,label){return `<div class="metric"><div class="ico">${ico}</div><div class="value">${esc(value)}</div><div class="label">${label}</div></div>`}
function empty(s){return `<div class="empty">${s}</div>`}
function workerEmpty(title,hint){return `<div class="empty worker-empty"><div class="empty-ico">📋</div><p>${esc(title)}</p><small>${esc(hint)}</small></div>`}
function tag(s){const t=s||'NOWE';const cl=['KRYTYCZNY','WYSOKI','SUBMITTED'].includes(t)?'red':['REALIZACJA','ACCEPTED'].includes(t)?'green':'gray';return `<span class="tag ${cl}">${esc(t)}</span>`}
function refreshBtn(){return `<button class="btn" data-action="refresh" ${STATE.loading?'disabled':''}>${STATE.loading?'↻ Odświeżanie...':'↻ Odśwież'}</button>`}

function operationalBrief(mode){
  const jobs=STATE.jobs,reports=STATE.reports;
  let lines=[];
  if(mode==='priorities'){
    const urgent=jobs.filter(x=>['KRYTYCZNY','WYSOKI'].includes(x.priority));
    const today=new Date().toISOString().slice(0,10),overdue=jobs.filter(x=>x.due&&x.due<today&&!['ZAKONCZONE'].includes(x.status));
    lines=[`FAKT: ${urgent.length} zleceń o wysokim lub krytycznym priorytecie.`,`FAKT: ${overdue.length} niezakończonych zleceń ma datę wcześniejszą niż dzisiaj.`,`REKOMENDACJA: Zweryfikuj terminy tych spraw przed przydziałem ekip.`];
  }else if(mode==='crew'){
    const free=jobs.filter(x=>!(x.assignees?.length||x.assignee)),groups={};
    jobs.filter(x=>(x.assignees?.length||x.assignee)&&x.due).forEach(x=>{
      const list=x.assignees?.length?x.assignees:[x.assignee];
      list.forEach(a=>{
        const key=a+'/'+x.due;
        (groups[key]??=[]).push(x);
      });
    });
    const collisions=Object.values(groups).filter(x=>x.length>1);
    lines=[`FAKT: ${free.length} zleceń nie ma przypisanego pracownika.`,`OSTRZEŻENIE: ${collisions.length} grup możliwych kolizji (ten sam monter, ten sam dzień).`,`REKOMENDACJA: Sprawdź rzeczywiste godziny i dostępność; data dzienna nie dowodzi kolizji.`];
  }else{
    const pending=reports.filter(x=>x.status==='SUBMITTED'),issues=pending.filter(x=>x.issue);
    lines=[`FAKT: ${pending.length} raportów oczekuje na przegląd.`,`FAKT: ${issues.length} zgłoszeń zawiera opis problemu.`,`REKOMENDACJA: Zacznij od raportów z opisem przeszkód.`];
  }
  STATE.brief=lines.map((x,i)=>`<div class="step"><b>${i+1}</b><span>${esc(x)}</span></div>`).join('');render();
}

function isClosedJob(j){return ['ZAKONCZONE','ANULOWANE'].includes(j.status);}
function sortOperationalJobs(jobs, sortBy='operational'){
  const priority={KRYTYCZNY:0,WYSOKI:1,NORMALNY:2};
  const dateOf=x=>x.due||x.due_date||'';
  return [...jobs].sort((a,b)=>{
    const ended=Number(isClosedJob(a))-Number(isClosedJob(b));
    if(ended)return ended;
    let n=0;
    if(sortBy==='priority')n=(priority[a.priority]??3)-(priority[b.priority]??3);
    else if(sortBy==='recent')n=String(b.updated_at||'').localeCompare(String(a.updated_at||''));
    else if(sortBy==='reference')n=String(a.reference||'').localeCompare(String(b.reference||''),'pl');
    else {
      const ad=dateOf(a),bd=dateOf(b);
      if(!ad&&bd)return -1;
      if(ad&&!bd)return 1;
      n=String(ad).localeCompare(String(bd));
    }
    return n || (priority[a.priority]??3)-(priority[b.priority]??3) || String(a.reference||a.id||'').localeCompare(String(b.reference||b.id||''),'pl');
  });
}
function todayLocalISO(){
 const d=new Date();
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
}

function tomorrowLocalISO(){
 const d=new Date();d.setDate(d.getDate()+1);
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
}
// Only explicit metadata is a category; job titles are never classified by guesswork.
function jobCategory(j){
 // Never infer a category from a title. Unclassified work remains in "Wszystkie".
 const raw=String(j.category||j.work_type||'').trim().toUpperCase();
 return ({POMIAR:'POMIARY',POMIARY:'POMIARY',KUCHNIA:'KUCHNIE',KUCHNIE:'KUCHNIE',REMONT:'REMONTY',REMONTY:'REMONTY'})[raw]||'';
}
function dayPlan(day,label){
 const jobs=sortOperationalJobs(STATE.jobs.filter(j=>!isClosedJob(j)&&(j.due||j.due_date)===day));
 return `<section class="f04a-day-plan"><h3>${esc(label)} <small>${fmtDate(day)}</small></h3><div class="f04a-plan-track">${jobs.map(j=>`<button type="button" class="f04a-plan-job" data-queue-job="${esc(j.id)}"><small>${esc(t('timeNotSet'))}</small><strong>${esc(j.reference||j.id.slice(0,8))}</strong><span>${esc(j.title)}</span><span>📍 ${esc(j.location||t('addressMissing'))}</span></button>`).join('')||empty(t('noJobs'))}</div></section>`;
}
function overview(){
 const active=STATE.jobs.filter(j=>!isClosedJob(j));
 const today=todayLocalISO(),tomorrow=tomorrowLocalISO();
 const dueOf=j=>j.due||j.due_date||'';
 const newJobs=active.filter(j=>['NOWE','DO_KONTAKTU','DO_UMOWIENIA'].includes(j.status)).length;
 const mainCards=[
   ['✦',newJobs,t('filterNew'),'NEW'],
   ['▦',active.filter(j=>dueOf(j)===today).length,t('filterToday'),'TODAY'],
   ['▦',active.filter(j=>dueOf(j)===tomorrow).length,t('tomorrow'),'TOMORROW']
 ];
 // The lean /api/jobs list does not include assignment metadata. Never interpret
 // a missing assignees property as "no crew": doing so invents KPI numbers.
 const crewDataReliable=active.length>0&&active.every(j=>Array.isArray(j.assignees));
 const extraCards=[
   ['▦̸',active.filter(j=>!dueOf(j)).length,t('toSchedule'),'NODATE'],
   ['⚠',active.filter(j=>dueOf(j)&&dueOf(j)<today).length,t('filterOverdue'),'OVERDUE'],
   ['✓',active.filter(j=>j.status==='DO_ODBIORU').length,t('toAccept'),'ACCEPT'],
   ['≡',active.filter(j=>['DO_WYCENY','WYCENA_W_TOKU'].includes(j.status)).length,t('dashboardAwaiting'),'QUOTE'],
   ['○',active.filter(j=>j.status==='DO_ROZLICZENIA').length,t('toSettle'),'SETTLE'],
   ['▤',active.length,t('allActive'),'ACTIVE'],
   ...(crewDataReliable?[['♙',active.filter(j=>j.assignees.length===0).length,t('dashboardUnassigned'),'UNASSIGNED']]:[])
 ];
 const tile=([ico,n,label,filter])=>`<button type="button" class="f04a-kpi" data-dashboard-filter="${filter}" aria-label="${esc(label)}: ${n}"><span class="f04a-kpi-icon" aria-hidden="true">${ico}</span><strong>${n}</strong><span>${esc(label)}</span></button>`;
 return header(t('navOverview'),'',refreshBtn())
  + `<section class="f04a-dashboard" aria-label="Szybki podgląd aktywnych zleceń">
     <p class="f04a-active-explainer"><strong>${active.length}</strong> ${esc(t('dashboardActiveLabel'))} · ${esc(t('dashboardArchiveHint'))}</p>
     <div class="f04a-kpi-grid">${mainCards.map(tile).join('')}</div>
     <details class="f04a-more-kpis"><summary>${esc(t('dashboardMore'))}</summary><div class="f04a-kpi-grid">${extraCards.map(tile).join('')}</div></details>
    </section>`
  + card(t('dayPlan'),dayPlan(today,t('filterToday'))+dayPlan(tomorrow,t('tomorrow')));
}
function jobEditForm(j) {
  if (STATE.detail?.id !== j.id) {
    return `
      <div class="job-edit-form" id="edit-form-${esc(j.id)}" data-job-id="${esc(j.id)}">
        <div class="loading-box"><div class="spinner"></div> Pobieranie pełnych danych zlecenia do edycji...</div>
      </div>
    `;
  }
  return `
    <form class="job-edit-form" id="edit-form-${esc(j.id)}" data-job-id="${esc(j.id)}" data-dirty="false">
      <div class="edit-form-header">
        <div>
          <h3>Edycja zlecenia · ${esc(j.reference || j.id.slice(0, 8))}</h3>
          <span class="dirty-indicator" id="dirty-indicator-${esc(j.id)}" hidden>⚠️ Masz niezapisane zmiany</span>
        </div>
        <button type="button" class="btn small" data-cancel-edit="${esc(j.id)}">✕ Anuluj edycję</button>
      </div>
      <div class="form-error" id="edit-error-${esc(j.id)}" role="alert" hidden></div>
      
      <div class="form-grid">
        <label>Nazwa zlecenia * (min. 3 znaki)
          <input name="title" value="${esc(j.title)}" minlength="3" maxlength="180" required placeholder="np. Montaż mebli kuchennych">
        </label>
        <label>Referencja główna (np. LM / AKP)
          <input name="reference" value="${esc(j.reference || '')}" maxlength="80" placeholder="np. LM/2026/04/101">
        </label>
      </div>

      <h4>Identyfikatory zewnętrzne i wewnętrzne</h4>
      <div class="form-grid">
        <label>ID AKP
          <input name="akp_id" value="${esc(j.akp_id || '')}" maxlength="50" placeholder="np. AKP-2026-0042">
        </label>
        <label>Numer Leroy Merlin (LM)
          <input name="lm_number" value="${esc(j.lm_number || '')}" maxlength="50" placeholder="np. LM-987654">
        </label>
        <label>Numer iProc
          <input name="iproc_number" value="${esc(j.iproc_number || '')}" maxlength="50" placeholder="np. iProc-12345">
        </label>
        <label>Termin realizacji
          <input type="date" name="due_date" value="${esc(j.due || j.due_date || '')}">
        </label>
      </div>

      <h4>Dane kontaktowe klienta</h4>
      <div class="form-grid">
        <label>Imię i nazwisko klienta
          <input name="client_name" value="${esc(j.client_name || '')}" maxlength="120" placeholder="np. Jan Kowalski">
        </label>
        <label>Telefon klienta
          <input name="client_phone" value="${esc(j.client_phone || '')}" maxlength="50" placeholder="+48 ...">
        </label>
        <label>Adres e-mail klienta
          <input name="client_email" type="email" value="${esc(j.client_email || '')}" maxlength="120" placeholder="klient@przyklad.pl">
        </label>
        <label>Miasto / rejon (lokalizacja)
          <input name="location" value="${esc(j.location || '')}" maxlength="200" placeholder="np. Warszawa, Mokotów">
        </label>
      </div>
      <label>Dokładny adres realizacji montażu
        <input name="client_address" value="${esc(j.client_address || '')}" maxlength="200" placeholder="np. ul. Marszałkowska 10/12, Warszawa">
      </label>

      <h4>Status i priorytet operacyjny</h4>
      <div class="form-grid">
        <label>Status
          <select name="status">
            ${ALLOWED_STATUS.map(st => `<option value="${st}" ${j.status === st ? 'selected' : ''}>${st}</option>`).join('')}
          </select>
        </label>
        <label>Priorytet
          <select name="priority">
            ${ALLOWED_PRIORITY.map(pr => `<option value="${pr}" ${j.priority === pr ? 'selected' : ''}>${pr}</option>`).join('')}
          </select>
        </label>
      </div>

      <label class="akp-u-mt10">Instrukcje dla wykonawców
        <textarea name="instructions" maxlength="2500">${esc(j.instructions || '')}</textarea>
      </label>

      <div class="toolbar akp-u-mt16">
        <button type="submit" class="btn primary">💾 Zapisz zmiany w zleceniu</button>
        <button type="button" class="btn" data-cancel-edit="${esc(j.id)}">✕ Anuluj</button>
      </div>
    </form>
  `;
}

function crewSection(j, isStandalone=false) {
  const assignedIds = Array.isArray(j.assignees) ? j.assignees : (j.assignee ? [j.assignee] : []);
  const assignedMembers = assignedIds.map(id => STATE.team.find(t => t.id === id) || { id, display: 'Monter ' + id.slice(0, 8) });
  const unassignedWorkers = STATE.team.filter(t => t.is_active!==false && !assignedIds.includes(t.id));

  return `
    <div class="crew-section">
      <div class="card-head akp-u-mb12">
        <h3>Ekipa wykonawcza (${assignedMembers.length})</h3>
        <span class="meta">${assignedMembers.length ? `${assignedMembers.length} w zespole` : 'Brak przydziału'}</span>
      </div>
      ${assignedMembers.length ? `
        <div class="crew-list">
          ${assignedMembers.map(m => `
            <div class="crew-member-row">
              <span class="crew-name">♙ <strong>${esc(m.display)}</strong> <small>(${esc(m.id.slice(0, 8))})${m.is_active===false?' · Konto nieaktywne':''}</small></span>
              <button type="button" class="btn small warn" data-unassign-job="${esc(j.id)}" data-unassign-worker="${esc(m.id)}" data-worker-name="${esc(m.display)}" aria-label="Odepnij montera ${esc(m.display)}">✕ Odepnij</button>
            </div>
          `).join('')}
        </div>
      ` : '<p class="hint">Brak przypisanych monterów do tego zlecenia.</p>'}
      ${teamHistoryPanel('job',j.id)}
      <div class="crew-add-bar">
        <select id="add-worker-${esc(j.id)}" aria-label="Wybierz montera do przydzielenia" ${unassignedWorkers.length === 0 ? 'disabled' : ''}>
          <option value="">${unassignedWorkers.length === 0 ? '-- Brak aktywnych monterów do dodania --' : '-- Wybierz montera do przydzielenia --'}</option>
          ${unassignedWorkers.map(w => `<option value="${esc(w.id)}">${esc(w.display)}</option>`).join('')}
        </select>
        <button type="button" class="btn primary full-mobile" data-add-assignee="${esc(j.id)}" ${unassignedWorkers.length === 0 ? 'disabled' : ''}>+ Dodaj montera</button>
      </div>
    </div>
  `;
}

function jobDetail(j, worker) {
  if (STATE.openJob === j.id && STATE.detail?.id !== j.id) {
    return `
      <div class="job-detail">
        <div class="loading-box"><div class="spinner"></div> Ładowanie szczegółów zlecenia...</div>
      </div>
    `;
  }

  // Jeśli formularz edycji koordynatora jest aktywny, pokazujemy formularz
  if (!worker && STATE.editingJob === j.id) {
    return `<div class="job-detail">${jobEditForm(j)}</div>`;
  }

  const tasks = STATE.detail?.id === j.id ? STATE.detail.checklist : null;
  const photos = STATE.detail?.id === j.id ? (STATE.detail.photos || []) : [];
  const assignedIds = Array.isArray(j.assignees) ? j.assignees : (j.assignee ? [j.assignee] : []);
  const assignedMembers = assignedIds.map(id => STATE.team.find(t => t.id === id) || { id, display: 'Monter ' + id.slice(0, 8) });

  const clientPhone = j.client_phone || '';
  const clientAddr = j.client_address || j.location || '';
  const verifiedAddress = String(j.client_address || '').trim();
  const clientName = j.client_name || '';
  const clientEmail = j.client_email || '';
  const digits = String(clientPhone).replace(/[^\d]/g,'');
  const telHref = digits.length >= 7 && digits.length <= 15 ? `tel:${esc(clientPhone.replace(/[^\d+]/g, ''))}` : '';

  // F04A: all sections share a scrollable page; these are anchor shortcuts, not tabs.
  const sections = [
    {id:'info',label:t('tabInfo'),icon:'ℹ️'},
    ...(!worker?[{id:'crew',label:t('tabCrew'),icon:'♙'}]:[]),
    {id:'tasks',label:t('tabTasks'),icon:'✓'},
    {id:'photos',label:t('tabPhotos'),icon:'📷'},
    {id:'materials',label:'Materiały',icon:'▦'},
    ...(!worker?[{id:'finance',label:t('tabFinance'),icon:'💰'},{id:'quote',label:'Wyceny PRO',icon:'▤'}]:[])
  ];
  const tabBar = `
    <nav class="f04a-detail-jump" aria-label="${esc(t('jumpLabel'))}">
      ${sections.map(section=>`<button type="button" class="f04a-jump" data-jump-section="${section.id}">${section.icon} ${esc(section.label)}</button>`).join('')}
    </nav>
  `;
  const actions = `
    <div class="f04a-quick-actions" aria-label="Szybkie akcje">
      ${telHref ? `<a class="btn f04a-action" href="${telHref}">📞 ${esc(t('quickCall'))}</a>` : `<span class="f04a-muted-action">${esc(t('phoneMissing'))}</span>`}
      ${verifiedAddress ? `<a class="btn f04a-action" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(verifiedAddress)}" target="_blank" rel="noopener noreferrer">📍 ${esc(t('quickNavigate'))}</a>` : `<span class="f04a-muted-action">${esc(t('addressMissing'))}</span>`}
      ${worker ? `<button type="button" class="btn f04a-action" data-jump-section="photos" data-focus-photo="1">📷 ${esc(t('quickPhoto'))}</button>` : `<button type="button" class="btn f04a-action" data-edit-job="${esc(j.id)}">✏️ ${esc(t('quickEdit'))}</button><button type="button" class="btn f04a-action" data-jump-section="photos">📷 ${esc(t('quickPhotos'))}</button>`}
    </div>
  `;

  // Content for TAB 1: INFORMACJE
  const clientBox = (clientName || clientPhone || clientAddr || clientEmail) ? `
    <div class="client-info-box">
      <h4>${t('clientContact')}</h4>
      ${clientName ? `<div class="detail-row"><span>${t('clientLabel')}</span><strong>${esc(clientName)}</strong></div>` : ''}
      ${telHref ? `<div class="detail-row"><span>${t('clientPhone')}</span><strong><a href="${telHref}">${esc(clientPhone)}</a></strong></div>` : ''}
      ${clientEmail ? `<div class="detail-row"><span>E-mail</span><strong><a href="mailto:${esc(clientEmail)}">${esc(clientEmail)}</a></strong></div>` : ''}
      ${verifiedAddress ? `<div class="detail-row"><span>${t('clientAddress')}</span><strong><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(verifiedAddress)}" target="_blank" rel="noopener noreferrer">${esc(verifiedAddress)} ↗</a></strong></div>` : (clientAddr ? `<div class="detail-row"><span>${t('clientAddress')}</span><strong>${esc(clientAddr)}</strong></div>` : '')}
    </div>
  ` : `<p class="hint">${t('noClientData')}</p>`;

  const identifiers = (j.akp_id || j.lm_number || j.iproc_number) ? `
    <div class="detail-row">
      <span>Numery referencyjne</span>
      <strong>${esc([j.akp_id && `AKP: ${j.akp_id}`, j.lm_number && `LM: ${j.lm_number}`, j.iproc_number && `iProc: ${j.iproc_number}`].filter(Boolean).join(' · '))}</strong>
    </div>
  ` : '';

  const infoContent = `
    <div class="tab-pane active" id="pane-info">
      ${!worker ? `
        <div class="job-admin-bar">
          <button type="button" class="btn warn full-mobile" data-edit-job="${esc(j.id)}">✏️ Edytuj dane zlecenia</button>
        </div>
      ` : ''}
      ${identifiers}
      ${clientBox}
      <div class="detail-row"><span>${t('jobInstructions')}</span><strong>${esc(j.instructions || 'Brak instrukcji')}</strong></div>
      ${!worker ? sourceDetail(j) : ''}
    </div>
  `;

  // Content for TAB 2: EKIPA
  const crewContent = `
    <div class="tab-pane active" id="pane-crew">
      ${!worker ? crewSection(j) : `
        <div class="crew-section">
          <h3>${t('tabCrew')} (${assignedMembers.length})</h3>
          ${assignedMembers.length ? `
            <div class="crew-list">
              ${assignedMembers.map(m => `
                <div class="crew-member-row">
                  <span class="crew-name">♙ <strong>${esc(m.display)}</strong></span>
                </div>
              `).join('')}
            </div>
          ` : '<p class="hint">Brak przypisanych monterów.</p>'}
        </div>
      `}
    </div>
  `;

  // Content for TAB 3: ZADANIA
  const tasksContent = `
    <div class="tab-pane active" id="pane-tasks">
      <h3>${t('checklist')}</h3>
      ${tasks ? tasks.map(x => `<label class="step"><input type="checkbox" data-check="${esc(j.id)}" data-step="${x.index}" ${x.done ? 'checked' : ''}> <span>${esc(x.title)}</span></label>`).join('') : `<p class="hint">${t('loadingChecklist')}</p>`}
      ${worker ? `
        <div class="report-form akp-u-mt20">
          <h3>${t('reportTitle')}</h3>
          <label>${t('reportDoneWork')}<textarea data-note="${esc(j.id)}" maxlength="2000" placeholder="${t('reportDonePlaceholder')}">${esc(STATE.notes[j.id] || '')}</textarea></label>
          <label>${t('reportIssue')}<textarea data-issue="${esc(j.id)}" maxlength="1200" placeholder="${t('reportIssuePlaceholder')}">${esc(STATE.issues[j.id] || '')}</textarea></label>
          <p class="hint f04a-local-draft-notice" role="note">${esc(t('reportDraftLocal'))}</p>
          <button class="btn primary full-mobile akp-u-report-submit" data-submit="${esc(j.id)}">${t('submitReportBtn')}</button>
        </div>
      ` : ''}
    </div>
  `;

  // Content for TAB 4: ZDJĘCIA
  const photoGallery = `
    <div class="tab-pane active" id="pane-photos">
      <div class="card-head akp-u-mb8">
        <h3>${t('photosTitle')} (${photos.length})</h3>
      </div>
      <div class="safe-callout akp-u-notice-small">
        ℹ️ ${t('storageNotice')}
      </div>
      <div class="photo-gallery">
        ${photos.map(p => {
          const isLocal = !!LOCAL_PHOTO_PREVIEWS[p.storage_path];
          const externalLink = /^https?:\/\//.test(p.storage_path);
          const photoSrc = LOCAL_PHOTO_PREVIEWS[p.storage_path] || (externalLink || p.storage_path.startsWith('data:') ? p.storage_path : '/placeholder-photo.svg');
          const statusText = isLocal ? '📱 Podgląd lokalny (sesja)' : (externalLink ? '⚠️ Link niezweryfikowany' : '📄 Tylko metadane');
          const statusClass = isLocal ? 'local' : 'meta';
          return `
            <div class="photo-item">
              <div class="photo-top-bar">
                <span class="photo-tag ${esc(p.stage)}">${esc(stageLabel(p.stage))}</span>
                <span class="photo-storage-pill ${statusClass}">${statusText}</span>
              </div>
              <img src="${esc(photoSrc)}" alt="${esc(p.caption || p.stage)}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'140\\' height=\\'110\\' viewBox=\\'0 0 140 110\\'><rect width=\\'140\\' height=\\'110\\' fill=\\'%23f1f5f9\\'/><text x=\\'50%\\' y=\\'50%\\' fill=\\'%2394a3b8\\' font-size=\\'11\\' text-anchor=\\'middle\\' dy=\\'.3em\\'>ZDJĘCIE PRYWATNE</text></svg>'">
              <span class="photo-cap">${esc(p.caption || stageLabel(p.stage))}</span>
              <small class="akp-u-photo-time">${new Date(p.created_at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</small>
            </div>
          `;
        }).join('') || empty(t('noPhotos'))}
      </div>
      ${worker ? `
        <div class="photo-upload-form">
          <h4>${t('addPhotoBtn')}</h4>
          <div class="form-grid">
            <label>${t('photoStageLabel')}
              <select id="photo-stage-${esc(j.id)}">
                <option value="BEFORE">${t('photoStageBefore')}</option>
                <option value="DURING" selected>${t('photoStageDuring')}</option>
                <option value="AFTER">${t('photoStageAfter')}</option>
                <option value="DEFECT">${t('photoStageIssue')}</option>
                <option value="PROTOCOL">${t('photoStageProtocol')}</option>
              </select>
            </label>
            <label>${t('photoCaptionLabel')}
              <input id="photo-caption-${esc(j.id)}" maxlength="255" placeholder="${t('photoCaptionPlaceholder')}">
            </label>
          </div>
          <label class="akp-u-mt8">${t('photoFileLabel')}
            <input type="file" id="photo-file-${esc(j.id)}" accept="image/jpeg,image/png,image/webp,image/heic">
          </label>
          <button class="btn full-mobile akp-u-upload-btn" data-upload-photo="${esc(j.id)}">📷 ${t('addPhotoBtn')}</button>
        </div>
      ` : ''}
    </div>
  `;

  // Content for TAB 5: WYCENA I FINANSE (tylko koordynator)
  const financeContent = (!worker) ? `
    <div class="tab-pane active" id="pane-finance">
      <div class="card-head akp-u-mb8">
        <h3>Finanse i rozliczenie zlecenia</h3>
      </div>
      <div class="detail-row"><span>Przychód netto</span><strong>${money(j.revenue_net)}</strong></div>
      <div class="detail-row"><span>Koszt ekipy</span><strong>${money(j.crew_cost)}</strong></div>
      <div class="report-form akp-u-mt14">
        <h3>Zapisz kwoty operacyjne</h3>
        <div class="form-grid">
          <label>Przychód netto (zł)<input type="number" min="0" step="0.01" id="revenue-${esc(j.id)}" data-finance-draft="${esc(j.id)}" data-finance-field="revenue_net" value="${esc(STATE.financeDrafts[j.id]?.revenue_net ?? j.revenue_net ?? '')}"></label>
          <label>Koszt ekipy (zł)<input type="number" min="0" step="0.01" id="cost-${esc(j.id)}" data-finance-draft="${esc(j.id)}" data-finance-field="crew_cost" value="${esc(STATE.financeDrafts[j.id]?.crew_cost ?? j.crew_cost ?? '')}"></label>
        </div>
        <p id="finance-draft-warning-${esc(j.id)}" class="f04a-finance-warning" ${STATE.financeDrafts[j.id]?.dirty ? '' : 'hidden'}>⚠️ ${esc(t('draftUnsaved'))} — tylko ta sesja.</p>
        <button class="btn full-mobile akp-u-finance-submit" data-finance="${esc(j.id)}">💾 Zapisz kwoty w bazie</button>
      </div>
    </div>
  ` : '';

  const contents={info:infoContent,crew:crewContent,tasks:tasksContent,photos:(mediaController()?.view(j.id)||'')+'<details><summary>Dotychczasowa dokumentacja i metadane</summary>'+photoGallery+'</details>',materials:materialController()?.view(j.id)||'',finance:financeContent,quote:!worker?(proController()?.view(j.id)||''):''};
  return `
    <div class="job-detail f04a-single-detail">
      ${actions}
      ${tabBar}
      <div class="f04a-sections">
        ${sections.map(section=>`<section id="job-section-${section.id}" class="f04a-detail-section" aria-label="${esc(section.label)}"><h2 class="f04a-section-heading">${section.icon} ${esc(section.label)}</h2>${contents[section.id]}</section>`).join('')}
      </div>
    </div>
  `;
}

function jobCard(j, worker = false) {
  const active = STATE.openJob === j.id;
  const current = (active && STATE.detail?.id === j.id) ? { ...j, ...STATE.detail } : j;
  const clientPhone = current.client_phone || '';
  const clientAddr = current.client_address || current.location || '';
  const telHref = clientPhone ? `tel:${esc(clientPhone.replace(/[^\d+]/g, ''))}` : '';

  // Przyciski terenowe montera (duże, min 48px, łatwe do kliknięcia jedną ręką)
  let workerActions = '';
  if (worker) {
    workerActions = `
      <div class="worker-action-bar">
        ${clientPhone ? `<a href="${telHref}" class="btn worker-btn-call" aria-label="${t('callClient')}">📞 ${t('callClient')}</a>` : ''}
        ${clientAddr ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clientAddr)}" target="_blank" rel="noopener noreferrer" class="btn worker-btn-nav" aria-label="${t('navigate')}">📍 ${t('navigate')}</a>` : ''}
      </div>
    `;
  }

  // Przypisana ekipa — czytelne plakietki
  const assignedIds = Array.isArray(current.assignees) ? current.assignees : (current.assignee ? [current.assignee] : []);
  const assignedMembers = assignedIds.map(id => STATE.team.find(t => t.id === id) || { id, display: 'Monter ' + id.slice(0, 8) });
  const crewBadges = (!worker) ? `
    <div class="crew-badges">
      ${assignedMembers.length ? assignedMembers.map(m => `<span class="crew-badge">♙ ${esc(m.display)}</span>`).join('') : '<small class="crew-empty-badge">Ekipa: brak przydziału</small>'}
    </div>
  ` : '';

  // Wyróżnienie priorytetu
  const priorityClass = current.priority === 'KRYTYCZNY' ? 'priority-critical' : (current.priority === 'WYSOKI' ? 'priority-high' : 'priority-normal');
  const isUrgent = ['KRYTYCZNY', 'WYSOKI'].includes(current.priority);

  return `
    <article class="job-card ${priorityClass} ${active ? 'card-active' : ''}">
      <div class="job-card-header">
        <div class="job-ref">
          <span class="ref-badge">${esc(current.reference || current.akp_id || current.lm_number || current.id.slice(0, 8))}</span>
          
        </div>
        <div class="job-due-chip">
          📅 ${fmtDate(current.due || current.due_date)}
        </div>
      </div>
      
      <h3 class="job-title">${esc(current.title)}</h3>
      
      ${current.client_name ? `<p class="job-client">👤 <strong>${esc(current.client_name)}</strong></p>` : ''}
      <p class="location">📍 ${esc(clientAddr || 'Lokalizacja do potwierdzenia')}</p>
      
      ${worker ? '' : crewBadges}
      
      <div class="source-tags">
        ${tag(current.priority)}
        ${jobCategory(current)?`<span class="tag gray">${esc(t(jobCategory(current)))}</span>`:''}${tag(current.status)}
      </div>
      
      <div class="job-card-actions">
        <button class="btn primary job-toggle-btn" data-job="${esc(current.id)}" aria-expanded="${active ? 'true' : 'false'}">
          🔍 ${t('openJob')}
        </button>

      </div>
      
    </article>
  `;
}

function jobsPage() {
  const worker = STATE.me.role === 'worker';
  const title = worker ? t('workerHeroTitle') : 'Zlecenia i przydziały';
  const subtitle = worker ? t('workerHeroSubtitle') : 'Przydzielaj prace monterom i kontroluj terminy.';

  if (STATE.openJob) {
    const item=STATE.jobs.find(x=>x.id===STATE.openJob);
    if(!item)return header(t('detailTitle'),' ',`<button type="button" class="btn" data-back-jobs="1">${esc(t('backToList'))}</button>`)+empty(t('noJobs'));
    const job=(STATE.detail?.id===item.id)?{...item,...STATE.detail}:item;
    return header(t('detailTitle'),esc(item.reference||item.title),`<button type="button" class="btn" data-back-jobs="1">${esc(t('backToList'))}</button>`)
      + `<article class="f04a-detail-page">${jobDetail(job,worker)}</article>`;
  }

  const sStatus = STATE.statusFilter || 'ACTIVE';
  const sDue = STATE.dueFilter || 'ALL';
  const sText = (STATE.search || '').trim().toLowerCase();
  const today = todayLocalISO();

  // Filtrowanie po numerze LM/AKP/ref, kliencie, statusie i terminie
  const list = sortOperationalJobs(STATE.jobs.filter(x => {
    if(worker && isClosedJob(x))return false;
    if(!worker&&STATE.workerFilter&&!(x.assignees||[x.assignee]).includes(STATE.workerFilter))return false;
    if(STATE.categoryFilter!=='ALL' && jobCategory(x)!==STATE.categoryFilter)return false;
    if(sStatus==='ALL' && isClosedJob(x))return false;
    if(sStatus==='CURRENT' && (isClosedJob(x)||['NOWE','DO_KONTAKTU','DO_UMOWIENIA'].includes(x.status)))return false;
    // 1. Wyszukiwanie tekstowe (LM, AKP, iProc, ref, klient, adres, tytuł)
    if (sText) {
      const hay = [
        x.title,
        x.reference,
        x.akp_id,
        x.lm_number,
        x.iproc_number,
        x.location,
        x.client_name,
        x.client_address,
        x.client_phone
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(sText)) return false;
    }

    // 2. Filtr statusu
    if (sStatus !== 'ALL') {
      if (sStatus === 'ACTIVE' && ['ZAKONCZONE', 'ANULOWANE'].includes(x.status)) return false;
      if (sStatus === 'ZAKONCZONE' && x.status !== 'ZAKONCZONE') return false;
      if (sStatus === 'NOWE' && !['NOWE', 'DO_KONTAKTU', 'DO_UMOWIENIA'].includes(x.status)) return false;
      if (sStatus === 'REALIZACJA' && !['DO_REALIZACJI', 'W_REALIZACJI', 'POMIAR'].includes(x.status)) return false;
      if (!['ACTIVE', 'CURRENT', 'ZAKONCZONE', 'NOWE', 'REALIZACJA'].includes(sStatus) && x.status !== sStatus) return false;
    }

    // 3. Filtr terminu
    if (sDue !== 'ALL') {
      const d = x.due || x.due_date;
      if (sDue === 'TOMORROW' && d !== tomorrowLocalISO()) return false;
      if (sDue === 'TODAY' && d !== today) return false;
      if (sDue === 'OVERDUE' && (!d || d >= today || ['ZAKONCZONE', 'ANULOWANE'].includes(x.status))) return false;
      if (sDue === 'UPCOMING' && (!d || d < today)) return false;
      if (sDue === 'NODATE' && d) return false;
    }

    if (STATE.quickFilter === 'ACCEPT' && x.status!=='DO_ODBIORU')return false;
    if (STATE.quickFilter === 'SETTLE' && x.status!=='DO_ROZLICZENIA')return false;
    if (STATE.quickFilter === 'UNASSIGNED' && (x.assignees?.length || x.assignee)) return false;
    if (STATE.quickFilter === 'QUOTE' && !['DO_WYCENY','WYCENA_W_TOKU'].includes(x.status)) return false;
    return true;
  }), STATE.sortBy);

  let gridContent = '';
  if (STATE.loading && STATE.jobs.length === 0) {
    gridContent = '<div class="empty loading-box"><div class="spinner"></div> Ładowanie listy zleceń z serwera...</div>';
  } else if (list.length > 0) {
    gridContent = list.map(x => jobCard(x, worker)).join('');
  } else if (worker) {
    gridContent = workerEmpty(t('noJobs'), t('noJobsHint'));
  } else {
    gridContent = empty(t('filterNone'));
  }

  // Filtr statusów i terminów
  const filterToolbar = `
    <div class="jobs-filter-panel">
      <div class="filter-search-box">
        <input id="jobSearch" class="search-input" placeholder="🔍 ${esc(t('searchPlaceholder'))} (numer, tytuł, lokalizacja)..." value="${esc(STATE.search || '')}">
        ${STATE.search ? `<button type="button" class="btn small" data-clear-search="1" title="Wyczyść szukanie">✕</button>` : ''}
      </div>
      ${!worker?`
        ${STATE.jobs.some(j=>jobCategory(j))?`<div class="chips f04a-category-chips" aria-label="${esc(t('workCategory'))}">
          <button type="button" class="chip ${STATE.categoryFilter==='ALL'?'active':''}" data-filter-category="ALL">${esc(t('allCategories'))}</button>
          ${['POMIARY','KUCHNIE','REMONTY'].map(c=>`<button type="button" class="chip ${STATE.categoryFilter===c?'active':''}" data-filter-category="${c}" ${STATE.jobs.some(j=>jobCategory(j)===c)?'':'disabled'}>${esc(t(c))}</button>`).join('')}
        </div>`:`<p class="f04a-category-source-note">${esc(t('categoryMissing'))}</p>`}
        ${STATE.jobs.some(j=>!jobCategory(j))?`<p class="f04a-category-source-note">${esc(t('categoryEvidenceNotice'))}</p>`:''}
      `:''}
      <div class="filter-chips-row"><div class="filter-group"><div class="chips">
       ${worker?`
        <button type="button" class="chip ${sStatus==='NOWE'?'active':''}" data-filter-status="NOWE">${t('filterNew')} (!) (${STATE.jobs.filter(j=>!isClosedJob(j)&&['NOWE','DO_KONTAKTU','DO_UMOWIENIA'].includes(j.status)).length})</button>
        <button type="button" class="chip ${sStatus==='CURRENT'?'active':''}" data-filter-status="CURRENT">${t('currentJobs')} (${STATE.jobs.filter(j=>!isClosedJob(j)&&!['NOWE','DO_KONTAKTU','DO_UMOWIENIA'].includes(j.status)).length})</button>`:`
        <button type="button" class="chip ${sStatus==='NOWE'?'active':''}" data-filter-status="NOWE">${t('toSchedule')}</button>
        <button type="button" class="chip ${sStatus==='REALIZACJA'?'active':''}" data-filter-status="REALIZACJA">${t('filterInProgress')}</button>
        <button type="button" class="chip ${sStatus==='ACTIVE'||sStatus==='ALL'?'active':''}" data-filter-status="ACTIVE">${t('allActive')}</button>`}
      </div></div></div>
      <details class="f04a-advanced-filters" ${STATE.advancedFilters ? 'open' : ''}>
        <summary>⚙ ${esc(t('advancedFilters'))}${sDue!=='ALL'?' · '+esc(sDue):''}</summary>
        <div class="f04a-more-filters">
          ${worker?'':`<button type="button" class="chip ${sStatus==='ZAKONCZONE'?'active':''}" data-filter-status="ZAKONCZONE">${t('archiveLabel')}</button>`}
          <div class="filter-group">
            <span class="filter-label">${t('filterDueLabel')}</span>
            <div class="chips">
              <button type="button" class="chip ${sDue === 'ALL' ? 'active' : ''}" data-filter-due="ALL">${t('filterAnyDate')}</button>
              <button type="button" class="chip ${sDue === 'NODATE' ? 'active' : ''}" data-filter-due="NODATE">${t('toSchedule')}</button>
              <button type="button" class="chip ${sDue === 'TODAY' ? 'active' : ''}" data-filter-due="TODAY">${t('filterToday')}</button>
              <button type="button" class="chip ${sDue === 'TOMORROW' ? 'active' : ''}" data-filter-due="TOMORROW">${t('tomorrow')}</button>
              <button type="button" class="chip ${sDue === 'OVERDUE' ? 'active' : ''}" data-filter-due="OVERDUE">⚠️ ${t('filterOverdue')}</button>
            </div>
          </div>
          <label class="f04a-sort-label">${t('sortLabel')}
            <select id="jobSort" class="f04a-sort-select" aria-label="${t('sortLabel')}">
              <option value="operational" ${STATE.sortBy==='operational'?'selected':''}>${t('sortOperational')}</option>
              <option value="priority" ${STATE.sortBy==='priority'?'selected':''}>${t('sortPriority')}</option>
              <option value="recent" ${STATE.sortBy==='recent'?'selected':''}>${t('sortRecent')}</option>
              <option value="reference" ${STATE.sortBy==='reference'?'selected':''}>${t('sortReference')}</option>
            </select>
          </label>
        </div>
      </details>
      <div class="filter-summary">
        ${t('filterShown')} <strong>${list.length}</strong> ${t('filterOf')} ${STATE.jobs.length}
        ${(sText || sStatus !== 'ALL' || sDue !== 'ALL') ? `<button type="button" class="btn tiny akp-u-ml8" data-reset-filters="1">${t('filterReset')}</button>` : ''}
      </div>
    </div>
  `;

  return header(title, subtitle, refreshBtn())
    + (worker ? '' : '<details class="f04a-new-job-details"><summary>＋ Dodaj nowe zlecenie</summary>' + card('Dodaj nowe zlecenie', `<form id="jobCreate" class="job-create"><div class="form-grid"><label>Nazwa * (min. 3 znaki)<input name="title" minlength="3" maxlength="180" required placeholder="np. Montaż kuchni"></label><label>Numer / referencja<input name="reference" maxlength="80" placeholder="LM / AKP"></label><label>Lokalizacja<input name="location" maxlength="200"></label><label>Termin<input type="date" name="due_date"></label><label>Priorytet<select name="priority"><option value="NORMALNY">Normalny</option><option value="WYSOKI">Wysoki</option><option value="KRYTYCZNY">Krytyczny</option></select></label></div><label>Instrukcja<textarea name="instructions" maxlength="2500"></textarea></label><button type="submit" class="btn primary full-mobile">+ Utwórz zlecenie</button></form>`) + '</details>')
    + (worker?card(t('dayPlan'),dayPlan(today,t('filterToday'))+dayPlan(tomorrowLocalISO(),t('tomorrow'))):'')
    + (!worker&&STATE.workerFilter?`<p class="team-filter-banner">Monter: ${esc(STATE.team.find(m=>m.id===STATE.workerFilter)?.display||STATE.workerFilter)} <button type="button" class="btn" data-clear-worker="1">Wszyscy monterzy</button></p>`:'')
    + filterToolbar
    + `<div class="jobs-grid">${gridContent}</div>`;
}

// Schedule uses the existing jobs contract only; no inferred times or new SQL tables.
function validScheduleDate(value){
 return typeof value==='string'&&/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
}
function shiftScheduleDate(day,delta){
 if(!validScheduleDate(day)||!Number.isInteger(delta))return todayLocalISO();
 const date=new Date(day+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+delta);
 return date.toISOString().slice(0,10);
}
function scheduleWeekStart(day){
 if(!validScheduleDate(day))day=todayLocalISO();
 return shiftScheduleDate(day,-((new Date(day+'T12:00:00Z').getUTCDay()+6)%7));
}
function scheduleJobs(){
 const worker=STATE.me?.role==='worker';
 return sortOperationalJobs(STATE.jobs.filter(j=>!isClosedJob(j)&&(worker||STATE.scheduleWorker==='ALL'||
  (STATE.scheduleWorker==='NONE'?!(j.assignees?.length||j.assignee):(j.assignees||[j.assignee]).includes(STATE.scheduleWorker)))));
}
function schedulePage(){
 const coordinator=STATE.me?.role==='coordinator',start=STATE.scheduleDate||scheduleWeekStart(todayLocalISO());
 const jobs=scheduleJobs(),allActive=STATE.jobs.filter(j=>!isClosedJob(j));
 const counts=new Map();
 if(coordinator)for(const j of allActive)for(const id of new Set(j.assignees||[j.assignee].filter(Boolean))){
  if(j.due||j.due_date){const k=id+'/'+(j.due||j.due_date);counts.set(k,(counts.get(k)||0)+1);}
 }
 const entry=j=>{
  const due=j.due||j.due_date||'';
  const warning=coordinator&&(j.assignees||[j.assignee].filter(Boolean)).some(id=>(counts.get(id+'/'+due)||0)>1);
  const draft=Object.hasOwn(STATE.scheduleDrafts,j.id)?STATE.scheduleDrafts[j.id]:due;
  const crew=coordinator?(j.assignees||[j.assignee].filter(Boolean)).map(id=>STATE.team.find(m=>m.id===id)?.display||id.slice(0,8)).join(', '):'';
  return `<article class="schedule-job"><button type="button" class="btn" data-queue-job="${esc(j.id)}"><strong>${esc(j.reference||j.id.slice(0,8))}</strong> · ${esc(j.title)}</button><p>${esc(j.location||t('addressMissing'))}</p>${coordinator?`<p>♙ ${esc(crew||t('unassignedCrew'))}</p>`:''}${warning?`<p class="schedule-warning" role="note">${esc(t('scheduleWarning'))}</p>`:''}${coordinator?`<form class="schedule-form" data-job-id="${esc(j.id)}" data-expected-updated-at="${esc(j.updated_at||'')}"><label>${esc(t('filterDueLabel'))}<input type="date" name="due_date" aria-label="${esc(t('saveDate')+' · '+j.title)}" value="${esc(draft)}" data-schedule-draft="${esc(j.id)}"></label><button type="submit" class="btn small">${esc(t('saveDate'))}</button><p class="form-error" role="alert" hidden></p></form>`:''}</article>`;
 };
 const days=Array.from({length:7},(_,i)=>shiftScheduleDate(start,i));
 const groups=days.map(day=>card(esc(fmtDate(day)),`<div class="schedule-day">${jobs.filter(j=>(j.due||j.due_date)===day).map(entry).join('')||empty(t('noJobs'))}</div>`)).join('');
 const unscheduled=jobs.filter(j=>!(j.due||j.due_date));
 const picker=coordinator?`<label>${esc(t('allWorkers'))}<select id="scheduleWorker"><option value="ALL" ${STATE.scheduleWorker==='ALL'?'selected':''}>${esc(t('allWorkers'))}</option><option value="NONE" ${STATE.scheduleWorker==='NONE'?'selected':''}>${esc(t('unassignedCrew'))}</option>${STATE.team.map(m=>`<option value="${esc(m.id)}" ${STATE.scheduleWorker===m.id?'selected':''}>${esc(m.display)}</option>`).join('')}</select></label>`:'';
 return header(t('navSchedule'),t('scheduleNotice'),refreshBtn())+`<div class="toolbar schedule-toolbar"><button type="button" class="btn" data-schedule-shift="-7" aria-label="${esc(t('previousWeek'))}">←</button><label>${esc(t('scheduleWeek'))}<input type="date" id="scheduleDate" value="${esc(start)}"></label><button type="button" class="btn" data-schedule-shift="7" aria-label="${esc(t('nextWeek'))}">→</button>${picker}</div><div class="schedule-grid">${groups}</div>`+card(t('unscheduled'),unscheduled.map(entry).join('')||empty(t('noJobs')));
}
async function rescheduleJob(event){
 event.preventDefault();if(STATE.me?.role!=='coordinator')return;
 const form=event.target,id=form.dataset.jobId,input=form.querySelector('[name="due_date"]'),button=form.querySelector('[type="submit"]'),error=form.querySelector('.form-error');
 const due=input.value;
 if(due&&!validScheduleDate(due)){error.textContent='Nieprawidłowa data.';error.hidden=false;return;}
 STATE.scheduleDrafts[id]=due;button.disabled=true;error.hidden=true;
 const epoch=STATE.sessionEpoch;
 try{
  await api('/jobs/'+encodeURIComponent(id),{method:'PATCH',body:{due_date:due||null,expected_updated_at:form.dataset.expectedUpdatedAt}});
  if(epoch!==STATE.sessionEpoch)return;
  delete STATE.scheduleDrafts[id];
  await refresh();toast(t('dateSaved'));
 }catch(e){if(epoch===STATE.sessionEpoch){error.textContent=e.message;error.hidden=false;}}
 finally{button.disabled=false;}
}

function reportsPage(){
  const worker=STATE.me.role==='worker';
  let reportsContent='';
  if(STATE.loading && STATE.reports.length===0){
    reportsContent='<div class="empty loading-box"><div class="spinner"></div> Ładowanie raportów...</div>';
  } else if(STATE.reports.length>0){
    reportsContent=STATE.reports.map(r=>`<div class="action-line report-line"><div class="line-main"><strong>${esc(r.job_title||r.job_id)}</strong><p>${esc(r.note||'Bez opisu')}</p>${r.issue?`<div class="report-note issue">Problem: ${esc(r.issue)}</div>`:''}<small>${new Date(r.created_at).toLocaleString('pl-PL')}</small></div><div class="report-actions">${tag(r.status)}${!worker&&r.status==='SUBMITTED'?`<button class="btn primary" data-review="${esc(r.id)}" data-decision="ACCEPTED">✓ Przyjmij</button><button class="btn" data-review="${esc(r.id)}" data-decision="CHANGES_REQUESTED">↩ Popraw</button>`:''}</div></div>`).join('');
  } else if(worker){
    reportsContent=workerEmpty(t('noReports'), 'Zgłoszone raporty pojawią się na tej liście.');
  } else {
    reportsContent=empty('Nie ma jeszcze raportów.');
  }
  return header(worker?t('navReports'):'Raporty do kontroli','Każdy raport przechodzi przez etap sprawdzenia.',refreshBtn())
    + card('Raporty',`<div class="item-list">${reportsContent}</div>`);
}

function teamHistoryPanel(kind,id){
 const data=STATE.teamHistory[kind+'/'+id],attr=kind==='worker'?'data-team-history':'data-assignment-history';
 const button=`<button type="button" class="btn" ${attr}="${esc(id)}">${kind==='worker'?'Historia konta i przydziałów':'Historia przydziałów'}</button>`;
 if(!data)return button;
 return button+`<div class="team-history" aria-live="polite">${data.error?`<p class="form-error" role="alert">${esc(data.error)}</p>`:''}${data.loading?'<p>Ładowanie historii…</p>':data.items.map(e=>`<article><strong>${esc(({ACCOUNT_CREATED:'Utworzenie konta',ACCOUNT_UPDATED:'Zmiana konta',ASSIGNED:'Przydzielenie',UNASSIGNED:'Odpięcie'})[e.action]||e.action)}</strong> · <time>${esc(new Date(e.created_at).toLocaleString('pl-PL'))}</time><p>Aktor: ${esc(e.actor_id||'usługa kont — identyfikator aktora niedostępny')}</p><p>${esc(JSON.stringify(e.before))} → ${esc(JSON.stringify(e.after))}</p></article>`).join('')||'<p>Brak zdarzeń. Historia jest zbierana od uruchomienia audytu; nie odtwarzamy wcześniejszych zmian.</p>'}${data.next?`<button class="btn" type="button" ${attr}="${esc(id)}" data-history-before="${esc(data.next)}">Starsze zdarzenia</button>`:''}</div>`;
}
async function loadTeamHistory(kind,id,before){
 if(STATE.me?.role!=='coordinator')return;
 const key=kind+'/'+id,epoch=STATE.sessionEpoch,old=STATE.teamHistory[key]?.items||[];
 STATE.teamHistory[key]={items:before?old:[],loading:true,error:'',next:null};render();
 try{
  const result=await api((kind==='worker'?'/team/'+id+'/history':'/jobs/'+id+'/assignment-history')+(before?'?before='+encodeURIComponent(before):''));
  if(epoch!==STATE.sessionEpoch)return;
  STATE.teamHistory[key]={items:before?[...old,...result.items]:result.items,loading:false,next:result.next_before,error:''};
 }catch(e){if(epoch===STATE.sessionEpoch)STATE.teamHistory[key]={items:old,loading:false,error:e.message,next:before||null};}
 if(epoch===STATE.sessionEpoch)render();
}
async function inviteWorkerAccount(event){
 event.preventDefault();if(STATE.me?.role!=='coordinator')return;
 const form=event.target,fd=new FormData(form),button=form.querySelector('[type="submit"]'),error=form.querySelector('.form-error'),epoch=STATE.sessionEpoch;
 button.disabled=true;error.hidden=true;
 try{
  await api('/team/invite',{method:'POST',body:{name:fd.get('name'),email:fd.get('email'),language:fd.get('language'),confirm_access:fd.get('confirm_access')==='on'}});
  if(epoch!==STATE.sessionEpoch)return;form.reset();await refresh();toast('Zaproszenie wysłane. Monter ustawi własne hasło przez Supabase Auth.');
 }catch(e){if(epoch===STATE.sessionEpoch){error.textContent=e.message+' Sprawdź listę kont przed ponowieniem zaproszenia.';error.hidden=false;}}
 finally{button.disabled=false;}
}

function teamPage(){
  const create=STATE.canCreateWorker?`<details><summary class="btn primary">+ Dodaj montera</summary><form id="workerCreate" class="form-grid akp-u-mt16" autocomplete="off">
    <label>Imię i nazwisko<input name="name" required minlength="2" maxlength="100" autocomplete="off"></label>
    <label>E-mail do logowania<input name="email" type="email" required maxlength="250" autocomplete="off"></label>
    <label>Hasło początkowe<input name="password" type="password" required minlength="12" maxlength="128" autocomplete="new-password"></label>
    <label>Powtórz hasło<input name="confirm_password" type="password" required minlength="12" maxlength="128" autocomplete="new-password"></label>
    <label>Język panelu<select name="language"><option value="pl">Polski</option><option value="ru">Rosyjski</option><option value="uk">Ukraiński</option><option value="en">Angielski</option></select></label>
    <label><input type="checkbox" name="confirm_access" required> Potwierdzam adres pracownika i nadaję mu dostęp montera. Zobaczy wyłącznie przypisane zlecenia, bez kwot AKP.</label>
    <p>Przekaż dane logowania pracownikowi bezpiecznym kanałem. Nie wysyłamy ich automatycznie.</p>
    <div class="form-error" role="alert" hidden></div><button class="btn primary" type="submit">Utwórz konto montera</button>
  </form></details>`:`<p>Dodawanie nowych kont wymaga jeszcze uruchomienia usługi kont. Istniejącym monterom możesz przydzielać zlecenia.</p>`;
  const languages=[['pl','Polski'],['ru','Rosyjski'],['uk','Ukraiński'],['en','Angielski']];
  const members=STATE.team.filter(x=>String(x.display||'').toLocaleLowerCase().includes(STATE.teamSearch.trim().toLocaleLowerCase())&&(STATE.teamStatus==='ALL'||(STATE.teamStatus==='ACTIVE')===(x.is_active!==false))).map(x=>{
    const count=STATE.jobs.filter(j=>(j.assignees||[]).includes(x.id)).length;
    const active=x.is_active!==false;
    const safeId=esc(x.id);
    const options=languages.map(([k,v])=>`<option value="${k}" ${(x.preferred_lang||'pl')===k?'selected':''}>${v}</option>`).join('');
    return `<section class="action-line" aria-label="Monter ${esc(x.display)}">
      <div class="line-main"><strong>♙ ${esc(x.display)}</strong>
        <p>${active?'Aktywne konto':'Konto nieaktywne'} · ${count} przypisanych zleceń</p><button type="button" class="btn" data-team-jobs="${safeId}">Zlecenia montera</button></div>
      <details><summary class="btn small">Edytuj</summary>
        <form class="worker-edit-form form-grid akp-u-mt16" data-worker-id="${safeId}">
          <label>Imię i nazwisko<input type="text" name="name" value="${esc(x.display)}" required minlength="2" maxlength="100" autocomplete="off"></label>
          <label>Język panelu<select name="language">${options}</select></label>
          <p class="hint">Zmiana danych nie zmienia loginu, hasła ani roli pracownika.</p>
          <div class="form-error" role="alert" hidden></div>
          <button class="btn primary" type="submit">Zapisz zmiany</button>
        </form>
        <button type="button" class="btn" data-worker-toggle="${safeId}" data-worker-active="${active?'1':'0'}">${active?'Dezaktywuj konto':'Przywróć konto'}</button>
      </details>${teamHistoryPanel('worker',x.id)}</section>`;
  }).join('');
  const invite=STATE.canCreateWorker?`<details><summary class="btn">Zaproś do ustawienia własnego hasła</summary><form id="workerInvite" class="form-grid"><label>Imię i nazwisko<input name="name" required minlength="2" maxlength="100" autocomplete="name"></label><label>E-mail<input type="email" name="email" required maxlength="250" autocomplete="email"></label><label>Język<select name="language">${languages.map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label><input type="checkbox" name="confirm_access" required> Potwierdzam adres i dostęp montera</label><p>Monter otrzyma link Supabase Auth do ustawienia hasła. Nie generujemy ani nie zapisujemy jego hasła.</p><p class="form-error" role="alert" hidden></p><button type="submit" class="btn primary">Wyślij zaproszenie</button></form></details>`:'';
  return header('Zespół','Konta monterów, edycja i dostęp.',refreshBtn())+card('Dodaj pracownika',invite+create)+card('Monterzy',`<div class="team-filters"><label>Szukaj pracownika<input id="teamSearch" type="search" maxlength="100" value="${esc(STATE.teamSearch)}"></label><label>Status<select id="teamStatus"><option value="ALL" ${STATE.teamStatus==='ALL'?'selected':''}>Wszyscy</option><option value="ACTIVE" ${STATE.teamStatus==='ACTIVE'?'selected':''}>Aktywni</option><option value="INACTIVE" ${STATE.teamStatus==='INACTIVE'?'selected':''}>Nieaktywni</option></select></label></div><div class="item-list">${members||empty(STATE.team.length?'Brak pracowników pasujących do filtrów.':'Nie masz jeszcze kont monterów.')}</div>`);

}
async function createWorkerAccount(e){
  e.preventDefault();if(STATE.me?.role!=='coordinator')return;
  const form=e.target,fd=new FormData(form),error=form.querySelector('.form-error'),button=form.querySelector('button[type="submit"]');
  error.hidden=true;
  if(fd.get('password')!==fd.get('confirm_password')){error.textContent='Hasła nie są identyczne.';error.hidden=false;return;}
  const epoch=STATE.sessionEpoch;button.disabled=true;
  try{
    await api('/team',{method:'POST',body:{name:fd.get('name'),email:fd.get('email'),password:fd.get('password'),language:fd.get('language'),confirm_access:fd.get('confirm_access')==='on'}});
    form.reset();if(epoch!==STATE.sessionEpoch)return;await refresh();toast('Konto montera utworzone. Otwórz zlecenie i wybierz Dodaj montera.');
  }catch(err){if(epoch===STATE.sessionEpoch){error.textContent=err.message;error.hidden=false;}}
  finally{form.querySelectorAll('input[type="password"]').forEach(input=>input.value='');button.disabled=false;}
}
async function saveWorkerEdit(e){
  e.preventDefault();
  if(STATE.me?.role!=='coordinator')return;
  const form=e.target,id=form.dataset.workerId,btn=form.querySelector('[type="submit"]'),err=form.querySelector('.form-error');
  const member=STATE.team.find(x=>x.id===id);
  if(!member)return toast('Odśwież listę monterów.',true);
  const fd=new FormData(form);
  const name=String(fd.get('name')||'').trim(),language=String(fd.get('language')||'');
  if(name.length<2||name.length>100||!['pl','ru','uk','en'].includes(language)){
    err.textContent='Sprawdź imię i język.';err.hidden=false;return;
  }
  btn.disabled=true;err.hidden=true;
  try{
    await api('/team/'+encodeURIComponent(id),{method:'PATCH',body:{name,language}});
    await refresh();
    toast('Zaktualizowano dane montera.');
  }catch(e){err.textContent=e.message;err.hidden=false;btn.disabled=false;}
}
async function toggleWorkerActive(id,wasActive){
  if(STATE.me?.role!=='coordinator')return;
  const member=STATE.team.find(x=>x.id===id);
  if(!member)return toast('Nie znaleziono montera.',true);
  const active=member.is_active!==false;
  if(active!==wasActive)return toast('Lista się zmieniła. Odśwież ją.',true);
  const prompt=active
    ?`Dezaktywować konto "${member.display}"? Monter utraci dostęp przy kolejnym żądaniu, historia zleceń pozostanie. Konta nie usuwamy.`
    :`Przywrócić aktywne konto "${member.display}"?`;
  if(!confirm(prompt))return;
  const btn=document.querySelector('[data-worker-toggle="'+id+'"]');
  if(btn)btn.disabled=true;
  try{
    await api('/team/'+encodeURIComponent(id),{method:'PATCH',body:{is_active:!active}});
    await refresh();
    toast(active?'Konto montera dezaktywowane.':'Konto montera przywrócone.');
  }catch(e){toast(e.message,true);if(btn)btn.disabled=false;}
}
function auditPage(){return header('Historia zmian','Zdarzenia zapisane automatycznie przez bazę danych.',refreshBtn())+card('Ostatnie operacje',`<div class="tableish">${STATE.audit.map(x=>`<div class="audit-row"><span>${new Date(x.created_at).toLocaleString('pl-PL')}</span><strong>${esc(x.action)}</strong><span>${esc(x.entity_id.slice(0,8))}</span></div>`).join('')||empty('Brak zdarzeń do wyświetlenia.')}</div>`)}
function sourceLink(v,label){try{const u=new URL(v);if(u.protocol!=='https:'||!['drive.google.com','docs.google.com'].includes(u.hostname))return '';return `<a class="btn" target="_blank" rel="noopener noreferrer" href="${esc(u.href)}">${esc(label)} ↗</a>`}catch{return ''}}
function sourceDetail(j){const r=j.source?.record;if(!r)return '';return `<h3>Dane z Google · tylko koordynator</h3><div class="detail-row"><span>Status źródłowy</span><strong>${esc(r.STATUS)}</strong></div><div class="detail-row"><span>Klient / telefon</span><strong>${esc(r.KLIENT)} · ${esc(r.TELEFON||'—')}</strong></div><div class="detail-row"><span>Kwota źródłowa netto (nie potwierdzenie wpłaty)</span><strong>${esc(r.NETTO||'—')}</strong></div><p>${esc(r.UWAGI||'')}</p><div class="toolbar">${sourceLink(r.LINK_FOLDERU,'Teczka na Dysku')}</div>`}

function settingsPage(){
  const s=STATE.sources;
  const currentLang = STATE.me?.preferred_lang || 'pl';
  const langCard = `
    <section class="card">
      <div class="card-head"><h2>${t('selectLang')}</h2></div>
      <p class="hint">Wybierz język, w jakim ma działać Twój panel montera. Zmiana zapisuje się w Twoim profilu.</p>
      <div class="lang-selector">
        <button class="lang-btn ${currentLang==='pl'?'active':''}" data-set-lang="pl">🇵🇱 Polski</button>
        <button class="lang-btn ${currentLang==='uk'?'active':''}" data-set-lang="uk">🇺🇦 Українська</button>
        <button class="lang-btn ${currentLang==='ru'?'active':''}" data-set-lang="ru">🇷🇺 Русский</button>
        <button class="lang-btn ${currentLang==='en'?'active':''}" data-set-lang="en">🇬🇧 English</button>
      </div>
    </section>
  `;

  return header('Status systemu','Połączenia i źródła zleceń.',refreshBtn())
    + card('Konto',`<p>${esc(STATE.me.display)} · ${esc(STATE.me.role)}</p><p>Język: <b>${esc(currentLang.toUpperCase())}</b></p><a class="btn" href="/reset-password.html">${esc(({uk:'Відновити або змінити пароль',ru:'Восстановить или изменить пароль',en:'Recover or change password'})[currentLang]||'Odzyskaj lub zmień hasło')}</a>`)
    + card(t('appearance'),`<button type="button" class="btn" data-theme-toggle="1">${t('toggleTheme')}</button>`)
    + langCard
    + (STATE.me.role==='coordinator'?card('Zaawansowane',`<p class="hint">Historia zmian pozostaje dostępna do audytu, ale nie zajmuje miejsca w głównej nawigacji.</p><button type="button" class="btn" data-nav="audit">◷ Otwórz historię zmian</button><button type="button" class="btn" data-nav="reports">✓ Dziennik prac</button>`):'')
    + (STATE.me.role==='coordinator'?card('Google — centralna baza zleceń',`<p>Zaimportowane zlecenia: <strong>${s?.count||0}</strong>. Ostatni import: ${s?.last_sync?new Date(s.last_sync).toLocaleString('pl-PL'):'jeszcze nie wykonano'}.</p><p>Odświeżanie na żądanie z prywatnego arkusza. Nie zmienia plików Google. Nie nadpisuje lokalnych zmian — kolizje wymagają sprawdzenia.</p>${sourceLink('https://docs.google.com/spreadsheets/d/'+s?.sheet_id+'/edit','Otwórz bazę Google')}<label>Identyfikator aplikacji Google (Client ID)<input id="googleClientId" placeholder="…apps.googleusercontent.com" value="${esc(s?.client_id||localStorage.getItem('akp_google_client_id')||'')}"></label><p class="hint">To publiczny identyfikator OAuth ze starej konfiguracji Netlify GOOGLE_CLIENT_ID. Nie wpisuj hasła ani Client Secret. Google Cloud musi dopuszczać adres https://akp.wtf.</p><button class="btn primary" data-action="google-sync">Połącz Google i odśwież zlecenia</button><p>Gmail i Kalendarz: jeszcze niepodłączone. AI: w przygotowaniu.</p>`):'');
}

async function changeLanguage(lang){
  try {
    const res = await api('/me', {method:'PATCH', body:{preferred_lang: lang}});
    if (STATE.me) STATE.me.preferred_lang = res.profile.preferred_lang;
    setTheme(document.documentElement.dataset.theme);
    render();
    toast(t('langUpdated'));
  } catch(e) {
    toast(e.message, true);
  }
}

async function syncGoogle(){
 const id=($('googleClientId')?.value||STATE.sources?.client_id||'').trim();
 if(!/^[a-zA-Z0-9._-]+\.apps\.googleusercontent\.com$/.test(id))return toast('Wpisz publiczny Google Client ID ze starego projektu.',true);
 localStorage.setItem('akp_google_client_id',id);
 try{
  if(!window.google?.accounts?.oauth2){await new Promise((resolve,reject)=>{let tag=document.querySelector('script[data-google-sdk]');if(tag)tag.remove();tag=document.createElement('script');tag.src='https://accounts.google.com/gsi/client';tag.dataset.googleSdk='1';tag.onload=resolve;tag.onerror=()=>reject(new Error('Nie udało się uruchomić autoryzacji Google.'));document.head.append(tag)});toast('Google gotowe. Naciśnij ponownie przycisk połączenia.');return;}
  const client=google.accounts.oauth2.initTokenClient({client_id:id,scope:'https://www.googleapis.com/auth/spreadsheets.readonly',include_granted_scopes:false,callback:async response=>{if(response.error)return toast('Google nie udzielił dostępu.',true);try{const result=await api('/google/sync',{method:'POST',body:{accessToken:response.access_token}});await refresh();toast(`Import: ${result.added} nowych, ${result.updated} zmian, ${result.skipped} bez zmian, ${result.conflicts} do kontroli.`);}catch(e){toast(e.message,true)}finally{response.access_token='';}},error_callback:()=>toast('Nie zakończono autoryzacji Google.',true)});
  client.requestAccessToken({prompt:''});
 }catch(e){toast(e.message,true)}
}

function render(){
  if(!STATE.me)return;
  renderNav();
  $('currentSection').textContent=(getNav(STATE.me.role).find(x=>x[0]===STATE.view)||[])[2]||'Pulpit';
  $('headerHeadline').textContent=STATE.me.role==='worker'?`${t('workerHeroTitle')} · ${STATE.me.display}`:'AKP';
  let html='';
  if(STATE.me.role==='worker'){
    html=STATE.view==='jobs'?jobsPage():STATE.view==='schedule'?schedulePage():STATE.view==='chat'?chatPage():STATE.view==='reports'?reportsPage():settingsPage();
  }else{
    html=({overview:overview,jobs:jobsPage,reports:reportsPage,team:teamPage,schedule:schedulePage,chat:chatPage,audit:auditPage,settings:settingsPage}[STATE.view]||overview)();
  }
  $('mainContent').innerHTML=html;
  globalThis.AKPDrawing?.mount();
}

async function login(e){
  e.preventDefault();
  const epoch=STATE.sessionEpoch;
  const button=$('loginForm').querySelector('[type=submit]');
  button.disabled=true;
  $('loginError').hidden=true;
  try{
    const me=await api('/login',{method:'POST',body:{email:$('username').value.trim(),password:$('password').value}});
    if(epoch!==STATE.sessionEpoch)return;
    showApp(me);
    const activeEpoch=STATE.sessionEpoch;
    await refresh();
    if(activeEpoch===STATE.sessionEpoch&&STATE.me)toast('Zalogowano pomyślnie.');
  }catch(e){
    if(e.code==='STALE_SESSION'||epoch!==STATE.sessionEpoch&&STATE.me)return;
    $('loginError').textContent=e.message;
    $('loginError').hidden=false;
  }finally{
    button.disabled=false;
  }
}

async function logout(){try{await api('/logout',{method:'POST',body:{}})}catch{}finally{clearUserReportDrafts();showLogin();}}

async function jobOpen(id){
  if(STATE.openJob===id){
    STATE.openJob=null;
    STATE.editingJob=null;
    STATE.detail=null;
    render();
    return;
  }
  STATE.listScroll=window.scrollY||0;
  STATE.openJob=id;
  STATE.editingJob=null;
  STATE.detailTab='info';
  STATE.detail=null;
  render();
  window.scrollTo({top:0,behavior:'auto'});
  const epoch=STATE.sessionEpoch;
  try{
    const detail=(await api('/jobs/'+id)).job;
    if(epoch!==STATE.sessionEpoch||STATE.openJob!==id)return;
    STATE.detail=detail;
    render();
  }catch(e){
    if(e.code!=='STALE_SESSION'&&epoch===STATE.sessionEpoch&&STATE.openJob===id)toast(e.message,true);
  }
}

function backToJobs(){
  if(STATE.editingJob&&!checkUnsavedEdit())return;
  if(STATE.openJob&&STATE.financeDrafts[STATE.openJob]?.dirty&&!confirm(t('draftConfirm')))return;
  STATE.openJob=null;STATE.editingJob=null;STATE.detail=null;
  render();
  window.scrollTo({top:STATE.listScroll||0,behavior:'auto'});
}

function markDirty(form, dirty){
  if(!form)return;
  form.dataset.dirty = dirty ? 'true' : 'false';
  const ind = form.querySelector('.dirty-indicator');
  if(ind) ind.hidden = !dirty;
}

// ZADANIE 1: Zapis edycji zlecenia przez koordynatora (PATCH /jobs/:id)
async function saveJobEdit(e){
  e.preventDefault();
  const form=e.target;
  const jobId=form.dataset.jobId;
  const errBox=form.querySelector('.form-error');
  if(errBox) errBox.hidden=true;
  const fd=new FormData(form);

  const title=(fd.get('title')||'').trim();
  if(title.length<3){
    const msg='Błąd walidacji (422): Nazwa zlecenia musi mieć co najmniej 3 znaki.';
    if(errBox){errBox.textContent=msg;errBox.hidden=false;}
    return toast(msg,true);
  }

  const dueDate=(fd.get('due_date')||'').trim();
  if(dueDate&&!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)){
    const msg='Błąd walidacji (422): Nieprawidłowy format daty (wymagany YYYY-MM-DD).';
    if(errBox){errBox.textContent=msg;errBox.hidden=false;}
    return toast(msg,true);
  }

  const body={
    expected_updated_at:STATE.detail?.updated_at,
    title,
    reference:(fd.get('reference')||'').trim()||null,
    akp_id:(fd.get('akp_id')||'').trim()||null,
    lm_number:(fd.get('lm_number')||'').trim()||null,
    iproc_number:(fd.get('iproc_number')||'').trim()||null,
    client_name:(fd.get('client_name')||'').trim()||null,
    client_phone:(fd.get('client_phone')||'').trim()||null,
    client_email:(fd.get('client_email')||'').trim()||null,
    client_address:(fd.get('client_address')||'').trim()||null,
    location:(fd.get('location')||'').trim()||null,
    due_date:dueDate||null,
    status:fd.get('status')||'NOWE',
    priority:fd.get('priority')||'NORMALNY',
    instructions:(fd.get('instructions')||'').trim()
  };

  const submitBtn=form.querySelector('[type=submit]');
  if(submitBtn){submitBtn.disabled=true;submitBtn.textContent='⏳ Zapisywanie...';}

  try{
    await api('/jobs/'+jobId,{method:'PATCH',body});
    markDirty(form, false);
    STATE.editingJob=null;
    toast('Zapisano zmiany w zleceniu.');
    await refresh();
    STATE.detail=(await api('/jobs/'+jobId)).job;
    render();
  }catch(err){
    let prefix='Błąd zapisu: ';
    if(err.status===409)prefix='Konflikt (409): ';
    else if(err.status===422)prefix='Błąd walidacji (422): ';
    const fullMsg=prefix+err.message;
    if(errBox){errBox.textContent=fullMsg;errBox.hidden=false;}
    toast(fullMsg,true);
  }finally{
    if(submitBtn){submitBtn.disabled=false;submitBtn.textContent='💾 Zapisz zmiany w zleceniu';}
  }
}

// ZADANIE 2: Przypisanie montera do zlecenia (POST /jobs/:id/assign z body {worker: uuid})
async function addAssignee(jobId){
  if(STATE.me?.role!=='coordinator')return;
  const sel=$('add-worker-'+jobId);
  const workerId=sel?.value;
  if(!workerId)return toast('Wybierz montera z listy przed zatwierdzeniem.',true);
  const member=STATE.team.find(x=>x.id===workerId);
  if(!member||member.is_active===false)return toast('Wybierz aktywne konto montera. Odśwież listę.',true);
  const name=member?member.display:'wybranego montera';
  if(!confirm(`Przydzielić pracownika "${name}" do tego zlecenia?`))return;
  const btn=document.querySelector(`[data-add-assignee="${jobId}"]`);
  if(btn){btn.disabled=true;btn.textContent='Dodawanie...';}
  try{
    await api('/jobs/'+jobId+'/assign',{method:'POST',body:{worker:workerId}});
    toast(`Przydzielono: ${name}`);
    await refresh();
    STATE.detail=(await api('/jobs/'+jobId)).job;
    render();
  }catch(e){
    toast(e.message,true);
  }finally{
    if(btn){btn.disabled=false;btn.textContent='+ Dodaj montera';}
  }
}

// ZADANIE 2: Odpięcie konkretnego montera (POST /jobs/:id/assign z body {action:"unassign", worker: uuid})
async function unassignWorker(jobId,workerId,workerName){
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if(!uuid.test(jobId||'')||!uuid.test(workerId||''))return toast('Nieprawidłowy identyfikator. Nie wysłano żądania odpięcia montera.',true);
  if(!confirm(`Czy na pewno chcesz odpiąć pracownika "${workerName||'montera'}" od tego zlecenia?`))return;
  const btn=document.querySelector(`[data-unassign-job="${jobId}"][data-unassign-worker="${workerId}"]`);
  if(btn){btn.disabled=true;btn.textContent='Odpinanie...';}
  try{
    await api('/jobs/'+jobId+'/assign',{method:'POST',body:{action:'unassign',worker:workerId}});
    toast(`Odpięto pracownika: ${workerName||workerId}`);
    await refresh();
    STATE.detail=(await api('/jobs/'+jobId)).job;
    render();
  }catch(e){
    toast(e.message,true);
    if(btn){btn.disabled=false;btn.textContent='✕ Odepnij';}
  }
}

async function finance(id){
  const drafts=STATE.financeDrafts[id]||(STATE.financeDrafts[id]={});
  const body={
    revenue_net:drafts.revenue_net ?? document.getElementById('revenue-'+id)?.value ?? null,
    crew_cost:drafts.crew_cost ?? document.getElementById('cost-'+id)?.value ?? null
  };
  drafts.revenue_net=body.revenue_net;drafts.crew_cost=body.crew_cost;drafts.dirty=true;
  const marker=document.getElementById('finance-draft-warning-'+id);
  if(marker)marker.hidden=false;
  try{
    await api('/jobs/'+id+'/finance',{method:'PATCH',body});
    // A response from PATCH alone is not proof that the refreshed values match.
    const verified=(await api('/jobs/'+id)).job;
    const equal=(a,b)=>{
      const normalized=x=>x==null||x===''?null:Number(x);
      return normalized(a)===normalized(b);
    };
    if(!equal(verified.revenue_net,body.revenue_net)||!equal(verified.crew_cost,body.crew_cost)){
      return toast('Zapis nie został potwierdzony odczytem. Zachowano wpisane kwoty.',true);
    }
    delete STATE.financeDrafts[id];
    STATE.detail=verified;
    await refresh();
    render();
    toast('Zweryfikowano zapis kwot.');
  }catch(e){
    toast('Błąd zapisu. Zachowano kwoty robocze: '+e.message,true);
  }
}
async function check(el){el.disabled=true;try{await api('/jobs/'+el.dataset.check+'/checklist',{method:'PATCH',body:{index:Number(el.dataset.step),checked:el.checked}});STATE.detail=(await api('/jobs/'+el.dataset.check)).job;render();toast('Zapisano checklistę.')}catch(e){el.checked=!el.checked;el.disabled=false;toast(e.message,true)}}
function key(){return 'akp-'+(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random()).replace(/[^A-Za-z0-9_-]/g,'')}

async function submit(id){
  const note = (STATE.notes[id] || '').trim();
  const issue = (STATE.issues[id] || '').trim();
  if (!note && !issue) {
    return toast(t('reportEmptyError'), true);
  }
  if(!confirm(t('confirmSubmit')))return;
  try{
    await api('/jobs/'+id+'/reports',{method:'POST',body:{note,issue,idempotencyKey:key()}});
    STATE.notes[id]='';STATE.issues[id]='';clearReportDraft(id);
    await refresh();
    toast(t('reportSubmitted'));
  }catch(e){
    toast(e.message,true);
  }
}

async function uploadPhoto(jobId){
  const stageEl = $('photo-stage-' + jobId);
  const captionEl = $('photo-caption-' + jobId);
  const fileEl = $('photo-file-' + jobId);

  const stage = stageEl?.value || 'DURING';
  const caption = (captionEl?.value || '').trim();
  const file = fileEl?.files?.[0];

  if (!file) {
    return toast(t('photoSelectFile'), true);
  }

  if (file.size > 10 * 1024 * 1024) {
    return toast(t('photoSizeLimit'), true);
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const userPrefix = STATE.me?.id || '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userPrefix)) return toast(t('photoInvalidUser'), true);
  const storage_path = `${jobId}/${userPrefix}_${Date.now()}_${safeName}`.slice(0, 290);

  toast(t('uploadingPhoto'));

  try {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = reader.result;
        LOCAL_PHOTO_PREVIEWS[storage_path] = dataUrl;
        await api('/jobs/' + jobId + '/photos', {
          method: 'POST',
          body: {
            stage,
            caption,
            storage_path
          }
        });
        toast(t('photoUploaded'));
        if (captionEl) captionEl.value = '';
        if (fileEl) fileEl.value = '';
        STATE.detail = (await api('/jobs/' + jobId)).job;
        render();
      } catch(err) {
        toast(err.message, true);
      }
    };
    reader.readAsDataURL(file);
  } catch(e) {
    toast(e.message, true);
  }
}

async function review(id,decision){if(!confirm(decision==='ACCEPTED'?'Zaakceptować raport?':'Odesłać raport do poprawy?'))return;try{await api('/reports/'+id+'/review',{method:'POST',body:{decision,note:STATE.reviewNotes[id]||''}});await refresh();toast('Zapisano decyzję.')}catch(e){toast(e.message,true)}}
async function createJob(e){e.preventDefault();let form=e.target;let value=Object.fromEntries(new FormData(form).entries());try{await api('/jobs',{method:'POST',body:value});await refresh();toast('Utworzono zlecenie.')}catch(e){toast(e.message,true)}}

function checkUnsavedEdit(){
  const form=document.querySelector('.job-edit-form');
  if(form&&form.dataset.dirty==='true'){
    return confirm('Masz niezapisane zmiany w formularzu zlecenia. Czy na pewno chcesz opuścić edycję bez zapisywania?');
  }
  return true;
}

function delegate(e){
  let b=e.target.closest('button');
  if(!b)return;
  if(globalThis.AKPChat?.click(b))return;
  if(proController()?.click(b))return;
  if(materialController()?.click(b))return;
  if(mediaController()?.click(b))return;
  if(drawingController()?.click(b))return;
  if(b.dataset.teamHistory)return loadTeamHistory('worker',b.dataset.teamHistory,b.dataset.historyBefore);
  if(b.dataset.assignmentHistory)return loadTeamHistory('job',b.dataset.assignmentHistory,b.dataset.historyBefore);
  if(b.dataset.teamJobs){STATE.workerFilter=b.dataset.teamJobs;STATE.search='';STATE.categoryFilter='ALL';STATE.statusFilter='ACTIVE';STATE.dueFilter='ALL';STATE.quickFilter='';return go('jobs');}
  if(b.dataset.clearWorker){STATE.workerFilter='';render();return;}
  if(b.dataset.scheduleShift){STATE.scheduleDate=shiftScheduleDate(STATE.scheduleDate||scheduleWeekStart(todayLocalISO()),Number(b.dataset.scheduleShift));render();return;}
  if(b.dataset.workerToggle)return toggleWorkerActive(b.dataset.workerToggle,b.dataset.workerActive==='1');
  if(b.dataset.themeToggle){setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');return;}
  if(b.dataset.filterCategory){STATE.categoryFilter=b.dataset.filterCategory;STATE.statusFilter='ACTIVE';STATE.dueFilter='ALL';STATE.quickFilter='';render();return;}
  if(b.dataset.backJobs)return backToJobs();
  if(b.dataset.queueJob){STATE.view='jobs';STATE.statusFilter=STATE.me?.role==='worker'?'CURRENT':'ACTIVE';return jobOpen(b.dataset.queueJob);}
  if(b.dataset.jumpSection){
    const section=document.getElementById('job-section-'+b.dataset.jumpSection);
    if(section){
      const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      section.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});
      if(b.dataset.focusPhoto==='1')setTimeout(()=>document.getElementById('photo-file-'+STATE.openJob)?.focus(),300);
    }
    return;
  }
  if(b.dataset.dashboardFilter){
    const filter=b.dataset.dashboardFilter;
    if(filter==='REPORTS')return go('reports');
    STATE.view='jobs';STATE.openJob=null;STATE.detail=null;STATE.editingJob=null;
    STATE.statusFilter=filter==='NEW'?'NOWE':'ACTIVE';
    STATE.categoryFilter='ALL';
    STATE.dueFilter=['NODATE','OVERDUE','TODAY','TOMORROW'].includes(filter)?filter:'ALL';
    STATE.quickFilter=['UNASSIGNED','QUOTE','ACCEPT','SETTLE'].includes(filter)?filter:'';
    render();window.scrollTo({top:0,behavior:'auto'});return;
  }
  if(b.dataset.nav){
    if(STATE.editingJob&&!checkUnsavedEdit())return;
    if(STATE.openJob&&STATE.financeDrafts[STATE.openJob]?.dirty&&!confirm(t('draftConfirm')))return;
    return go(b.dataset.nav);
  }
  if(b.dataset.brief){
    if(STATE.editingJob&&!checkUnsavedEdit())return;
    return operationalBrief(b.dataset.brief);
  }
  if(b.dataset.action==='google-sync')return syncGoogle();
  if(b.dataset.action==='refresh'){
    if(STATE.editingJob&&!checkUnsavedEdit())return;
    return refresh().then(()=>toast('Dane odświeżone.')).catch(x=>toast(x.message,true));
  }
  if(b.dataset.job){
    if(STATE.editingJob&&STATE.editingJob!==b.dataset.job&&!checkUnsavedEdit())return;
    return jobOpen(b.dataset.job);
  }
  if(b.dataset.editJob){
    const id=b.dataset.editJob;
    if(STATE.editingJob&&STATE.editingJob!==id&&!checkUnsavedEdit())return;
    STATE.openJob=id;
    STATE.editingJob=id;
    render();
    if(STATE.detail?.id!==id){
      api('/jobs/'+id).then(res=>{
        STATE.detail=res.job;
        render();
      }).catch(err=>toast(err.message,true));
    }
    return;
  }
  if(b.dataset.cancelEdit){
    if(!checkUnsavedEdit())return;
    STATE.editingJob=null;
    render();
    return;
  }
  if(b.dataset.jobTab){
    STATE.detailTab = b.dataset.jobTab;
    render();
    return;
  }
  if(b.dataset.filterStatus){
    STATE.statusFilter = b.dataset.filterStatus;
    // Archive must remain discoverable even after a restrictive date filter.
    if(STATE.statusFilter==='ZAKONCZONE'){STATE.dueFilter='ALL';STATE.categoryFilter='ALL';}
    STATE.quickFilter='';
    render();
    return;
  }
  if(b.dataset.filterDue){
    STATE.dueFilter = b.dataset.filterDue;
    STATE.quickFilter='';
    render();
    return;
  }
  if(b.dataset.clearSearch){
    STATE.search = '';
    render();
    return;
  }
  if(b.dataset.resetFilters){
    STATE.search = '';
    STATE.categoryFilter='ALL';
    STATE.statusFilter = STATE.me?.role==='worker'?'CURRENT':'ACTIVE';
    STATE.dueFilter = 'ALL';
    STATE.sortBy = 'operational';
    STATE.quickFilter = '';
    render();
    return;
  }
  if(b.dataset.addAssignee)return addAssignee(b.dataset.addAssignee);
  if(b.dataset.unassignJob)return unassignWorker(b.dataset.unassignJob,b.dataset.unassignWorker,b.dataset.workerName);
  if(b.dataset.finance)return finance(b.dataset.finance);
  if(b.dataset.submit)return submit(b.dataset.submit);
  if(b.dataset.review)return review(b.dataset.review,b.dataset.decision);
  if(b.dataset.uploadPhoto)return uploadPhoto(b.dataset.uploadPhoto);
  if(b.dataset.setLang)return changeLanguage(b.dataset.setLang);
  if(['logoutTop','logoutSidebar'].includes(b.id))return logout();
}

function setTheme(theme){
 const dark=theme==='dark';
 document.documentElement.dataset.theme=dark?'dark':'light';
 try{localStorage.setItem('akp_theme',document.documentElement.dataset.theme);}catch{}
 const button=$('themeToggle');
 if(button){
  button.setAttribute('aria-pressed',String(dark));
  button.setAttribute('aria-label',t('toggleTheme'));
  button.title=t('toggleTheme');
  button.textContent=dark?'☀':'☾';
 }
}
async function boot(){
 let theme='light';try{theme=localStorage.getItem('akp_theme')||(window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light');}catch{}
 setTheme(theme);
  document.addEventListener('click',delegate);
  document.addEventListener('toggle',e=>{
    if(e.target.matches?.('.f04a-advanced-filters'))STATE.advancedFilters=e.target.open;
  },true);
  setInterval(()=>{if(STATE.me&&!document.hidden)void chatController()?.notifications();},30000);
  document.addEventListener('change',e=>{
    globalThis.AKPChat?.remember(e.target);
    globalThis.AKPPro?.change(e.target);
    globalThis.AKPMaterials?.remember(e.target);
    globalThis.AKPMedia?.remember(e.target);
    globalThis.AKPDrawing?.remember(e.target);
    const form=e.target.closest('.job-edit-form');
    if(form){
      markDirty(form, true);
      const errBox=form.querySelector('.form-error');
      if(errBox)errBox.hidden=true;
    }
    if(e.target.id==='teamStatus'){STATE.teamStatus=e.target.value;render();return;}
    if(e.target.id==='scheduleDate'){if(validScheduleDate(e.target.value)){STATE.scheduleDate=scheduleWeekStart(e.target.value);render();}return;}
    if(e.target.id==='scheduleWorker'){STATE.scheduleWorker=e.target.value;render();return;}
    if(e.target.id==='jobSort'){STATE.sortBy=e.target.value;render();return;}
    if(e.target.matches('[data-check]'))check(e.target);
  });
  document.addEventListener('input',e=>{
    const form=e.target.closest('.job-edit-form');
    if(form){
      markDirty(form, true);
      const errBox=form.querySelector('.form-error');
      if(errBox)errBox.hidden=true;
    }
    const t=e.target;
    globalThis.AKPChat?.remember(t);
    globalThis.AKPPro?.remember(t);
    globalThis.AKPMaterials?.remember(t);
    globalThis.AKPMedia?.remember(t);
    globalThis.AKPDrawing?.remember(t);
    if(t.id==='teamSearch'){STATE.teamSearch=t.value;const pos=t.selectionStart;render();const input=$('teamSearch');input.focus();input.setSelectionRange(pos,pos);return;}
    if(t.id==='jobSearch'){STATE.search=t.value;let pos=t.selectionStart;render();let n=$('jobSearch');if(n){n.focus();n.setSelectionRange(pos,pos)}}
    if(t.dataset.scheduleDraft){STATE.scheduleDrafts[t.dataset.scheduleDraft]=t.value;}
    if(t.dataset.financeDraft){
      const draft=STATE.financeDrafts[t.dataset.financeDraft]||(STATE.financeDrafts[t.dataset.financeDraft]={});
      draft[t.dataset.financeField]=t.value;
      draft.dirty=true;
      const marker=document.getElementById('finance-draft-warning-'+t.dataset.financeDraft);
      if(marker)marker.hidden=false;
    }
    if(t.dataset.note){STATE.notes[t.dataset.note]=t.value;saveReportDraft(t.dataset.note);}
    if(t.dataset.issue){STATE.issues[t.dataset.issue]=t.value;saveReportDraft(t.dataset.issue);}
    if(t.dataset.reviewnote)STATE.reviewNotes[t.dataset.reviewnote]=t.value;
  });
  document.addEventListener('submit',e=>{
    if(e.target.dataset.mediaUpload){e.preventDefault();void globalThis.AKPMedia?.upload(e.target);return;}
    if(e.target.dataset.mediaMeta){e.preventDefault();void globalThis.AKPMedia?.saveMeta(e.target);return;}
    if(e.target.dataset.materialForm){e.preventDefault();void globalThis.AKPMaterials?.submit(e.target);return;}
    if(e.target.dataset.chatForm){e.preventDefault();void globalThis.AKPChat?.submit(e.target);return;}
    if(e.target.id==='jobCreate')createJob(e);
    if(e.target.matches('.schedule-form'))rescheduleJob(e);
    if(e.target.id==='workerInvite')inviteWorkerAccount(e);
    if(e.target.id==='workerCreate')createWorkerAccount(e);
    if(e.target.matches('.worker-edit-form'))saveWorkerEdit(e);
    if(e.target.classList.contains('job-edit-form'))saveJobEdit(e);
  });
  window.addEventListener('beforeunload',e=>{
    const form=document.querySelector('.job-edit-form');
    if(globalThis.AKPPro?.dirty()||globalThis.AKPMaterials?.dirty()||globalThis.AKPMedia?.dirty()||globalThis.AKPDrawing?.dirty()||(form&&form.dataset.dirty==='true')||Object.values(STATE.financeDrafts).some(d=>d.dirty)){
      e.preventDefault();
      e.returnValue='';
    }
  });
  $('loginForm').addEventListener('submit',login);
  
  // ZADANIE 3: Usunięcie demonstracyjnego logowania — prawdziwa weryfikacja Supabase Auth
  try{
    const health=await api('/health');
    if(health.configured){
      $('startupHealth').textContent='🟢 Połączono z Supabase ('+(health.mode||'STAGING')+'). Logowanie przez Supabase Auth.';
    } else {
      $('startupHealth').textContent='⚠️ '+(health.message||'Wymagana konfiguracja bazy danych i domen.');
    }
  }catch(e){
    $('startupHealth').textContent='Status serwera: '+e.message;
  }
  try{const me=await api('/me');showApp(me);await refresh()}catch{showLogin()}
}

boot();

