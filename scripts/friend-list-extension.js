// ============================
// НАСТРОЙКИ
// ============================

// Сколько максимум заявок отправить за один запуск
const MAX_FRIEND_REQUESTS_DEFAULT = 200;

// Пауза между кликами по "Добавить" (мс)
const CLICK_DELAY_MS = 800;

// Пауза после прокрутки для ленивой загрузки (мс)
const SCROLL_DELAY_MS = 1200;

// Сколько раз подряд можно прокрутить страницу,
// не получив нового контента, прежде чем перезагрузить её
const MAX_EMPTY_SCROLLS_BEFORE_RELOAD = 3;

// ============================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emulateClick(target, eventInit = { bubbles: true, cancelable: true, view: window }) {
  ['mousedown', 'mouseup', 'click'].forEach((type) => {
    const ev = new MouseEvent(type, {
      ...eventInit,
      clientX: eventInit.clientX ?? 0,
      clientY: eventInit.clientY ?? 0,
    });
    target.dispatchEvent(ev);
  });
}

// Находим все кнопки "Добавить" в блоках с людьми
function getAddButtons() {
  const containers = document.querySelectorAll('[data-testid="stacked_list_catalog_users"]');
  const buttons = [];

  containers.forEach((cont) => {
    cont.querySelectorAll('button').forEach((btn) => {
      const text = (btn.textContent || '').trim().toLowerCase();
      const visible =
        btn.offsetParent !== null &&
        !btn.disabled &&
        getComputedStyle(btn).visibility !== 'hidden' &&
        getComputedStyle(btn).display !== 'none';

      if (visible && text === 'добавить') {
        buttons.push(btn);
      }
    });
  });

  return buttons;
}

// Пытаемся достать имя пользователя по карточке
function getUserNameFromButton(btn) {
  try {
    const gridItem = btn.closest('[data-testid="grid-item"]') || btn.closest('[data-testid="user_card"]');
    if (!gridItem) return null;

    const linkWithLabel = gridItem.querySelector('a[aria-label]');
    if (linkWithLabel && linkWithLabel.getAttribute('aria-label')) {
      return linkWithLabel.getAttribute('aria-label').trim();
    }

    const titleText = gridItem.querySelector('[data-testid="catalog_user_subtitle"], .vkuiText__host');
    if (titleText && titleText.textContent) {
      return titleText.textContent.trim();
    }

    return null;
  } catch {
    return null;
  }
}

// ============================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================

async function autoAddVkFriends(maxFriendRequests = MAX_FRIEND_REQUESTS_DEFAULT) {
  console.log('=== Авто-добавление друзей VK запущено ===');
  console.log('Максимум заявок за запуск:', maxFriendRequests);

  let sentRequests = 0;
  let lastScrollHeight = document.body.scrollHeight;
  let emptyScrolls = 0;

  while (sentRequests < maxFriendRequests) {
    console.log(`\nИтерация цикла. Уже отправлено заявок: ${sentRequests}`);

    let addButtons = getAddButtons();

    if (!addButtons.length) {
      console.log('Кнопок "Добавить" не найдено, прокручиваю страницу вниз для ленивой загрузки…');

      window.scrollBy(0, window.innerHeight);
      await sleep(SCROLL_DELAY_MS);

      const newHeight = document.body.scrollHeight;

      if (newHeight <= lastScrollHeight) {
        emptyScrolls += 1;
        console.warn(
          `После прокрутки новый контент не появился. Пустые прокрутки подряд: ${emptyScrolls}`
        );
      } else {
        emptyScrolls = 0;
        lastScrollHeight = newHeight;
        console.log('Появился новый контент, продолжаю работу.');
      }

      if (emptyScrolls >= MAX_EMPTY_SCROLLS_BEFORE_RELOAD) {
        console.warn(
          `Список больше не растёт (${emptyScrolls} пустых прокруток подряд). Перезагружаю страницу.`
        );
        // ВАЖНО: после перезагрузки нужно снова запустить скрипт вручную.
        location.reload();
        return;
      }

      continue;
    }

    emptyScrolls = 0;

    // Перебираем найденные кнопки "Добавить"
    for (const btn of addButtons) {
      if (sentRequests >= maxFriendRequests) break;

      const text = (btn.textContent || '').trim().toLowerCase();
      if (text !== 'добавить') {
        continue; // уже кликнули / изменилось состояние
      }

      const name = getUserNameFromButton(btn) || '(имя не найдено)';

      console.log(`Отправляю заявку в друзья: ${name}`);
      emulateClick(btn);
      sentRequests += 1;

      await sleep(CLICK_DELAY_MS);
    }
  }

  console.log('\n=== Скрипт завершил работу ===');
  console.log('Всего отправлено заявок в друзья за запуск:', sentRequests);
}

// Пример запуска в консоли:
autoAddVkFriends(200);
