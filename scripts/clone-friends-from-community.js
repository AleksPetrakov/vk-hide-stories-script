// ========================================================
// НАСТРОЙКИ
// ========================================================

// Пауза между шагами основного цикла (мс)
const DELAY = 900;

// Пауза на первичную загрузку профиля в iframe (мс)
const IFRAME_LOAD_DELAY = 1500;

// Небольшие дополнительные задержки (мс)
const SMALL_DELAY = 250;

// Таймаут ожидания смены состояния после клика "Добавить в друзья/Отправить заявку" (мс)
const FRIEND_REQUEST_TIMEOUT = 10000;

// Интервал опроса состояния кнопок "Заявка отправлена" / "Сообщение" / "Друзья" (мс)
const FRIEND_POLL_INTERVAL = 300;

// Сколько пустых скроллов допускается (ленивая загрузка)
const MAX_EMPTY_SCROLLS = 3;

// Тексты кнопок, которые считаем "отправкой заявки"
const ADD_REQUEST_BUTTON_TEXTS = [
  'добавить в друзья',
  'отправить заявку',
];


// ========================================================
// УТИЛИТЫ
// ========================================================

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function log(...args) {
  console.log('%c[AUTO-FRIEND]', 'color:#4CAF50;font-weight:bold;', ...args);
}

// создаём iframe, если его нет
function ensureIframe() {
  let iframe = document.getElementById('auto_friend_iframe');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'auto_friend_iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '10px';
    iframe.style.bottom = '10px';
    iframe.style.width = '400px';
    iframe.style.height = '500px';
    iframe.style.zIndex = '999999';
    iframe.style.border = '2px solid #00aaff';
    iframe.style.background = '#fff';
    document.body.appendChild(iframe);
  }
  return iframe;
}

// удаляем iframe
function removeIframe() {
  const iframe = document.getElementById('auto_friend_iframe');
  if (iframe) iframe.remove();
}

// ищем элементы в модалке
function getPeopleNodes() {
  const container = document.querySelector('#box_layer_wrap .fans_rows');
  if (!container) return [];
  return [...container.querySelectorAll('.fans_fan_row')];
}

// берём href профиля
function extractHref(personNode) {
  const link = personNode.querySelector('.fans_fan_name a[href]');
  return link ? link.getAttribute('href') : null;
}

// нормализация ключа человека
function personKey(href) {
  if (!href) return null;
  return href.split('?')[0].replace('/', '').trim().toLowerCase();
}


// ========================================================
// ОПРЕДЕЛЕНИЕ СОСТОЯНИЯ ДРУЖБЫ
// ========================================================
//
// Возможные возвращаемые значения:
// 'none'       — ничего из нужного не найдено
// 'requested'  — "Заявка отправлена"
// 'message'    — "Сообщение"
// 'friend'     — кнопка с aria-label="Друзья"
//

function getFriendshipStateFromDoc(doc) {
  if (!doc) return 'none';

  const buttons = [
    ...doc.querySelectorAll('.ProfileHeaderButton button, .ProfileHeaderButton a'),
  ];

  if (!buttons.length) return 'none';

  for (const btn of buttons) {
    const text = (btn.textContent || '').trim().toLowerCase();
    const ariaLabel = (btn.getAttribute('aria-label') || '').trim().toLowerCase();

    if (text === 'заявка отправлена') {
      return 'requested';
    }

    if (text === 'сообщение') {
      return 'message';
    }

    if (ariaLabel === 'друзья') {
      return 'friend';
    }
  }

  return 'none';
}

// Ожидание изменения состояния после клика "Добавить в друзья"/"Отправить заявку"
async function waitForFriendshipState(iframe) {
  const start = Date.now();

  while (Date.now() - start < FRIEND_REQUEST_TIMEOUT) {
    await sleep(FRIEND_POLL_INTERVAL);

    try {
      const doc = iframe.contentDocument;
      const state = getFriendshipStateFromDoc(doc);

      if (state !== 'none') {
        return { success: true, state };
      }
    } catch (e) {
      log('Ошибка при чтении состояния из iframe:', e);
      // даём странице ещё шанс прогрузиться
    }
  }

  return { success: false, state: 'none' };
}


// ========================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ========================================================

