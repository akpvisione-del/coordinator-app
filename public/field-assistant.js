/* AKP F04A v11 — field commands + non-executable voice-action proposals. No AI service, backend write or stored audio. */
'use strict';
(function(){
  const MAX=140;
  const LANGS={
    pl:{name:'Polecenia terenowe',hint:'Wpisz lub podyktuj polecenie. Najpierw zobaczysz podgląd — nic nie wykona się automatycznie.',placeholder:'np. pokaż jutro, znajdź LM 123, ciemny motyw',run:'Wykonaj',close:'Zamknij',mic:'Dyktuj',stop:'Zatrzymaj',unavailable:'Dyktowanie niedostępne w tej przeglądarce. Możesz wpisać polecenie.',voiceRisk:'Rozpoznawanie mowy może korzystać z usługi dostawcy przeglądarki. Nie przechowujemy audio ani transkrypcji na serwerze AKP.',none:'Wpisz polecenie.',unknown:'Nie rozpoznano polecenia — niczego nie zmieniono.',blocked:'Nie możesz otworzyć tego widoku w swojej roli.',dirty:'Najpierw zapisz albo świadomie odrzuć niezapisane zmiany.',done:'Wykonano lokalną nawigację lub filtr. Nie zmieniono danych na serwerze.',listen:'Mów teraz…',speechError:'Nie udało się rozpoznać mowy. Możesz wpisać polecenie.',help:'Przykłady: pokaż zlecenia · nowe · dziś · jutro · archiwum · znajdź LM 123 · ciemny motyw · pulpit',info:'Lokalny prototyp poleceń, bez połączenia z agentem AI.',show:'Podgląd',direct:'Dostępne polecenie',open:'Otwórz',filter:'Filtruj',find:'Szukaj',theme:'Ustaw motyw',reset:'Resetuj filtry',count:'Podsumowanie',summary:'Aktywne zlecenia: {n}. To odczyt bieżącej listy, nie analiza AI.',noCategories:'Brak potwierdzonej kategorii w danych. Nic nie ukryto ani nie zmieniono.'},
    uk:{name:'Польові команди',hint:'Введіть або продиктуйте команду. Спочатку з’явиться попередній перегляд.',placeholder:'наприклад: завтра, знайди LM 123, темна тема',run:'Виконати',close:'Закрити',mic:'Диктувати',stop:'Зупинити',unavailable:'Диктування недоступне. Введіть команду текстом.',voiceRisk:'Розпізнавання може надсилати аудіо постачальнику браузера. AKP не зберігає аудіо.',none:'Введіть команду.',unknown:'Команду не розпізнано — змін немає.',blocked:'Недостатньо прав для цього розділу.',dirty:'Спочатку збережіть або відхиліть незбережені зміни.',done:'Локальна навігація або фільтр виконані. Дані на сервері не змінено.',listen:'Говоріть зараз…',speechError:'Не вдалося розпізнати мовлення.',help:'Приклади: замовлення · нові · сьогодні · завтра · архів · знайди LM 123 · темна тема',info:'Локальний прототип команд без підключеного AI-агента.',show:'Перегляд',direct:'Доступна команда',open:'Відкрити',filter:'Фільтр',find:'Пошук',theme:'Тема',reset:'Скинути фільтри',count:'Підсумок',summary:'Активні замовлення: {n}. Це локальний список, не AI-аналіз.',noCategories:'У списку немає підтвердженого типу робіт. Фільтр не застосовано.'},
    ru:{name:'Полевые команды',hint:'Введите или продиктуйте команду. Сначала появится предварительный просмотр.',placeholder:'например: завтра, найди LM 123, тёмная тема',run:'Выполнить',close:'Закрыть',mic:'Диктовать',stop:'Остановить',unavailable:'Диктовка недоступна. Введите команду вручную.',voiceRisk:'Распознавание речи может отправлять аудио поставщику браузера. AKP не хранит аудио.',none:'Введите команду.',unknown:'Команда не распознана — изменений нет.',blocked:'Недостаточно прав для этого раздела.',dirty:'Сначала сохраните или отмените несохранённые изменения.',done:'Локальная навигация или фильтр выполнены. Данные на сервере не менялись.',listen:'Говорите сейчас…',speechError:'Не удалось распознать речь.',help:'Примеры: заказы · новые · сегодня · завтра · архив · найди LM 123 · тёмная тема',info:'Локальный прототип команд без подключённого AI-агента.',show:'Просмотр',direct:'Доступная команда',open:'Открыть',filter:'Фильтр',find:'Поиск',theme:'Тема',reset:'Сбросить фильтры',count:'Итог',summary:'Активные заказы: {n}. Это локальный список, не AI-анализ.',noCategories:'В данных нет подтверждённой категории. Фильтр не применён.'},
    en:{name:'Field commands',hint:'Type or dictate a command. Review it before running; nothing runs automatically.',placeholder:'e.g. show tomorrow, find LM 123, dark mode',run:'Run',close:'Close',mic:'Dictate',stop:'Stop',unavailable:'Voice dictation is unavailable. You can still type a command.',voiceRisk:'Speech recognition may send audio to your browser provider. AKP does not store audio or transcripts on its server.',none:'Type a command.',unknown:'Command not recognized; nothing changed.',blocked:'This view is not available for your role.',dirty:'Save or explicitly discard unsaved changes first.',done:'Local navigation or filter applied. No server data was changed.',listen:'Listening…',speechError:'Speech could not be recognized. Type the command instead.',help:'Examples: jobs · new · today · tomorrow · archive · find LM 123 · dark mode · dashboard',info:'Local command prototype; not connected to an AI agent.',show:'Preview',direct:'Available command',open:'Open',filter:'Filter',find:'Search',theme:'Theme',reset:'Reset filters',count:'Summary',summary:'Active jobs: {n}. Based on current list, not AI analysis.',noCategories:'No confirmed category data. Filter not applied.'}
  };

  // V11: explicit non-executable work plans. A draft is never an API action.
  const V11_LABELS={
    pl:{accept:'Do odbioru',quoteJobs:'Do wyceny',settle:'Do rozliczeń',examples:'Przykłady poleceń',exampleToday:'Dziś',exampleTomorrow:'Jutro',exampleJobs:'Zlecenia',exampleQuote:'Przygotuj wycenę',draftTitle:'SZKIC — nic nie zapisano',draftExplain:'To tylko lista czynności do sprawdzenia przez koordynatora. Nie działa jeszcze zapis przez AI.',draftIdentify:'Zweryfikuj zlecenie i klienta',draftDetails:'Potwierdź szczegóły, terminy i uprawnienia',draftApproval:'Zatwierdź działanie przed jakimkolwiek zapisem',draftIntent:'Żądanie',copyPlan:'Kopiuj szkic',copied:'Skopiowano szkic. Nie wysłano danych.',copyFail:'Kopiowanie niedostępne. Zaznacz tekst szkicu ręcznie.',blockedWrite:'Operacje zapisu i wysyłki wymagają przyszłej integracji AI oraz osobnego zatwierdzenia.',micConsent:'Mikrofon działa tylko po naciśnięciu Dyktuj',quickHint:'Wybierz przykład lub wpisz własne polecenie.',notSaved:'Dane nie są zapisywane ani przesyłane przez AKP.',copyHelp:'Zaznacz tekst szkicu i skopiuj.',previewTitle:'Podgląd polecenia',safeMode:'Tryb bezpieczny: tylko nawigacja i propozycje',planKindAppointment:'Termin / pomiar',planKindAssignment:'Przydział montera',planKindQuote:'Wycena',planKindMaterials:'Lista materiałów',planKindJob:'Nowe zlecenie',planKindProtocol:'Protokół',planKindMessage:'Wiadomość',planKindOther:'Plan zadania'},
    uk:{accept:'До приймання',quoteJobs:'До кошторису',settle:'До розрахунку',examples:'Приклади команд',exampleToday:'Сьогодні',exampleTomorrow:'Завтра',exampleJobs:'Замовлення',exampleQuote:'Підготуй кошторис',draftTitle:'ЧЕРНЕТКА — нічого не збережено',draftExplain:'Це лише план для перевірки координатором. AI ще не записує дані.',draftIdentify:'Перевірте замовлення та клієнта',draftDetails:'Підтвердьте деталі, терміни та доступ',draftApproval:'Підтвердьте дію до будь-якого запису',draftIntent:'Запит',copyPlan:'Копіювати чернетку',copied:'Чернетку скопійовано. Дані не надіслано.',copyFail:'Копіювання недоступне. Виділіть текст вручну.',blockedWrite:'Запис і надсилання потребують інтеграції AI та окремого підтвердження.',micConsent:'Мікрофон працює лише після натискання «Диктувати»',quickHint:'Виберіть приклад або введіть свою команду.',notSaved:'AKP не зберігає та не надсилає ці дані.',copyHelp:'Виділіть і скопіюйте текст чернетки.',previewTitle:'Попередній перегляд',safeMode:'Безпечний режим: навігація та пропозиції',planKindAppointment:'Зустріч / замір',planKindAssignment:'Призначення майстра',planKindQuote:'Кошторис',planKindMaterials:'Матеріали',planKindJob:'Нове замовлення',planKindProtocol:'Акт / протокол',planKindMessage:'Повідомлення',planKindOther:'План завдання'},
    ru:{accept:'На приёмку',quoteJobs:'На оценку',settle:'К расчёту',examples:'Примеры команд',exampleToday:'Сегодня',exampleTomorrow:'Завтра',exampleJobs:'Заказы',exampleQuote:'Подготовь смету',draftTitle:'ЧЕРНОВИК — ничего не сохранено',draftExplain:'Это лишь план для проверки координатором. AI пока не записывает данные.',draftIdentify:'Проверьте заказ и клиента',draftDetails:'Подтвердите детали, время и права',draftApproval:'Подтвердите действие до записи',draftIntent:'Запрос',copyPlan:'Копировать черновик',copied:'Черновик скопирован. Данные не отправлены.',copyFail:'Копирование недоступно. Выделите текст вручную.',blockedWrite:'Запись и отправка требуют будущей AI-интеграции и подтверждения.',micConsent:'Микрофон включается только по кнопке «Диктовать»',quickHint:'Выберите пример или введите свою команду.',notSaved:'AKP не сохраняет и не отправляет эти данные.',copyHelp:'Выделите текст черновика и скопируйте.',previewTitle:'Предпросмотр',safeMode:'Безопасный режим: навигация и предложения',planKindAppointment:'Встреча / замер',planKindAssignment:'Назначение мастера',planKindQuote:'Смета',planKindMaterials:'Материалы',planKindJob:'Новый заказ',planKindProtocol:'Акт / протокол',planKindMessage:'Сообщение',planKindOther:'План задачи'},
    en:{accept:'Awaiting acceptance',quoteJobs:'To estimate',settle:'For settlement',examples:'Example commands',exampleToday:'Today',exampleTomorrow:'Tomorrow',exampleJobs:'Jobs',exampleQuote:'Prepare a quote',draftTitle:'DRAFT — nothing saved',draftExplain:'This is only a plan for coordinator review. AI write operations are not connected.',draftIdentify:'Verify the job and customer',draftDetails:'Confirm details, date and authorization',draftApproval:'Approve before any write action',draftIntent:'Request',copyPlan:'Copy draft',copied:'Draft copied. Nothing was sent.',copyFail:'Copy unavailable. Select the draft text manually.',blockedWrite:'Writes and sends require future AI integration and separate approval.',micConsent:'Microphone activates only after Dictate is pressed',quickHint:'Select an example or enter your own request.',notSaved:'AKP does not save or send this text.',copyHelp:'Select and copy draft text.',previewTitle:'Command preview',safeMode:'Safe mode: navigation and proposals only',planKindAppointment:'Appointment / measurement',planKindAssignment:'Assign worker',planKindQuote:'Estimate',planKindMaterials:'Material list',planKindJob:'New job',planKindProtocol:'Protocol',planKindMessage:'Message',planKindOther:'Task plan'}
  };
  for(const language of Object.keys(LANGS))Object.assign(LANGS[language],V11_LABELS[language]);
  // Recognize a small list of proposed work actions, but never execute them.
  // The source phrase is kept only in memory until the dialog closes.
  function proposeFieldPlan(text){
    if(typeof text!=='string'||text.length>MAX)return null;
    const phrase=text.trim();if(phrase.length<5)return null;
    const norm=strip(phrase);
    if(/^(?:usu[nń]|delete|remove|удали|видали|оплат|pay |przelej|transfer|сделай перевод)/i.test(norm))return null;
    const patterns=[
      ['planKindAppointment',/(?:^|\s)(?:umow|zaplanuj pomiar|wizyta|termin pomiaru|schedule appointment|book measurement|признач|назнач|зустріч|встреч)/u],
      ['planKindAssignment',/(?:^|\s)(?:przydziel|przypisz monter|assign worker|assign installer|назначь мастера|признач майстра)/u],
      ['planKindQuote',/(?:^|\s)(?:wycen|kosztorys|quote|estimate|смет|кошторис)/u],
      ['planKindMaterials',/(?:^|\s)(?:materia[lł]|material list|materials|материал|матеріал)/u],
      ['planKindProtocol',/(?:^|\s)(?:protok[oó][lł]|odbior|protocol|acceptance report|акт прием|акт прийм)/u],
      ['planKindJob',/(?:^|\s)(?:dodaj zlecen|utworz zlecen|create job|new job|новый заказ|нове замов)/u],
      ['planKindMessage',/(?:^|\s)(?:wy[sś]lij|napisz wiadom|send message|send email|отправ|надішл)/u]
    ];
    const found=patterns.find(([_,rx])=>rx.test(norm));
    if(!found)return null;
    return Object.freeze({kind:'draft',category:found[0],request:phrase,write_allowed:false,confirmation_required:true});
  }
  const strip=s=>String(s||'').normalize('NFD').replace(/([a-zA-Z])[\u0300-\u036f]+/g,'$1').toLowerCase().replace(/ł/g,'l').normalize('NFC').replace(/[!?.,:;]+/g,' ').replace(/\s+/g,' ').trim();
  const RX={
    dashboard:/^(pulpit|start|dashboard|overview|головна|панель|главная|главный экран)$/,
    jobs:/^(zlecenia|pokaz zlecenia|otworz zlecenia|jobs|show jobs|orders|закази|замовлення|заказы|покажи заказы)$/,
    account:/^(konto|ustawienia|system|settings|account|налаштування|настройки|профиль)$/,
    team:/^(zespol|ekipa|team|бригада|команда)$/,
    archive:/^(archiwum|pokaz archiwum|archive|show archive|архів|архив)$/,
    new:/^(nowe|nowe zlecenia|pokaz nowe|new|new jobs|нові|новые)$/,
    current:/^(obecne|w realizacji|w toku|realizacja|current|in progress|поточні|в роботі|текущие|в работе)$/,
    today:/^(dzis|dzisiaj|pokaz dzis|today|show today|сьогодні|сегодня)$/,
    tomorrow:/^(jutro|pokaz jutro|tomorrow|show tomorrow|завтра)$/,
    overdue:/^(po terminie|zalegle|overdue|прострочені|просрочено)$/,
    noDate:/^(bez terminu|do umowienia|no date|unscheduled|без дати|без даты)$/,
    reset:/^(reset|resetuj filtry|wyczysc filtry|clear filters|reset filters|скинути фільтри|сброс фильтров)$/,
    light:/^(jasny|jasny motyw|tryb jasny|light|light mode|світла тема|светлая тема)$/,
    dark:/^(ciemny|ciemny motyw|tryb ciemny|dark|dark mode|темна тема|темная тема|темный режим)$/,
    measurements:/^(pomiary|pokaz pomiary|measurements|заміри|замеры)$/ ,
    kitchens:/^(kuchnie|pokaz kuchnie|kitchens|кухні|кухни)$/ ,
    renovations:/^(remonty|pokaz remonty|renovations|ремонти|ремонты)$/ ,
    fieldMode:/^(tryb terenowy|terenowy|field mode|польовий режим|полевой режим)$/ ,
    compactMode:/^(tryb kompaktowy|kompaktowy|compact mode|компактний режим|компактный режим)$/ ,
    summary:/^(podsumowanie|ile zlecen|summary|how many jobs|підсумок|итог)$/,
    accept:/^(do odbioru|pokaz do odbioru|for acceptance|awaiting acceptance|до приймання|на приёмку)$/,
    quoteJobs:/^(do wyceny|pokaz do wyceny|awaiting quote|to estimate|на оценку|до кошторису)$/,
    settle:/^(do rozliczenia|do rozliczen|pokaz do rozliczenia|to settle|for settlement|к расчёту|до розрахунку)$/,
    help:/^(pomoc|komendy|help|commands|допомога|помощь)$/
  };
  function parse(text){
    if(typeof text!=='string'||text.length>MAX)return null;
    const cmd=strip(text);
    if(!cmd)return null;
    for(const [k,reg] of Object.entries(RX))if(reg.test(cmd))return {kind:k};
    const match=cmd.match(/^(?:znajdz|szukaj|wyszukaj|find|search|знайди|знайти|найди|поиск)\s+(.+)$/i);
    if(match){const query=match[1].trim();if(query.length>=2&&query.length<=90)return {kind:'search',query};}
    return null;
  }
  if(typeof module!=='undefined'&&module.exports){module.exports={parseFieldIntent:parse,proposeFieldPlan,fieldPhrase:strip,fieldLanguages:LANGS};}
  if(typeof document==='undefined'||typeof window==='undefined')return;
  const getL=()=>{const l=typeof STATE!=='undefined'&&STATE.me?.preferred_lang;return LANGS[l]?l:'pl';};
  const t=k=>LANGS[getL()][k]||LANGS.pl[k]||k;
  const speechCtor=()=>window.SpeechRecognition||window.webkitSpeechRecognition;
  let recognition=null,priorFocus=null,preview=null,proposed=null;
  function label(key){const el=document.querySelector(`[data-akp-field-label="${key}"]`);if(el)el.textContent=t(key);}
  function make(){
    if(document.getElementById('akpFieldDialog'))return;
    const btn=document.createElement('button');btn.type='button';btn.id='akpFieldOpen';btn.className='btn akp-field-open';btn.setAttribute('aria-haspopup','dialog');btn.setAttribute('aria-expanded','false');btn.textContent='✦ AI';btn.title=t('name');btn.setAttribute('aria-label',t('name'));
    const top=document.querySelector('.topbar .top-right');if(top)top.insertBefore(btn,top.firstChild);
    const dialog=document.createElement('section');dialog.id='akpFieldDialog';dialog.className='akp-field-backdrop';dialog.hidden=true;dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','akpFieldTitle');dialog.innerHTML=`<div class="akp-field-panel"><div class="akp-field-head"><h2 id="akpFieldTitle" data-akp-field-label="name"></h2><button type="button" id="akpFieldClose" class="btn" data-akp-field-label="close"></button></div><p id="akpFieldHint" data-akp-field-label="hint"></p><div class="akp-field-quick" role="group" aria-label="Examples"><span data-akp-field-label="examples"></span><button type="button" data-akp-field-example="today" class="btn" data-akp-field-label="exampleToday"></button><button type="button" data-akp-field-example="tomorrow" class="btn" data-akp-field-label="exampleTomorrow"></button><button type="button" data-akp-field-example="jobs" class="btn" data-akp-field-label="exampleJobs"></button><button type="button" data-akp-field-example="quote" class="btn" data-akp-field-label="exampleQuote"></button></div><label class="akp-field-input-label" for="akpFieldInput" data-akp-field-label="direct"></label><div class="akp-field-compose"><input id="akpFieldInput" type="text" maxlength="140" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="akpFieldPrivacy akpFieldPreview" /><button type="button" id="akpFieldMic" class="btn" data-akp-field-label="mic"></button></div><p id="akpFieldPrivacy" class="akp-field-privacy" data-akp-field-label="voiceRisk"></p><div id="akpFieldPreview" class="akp-field-preview" role="status" aria-live="polite" aria-atomic="true"></div><p id="akpFieldSafeMode" data-akp-field-label="safeMode" class="akp-field-safe-mode"></p><div class="akp-field-actions"><button type="button" id="akpFieldCopy" class="btn" hidden data-akp-field-label="copyPlan"></button><button type="button" id="akpFieldExecute" class="btn primary" disabled data-akp-field-label="run"></button></div><p data-akp-field-label="help" class="akp-field-examples"></p><p data-akp-field-label="info" class="akp-field-footer"></p></div>`;
    document.body.appendChild(dialog);
    btn.addEventListener('click',open);
    document.getElementById('akpFieldClose').addEventListener('click',close);
    document.getElementById('akpFieldInput').addEventListener('input',previewIntent);
    document.getElementById('akpFieldMic').addEventListener('click',listen);
    document.getElementById('akpFieldExecute').addEventListener('click',execute);
    document.getElementById('akpFieldCopy').addEventListener('click',copyProposal);
    dialog.querySelectorAll('[data-akp-field-example]').forEach(button=>button.addEventListener('click',()=>{
      const presets={today:'today',tomorrow:'tomorrow',jobs:'jobs',quote:t('exampleQuote')};
      const input=document.getElementById('akpFieldInput');input.value=presets[button.dataset.akpFieldExample]||'';previewIntent();input.focus();
    }));
    dialog.addEventListener('click',e=>{if(e.target===dialog)close();});
    document.getElementById('akpFieldMic').setAttribute('aria-pressed','false');
  }
  function localize(){for(const k of ['name','close','hint','direct','mic','voiceRisk','run','help','info','examples','exampleToday','exampleTomorrow','exampleJobs','exampleQuote','copyPlan','safeMode'])label(k);const input=document.getElementById('akpFieldInput');if(input)input.placeholder=t('placeholder'); const quick= document.querySelector('.akp-field-quick');if(quick)quick.setAttribute('aria-label',t('examples')); const mic=document.getElementById('akpFieldMic');if(mic){mic.disabled=!speechCtor();mic.title=speechCtor()?t('mic'):t('unavailable');}}
  function open(){if(typeof STATE==='undefined'||!STATE.me)return;make();priorFocus=document.activeElement;const dlg=document.getElementById('akpFieldDialog');localize();dlg.hidden=false;document.getElementById('akpFieldOpen').setAttribute('aria-expanded','true');document.getElementById('akpFieldInput').value='';previewIntent();document.getElementById('akpFieldInput').focus();}
  function stop(){if(!recognition)return;const old=recognition;recognition=null;try{old.abort()}catch{}document.getElementById('akpFieldMic').textContent=t('mic');document.getElementById('akpFieldMic').setAttribute('aria-pressed','false');}
  function close(){const dlg=document.getElementById('akpFieldDialog');if(!dlg)return;stop();dlg.hidden=true;document.getElementById('akpFieldOpen').setAttribute('aria-expanded','false');document.getElementById('akpFieldInput').value='';preview=null;proposed=null; if(priorFocus?.isConnected)priorFocus.focus();}
  function titleFor(i){if(!i)return t('unknown');if(i.kind==='search')return t('find')+': '+i.query;
    const label={dashboard:'dashboard',jobs:'jobs',account:'settings',team:'team',archive:'archive',new:'new',current:'current',today:'today',tomorrow:'tomorrow',overdue:'overdue',noDate:'no date',reset:'reset',dark:'dark',light:'light',summary:'summary',help:'help',measurements:'measurements',kitchens:'kitchens',renovations:'renovations',accept:'accept',quoteJobs:'quoteJobs',settle:'settle',fieldMode:'field mode',compactMode:'compact mode'}[i.kind]||i.kind;
    return (['dashboard','jobs','account','team'].includes(i.kind)?t('open'):['dark','light'].includes(i.kind)?t('theme'):t('filter'))+': '+label;
  }
  function previewIntent(){
    const input=document.getElementById('akpFieldInput');if(!input)return;
    preview=parse(input.value);proposed=preview?null:proposeFieldPlan(input.value);
    const out=document.getElementById('akpFieldPreview'),run=document.getElementById('akpFieldExecute'),copy=document.getElementById('akpFieldCopy');
    if(proposed){out.textContent=[t('draftTitle'),t(proposed.category),t('draftIntent')+': '+proposed.request,t('draftIdentify'),t('draftDetails'),t('draftApproval'),t('draftExplain')].join('\n');}
    else out.textContent=preview?titleFor(preview):(input.value.trim()?t('unknown'):t('none'));
    run.disabled=!preview;copy.hidden=!proposed;
  }
  async function copyProposal(){
    if(!proposed)return;
    const draft=[t('draftTitle'),t(proposed.category),t('draftIntent')+': '+proposed.request,t('draftIdentify'),t('draftDetails'),t('draftApproval'),t('draftExplain')].join('\n');
    const out=document.getElementById('akpFieldPreview');
    try{if(!navigator.clipboard?.writeText)throw new Error('clipboard unavailable');await navigator.clipboard.writeText(draft);out.textContent=t('copied')+'\n'+draft;}
    catch{out.textContent=t('copyFail')+'\n'+draft;}
  }
  function allowLeave(){if(typeof STATE==='undefined'||!STATE.me)return false;if(STATE.editingJob&&typeof checkUnsavedEdit==='function'&&!checkUnsavedEdit())return false;if(STATE.openJob&&STATE.financeDrafts?.[STATE.openJob]?.dirty&&!window.confirm(t('dirty')))return false;return true;}
  function execute(){const i=preview;if(!i||!allowLeave())return;
    const coordinator=STATE.me.role==='coordinator';
    if(['dashboard','team','archive','measurements','kitchens','renovations','accept','quoteJobs','settle'].includes(i.kind)&&!coordinator){document.getElementById('akpFieldPreview').textContent=t('blocked');return;}
    if(['dashboard','jobs','account','team'].includes(i.kind)){
      const v={dashboard:'overview',jobs:'jobs',account:'settings',team:'team'}[i.kind];
      go(v);
    }else if(['archive','new','current','today','tomorrow','overdue','noDate','search','reset','measurements','kitchens','renovations','accept','quoteJobs','settle'].includes(i.kind)){
      const types={measurements:'POMIARY',kitchens:'KUCHNIE',renovations:'REMONTY'};
      if(types[i.kind]&&!STATE.jobs.some(j=>typeof jobCategory==='function'&&jobCategory(j)===types[i.kind])){document.getElementById('akpFieldPreview').textContent=t('noCategories');return;}
      STATE.view='jobs';STATE.openJob=null;STATE.detail=null;STATE.editingJob=null;
      STATE.categoryFilter='ALL';STATE.quickFilter='';STATE.dueFilter='ALL';STATE.statusFilter=coordinator?'ACTIVE':'CURRENT';
      if(i.kind!=='search')STATE.search='';
      if(i.kind==='archive')STATE.statusFilter='ZAKONCZONE';
      if(i.kind==='new')STATE.statusFilter='NOWE';
      if(i.kind==='current')STATE.statusFilter=coordinator?'REALIZACJA':'CURRENT';
      if(i.kind==='today')STATE.dueFilter='TODAY';
      if(i.kind==='tomorrow')STATE.dueFilter='TOMORROW';
      if(i.kind==='overdue')STATE.dueFilter='OVERDUE';
      if(i.kind==='noDate')STATE.dueFilter='NODATE';
      if(i.kind==='accept')STATE.quickFilter='ACCEPT';
      if(i.kind==='quoteJobs')STATE.quickFilter='QUOTE';
      if(i.kind==='settle')STATE.quickFilter='SETTLE';
      if(i.kind==='reset'){STATE.search='';STATE.sortBy='operational';STATE.advancedFilters=false;}
      if(i.kind==='search'){STATE.search=i.query;STATE.statusFilter=coordinator?'ACTIVE':'CURRENT';}
      if(types[i.kind])STATE.categoryFilter=types[i.kind];
      render();
    }else if(i.kind==='dark'||i.kind==='light'){
      setTheme(i.kind);
    }else if(i.kind==='fieldMode'||i.kind==='compactMode'){
      const mode=i.kind==='fieldMode'?'field':'compact';
      document.documentElement.dataset.akpDensity=mode;
      try{localStorage.setItem('akp_density',mode)}catch{}
    }else if(i.kind==='summary'){
      const n=STATE.jobs.filter(j=>!['ZAKONCZONE','ANULOWANE'].includes(j.status)).length;
      document.getElementById('akpFieldPreview').textContent=t('summary').replace('{n}',String(n));
      return;
    }else if(i.kind==='help'){
      document.getElementById('akpFieldPreview').textContent=t('help');return;
    }
    close();
    if(typeof toast==='function')toast(t('done'));
  }
  function listen(){const C=speechCtor();if(!C){document.getElementById('akpFieldPreview').textContent=t('unavailable');return;}if(recognition){stop();return;}
    try{const rec=new C();recognition=rec;rec.lang=({pl:'pl-PL',uk:'uk-UA',ru:'ru-RU',en:'en-US'})[getL()];rec.interimResults=false;rec.continuous=false;rec.maxAlternatives=1;
      document.getElementById('akpFieldMic').textContent=t('stop');document.getElementById('akpFieldMic').setAttribute('aria-pressed','true');document.getElementById('akpFieldPreview').textContent=t('listen');
      rec.onresult=e=>{const transcript=e.results?.[0]?.[0]?.transcript||'';if(recognition!==rec)return;document.getElementById('akpFieldInput').value=transcript.slice(0,MAX);previewIntent();};
      rec.onerror=()=>{if(recognition!==rec)return;document.getElementById('akpFieldPreview').textContent=t('speechError');};
      rec.onend=()=>{if(recognition===rec){recognition=null;document.getElementById('akpFieldMic').textContent=t('mic');document.getElementById('akpFieldMic').setAttribute('aria-pressed','false');}};
      rec.start();
    }catch{recognition=null;document.getElementById('akpFieldPreview').textContent=t('speechError');document.getElementById('akpFieldMic').textContent=t('mic');document.getElementById('akpFieldMic').setAttribute('aria-pressed','false');}
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  window.addEventListener('pagehide',stop);
  document.addEventListener('keydown',e=>{
    const dlg=document.getElementById('akpFieldDialog');const showing=dlg&&!dlg.hidden;
    if(showing){if(e.key==='Escape'){e.preventDefault();close();return;}if(e.key==='Enter'&&document.activeElement?.id==='akpFieldInput'){e.preventDefault();execute();return;}
      if(e.key==='Tab'){const focus=[...dlg.querySelectorAll('button:not([disabled]),input:not([disabled])')];const first=focus[0],last=focus[focus.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}return;}
    const field=['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName)||e.target?.isContentEditable;
    if(((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k')||(!field&&e.key==='/')){if(typeof STATE!=='undefined'&&STATE.me){e.preventDefault();open();}}
  });
  try{const mode=localStorage.getItem('akp_density');if(mode==='field'||mode==='compact')document.documentElement.dataset.akpDensity=mode;}catch{}
  make();
})();