async function autoAddFriendsViaIframe(maxCount = 500) {
  log('Старт скрипта. Максимум заявок:', maxCount);

  const processed = new Set(); // чтобы не обрабатывать повторно
  let addedCount = 0;
  let index = 0;

  let emptyScrolls = 0;
  let hardStop = false;

  while (addedCount < maxCount && !hardStop) {
    await sleep(DELAY);

    // ==== получаем список людей ====
    let people = getPeopleNodes();

    if (!people.length) {
      log('Не найден список людей в модалке!');
      break;
    }

    // если дошли до конца списка — пытаемся подгрузить ещё
    if (index >= people.length) {
      log('Дошли до конца списка, делаю ленивую загрузку…');

      const scrollBox = document.querySelector('#box_layer_wrap .fans_box');
      const beforeHeight = scrollBox?.scrollHeight || 0;

      if (scrollBox) {
        scrollBox.scrollTo({ top: scrollBox.scrollHeight, behavior: 'smooth' });
      }
      await sleep(1500);

      const afterHeight = scrollBox?.scrollHeight || 0;

      if (afterHeight <= beforeHeight) {
        emptyScrolls++;
        log(`Ленивая загрузка ничего не дала (${emptyScrolls}/${MAX_EMPTY_SCROLLS})`);
      } else {
        emptyScrolls = 0;
        log('Подгружены новые люди.');
      }

      if (emptyScrolls >= MAX_EMPTY_SCROLLS) {
        log('Больше новых людей нет. Завершение.');
        break;
      }

      // обновили список — пробуем ещё раз с тем же index
      continue;
    }

    const node = people[index];
    const href = extractHref(node);

    if (!href) {
      log('Не найден href, пропускаю…');
      index++;
      continue;
    }

    const key = personKey(href);
    if (!key) {
      index++;
      continue;
    }

    if (processed.has(key)) {
      log(`Уже обрабатывали ${key}, пропускаю.`);
      index++;
      continue;
    }

    processed.add(key);

    log(`(${index + 1}/${people.length}) Открываю профиль: ${href}`);

    // ==== Открываем iframe ====
    const iframe = ensureIframe();
    iframe.src = href;

    await sleep(IFRAME_LOAD_DELAY);
    await sleep(SMALL_DELAY); // небольшая дополнительная задержка

    let doc;
    try {
      doc = iframe.contentDocument;
    } catch (e) {
      log('Не удалось получить документ iframe, пропускаю пользователя:', key, e);
      removeIframe();
      index++;
      continue;
    }

    // Небольшая задержка перед первичной проверкой состояния
    await sleep(SMALL_DELAY);

    // Проверяем, не в друзьях ли уже / не отправлена ли уже заявка / нет ли сразу "Сообщение"
    const initialState = getFriendshipStateFromDoc(doc);
    if (initialState !== 'none') {
      log(
        `У пользователя ${key} уже состояние: ${initialState} (друзья / заявка / сообщение). Пропускаю без отправки.`
      );
      removeIframe();
      index++;
      continue;
    }

    // Ищем кнопки "Добавить в друзья" / "Отправить заявку" и "Подписаться"
    let addBtn = null;
    let subscribeBtn = null;

    try {
      const allButtons = [...doc.querySelectorAll('button, a')];

      addBtn = allButtons.find(b => {
        const t = (b.textContent || '').trim().toLowerCase();
        return ADD_REQUEST_BUTTON_TEXTS.includes(t);
      });

      subscribeBtn = allButtons.find(
        b => (b.textContent || '').trim().toLowerCase() === 'подписаться'
      );
    } catch (e) {
      log('Ошибка поиска кнопок на странице профиля:', e);
    }

    if (!addBtn && subscribeBtn) {
      log(`На странице ${key} есть только "Подписаться" → пропускаю.`);
      removeIframe();
      index++;
      continue;
    }

    if (!addBtn && !subscribeBtn) {
      log(`У пользователя ${key} нет кнопок "Добавить в друзья" / "Отправить заявку" или "Подписаться" → пропуск.`);
      removeIframe();
      index++;
      continue;
    }

    if (addBtn) {
      const btnText = (addBtn.textContent || '').trim();
      log(`Нашел у ${key} кнопку "${btnText}" → кликаю.`);

      addBtn.click();

      // небольшая задержка после клика
      await sleep(SMALL_DELAY);

      // ждём появления "Заявка отправлена" / "Сообщение" / "Друзья"
      const { success, state } = await waitForFriendshipState(iframe);

      if (!success) {
        log('Превышен лимит ожидания, попробуйте завтра');
        hardStop = true;
        removeIframe();
        break;
      }

      log(
        `Успешное состояние после заявки для ${key}: ${state} (заявка / сообщение / друзья).`
      );
      addedCount++;
      log(`Всего успешно обработанных заявок: ${addedCount}`);
    }

    // закрываем iframe после обработки пользователя
    removeIframe();

    index++;
    await sleep(SMALL_DELAY);
  }

  removeIframe();
  if (!hardStop) {
    log('Работа завершена. Успешно отправлено заявок:', addedCount);
  }
}


// ================================
// ПРИМЕР ЗАПУСКА
// ================================
// autoAddFriendsViaIframe(300);
