// ============================
// НАСТРОЙКИ ИСКЛЮЧЕНИЙ
// ============================

// Список имён друзей, чьи истории НЕ нужно скрывать.
// Формат: 'Имя Фамилия', регистр не важен.
// Примеры: 'Иван Иванов', 'Some Name'
const EXCLUDED_NAMES = [
  // 'Пример ИмяФамилия',
];

// Список id друзей (из href="/idилиник"), чьи истории НЕ нужно скрывать.
// Примеры: 'id123456', 'some_nickname'
const EXCLUDED_IDS = [
  // 'example_id',
];

const MAX_SAME_EXCLUDED_REPEATS = 10;

// ============================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeString(str) {
  return (str || '').normalize('NFC').trim().toLowerCase();
}

// Текущая активная история
function getActiveStoryElement() {
  return (
    document.querySelector('.stories_item.multi_stories.active') ||
    document.querySelector('.stories_item.active')
  );
}

// Имя + id автора
function getAuthorInfoFromActiveStory(activeStoryEl) {
  if (!activeStoryEl) return { name: null, id: null };

  const nameLink =
    activeStoryEl.querySelector('.StoryInfo__title.StoryInfo__title--author') ||
    activeStoryEl.querySelector('.StoryInfo__title--author');

  const rawName = nameLink ? nameLink.textContent || '' : '';
  const name = rawName.trim();

  let rawHref = null;

  if (nameLink && nameLink.getAttribute('href')) {
    rawHref = nameLink.getAttribute('href');
  } else {
    const avatarLink = activeStoryEl.querySelector(
      'a.stories_author_avatar[href]'
    );
    if (avatarLink) rawHref = avatarLink.getAttribute('href');
  }

  let id = null;
  if (rawHref) {
    const href = rawHref.trim();
    if (href.startsWith('/')) {
      const withoutSlash = href.slice(1);
      const withoutQuery = withoutSlash.split('?')[0].split('#')[0];
      const firstPart = withoutQuery.split('/')[0];
      id = firstPart || null;
    }
  }

  return { name, id };
}

// проверка на исключение
function isAuthorExcluded(authorInfo) {
  const { name, id } = authorInfo;

  const normalizedName = normalizeString(name);
  const normalizedId = normalizeString(id);

  const excludedNamesNormalized = EXCLUDED_NAMES.map(normalizeString);
  const excludedIdsNormalized = EXCLUDED_IDS.map(normalizeString);

  const byName =
    !!normalizedName &&
    excludedNamesNormalized.includes(normalizedName);

  const byId =
    !!normalizedId &&
    excludedIdsNormalized.includes(normalizedId);

  return byName || byId;
}

// Переход к следующей истории кликом по координате справа от текущей истории
function goToNextStoryByScreenClick(activeStoryEl) {
  if (!activeStoryEl) {
    console.warn('goToNextStoryByScreenClick: нет activeStoryEl');
    return false;
  }

  const cont = activeStoryEl.querySelector('.stories_item_cont');
  if (!cont) {
    console.warn(
      'goToNextStoryByScreenClick: не найден .stories_item_cont внутри активной истории'
    );
    return false;
  }

  const rect = cont.getBoundingClientRect();

  // X = правая граница истории + 100px, но не дальше правого края окна
  let x = rect.right + 100;
  const maxX = window.innerWidth - 10;
  if (x > maxX) x = maxX;
  if (x < 0) x = 0;

  // Y = центр экрана
  let y = window.innerHeight / 2;
  if (y < 0) y = 0;
  const maxY = window.innerHeight - 10;
  if (y > maxY) y = maxY;

  const target = document.elementFromPoint(x, y) || document.body;

  console.log(
    'goToNextStoryByScreenClick: кликаем по экрану в точку',
    { x, y, target }
  );

  const eventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: x,
    clientY: y,
  };

  ['mousedown', 'mouseup', 'click'].forEach((type) => {
    const ev = new MouseEvent(type, eventInit);
    target.dispatchEvent(ev);
  });

  return true;
}

// ============================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================

async function hideVkStoriesWithExclusions(cyclesCount = 200) {
  console.log(
    'Запуск скрытия историй с исключениями. Циклов:',
    cyclesCount
  );
  console.log('Исключённые имена:', EXCLUDED_NAMES);
  console.log('Исключённые id:', EXCLUDED_IDS);

  let lastExcludedKey = null;
  let sameExcludedCount = 0;

  for (let i = 0; i < cyclesCount; i++) {
    console.log(`\nЦикл ${i + 1} из ${cyclesCount}`);

    const activeStory = getActiveStoryElement();
    if (!activeStory) {
      console.warn('Активная история не найдена, выхожу');
      break;
    }

    const authorInfo = getAuthorInfoFromActiveStory(activeStory);
    const authorKey = `${normalizeString(authorInfo.name)}::${normalizeString(
      authorInfo.id
    )}`;

    console.log(
      'Текущий автор:',
      authorInfo.name || '(не найдено имя)',
      '| id:',
      authorInfo.id || '(не найден id)'
    );

    // === ветка исключения ===
    if (isAuthorExcluded(authorInfo)) {
      console.log(
        'Автор в списке исключений, пробуем перейти к следующей истории кликом по координате справа'
      );

      if (authorKey === lastExcludedKey) {
        sameExcludedCount += 1;
      } else {
        lastExcludedKey = authorKey;
        sameExcludedCount = 1;
      }

      if (sameExcludedCount > MAX_SAME_EXCLUDED_REPEATS) {
        console.warn(
          `Исключённая история повторилась ${sameExcludedCount} раз подряд, останавливаюсь`
        );
        break;
      }

      const moved = goToNextStoryByScreenClick(activeStory);
      if (!moved) {
        console.warn(
          'Не удалось перейти к следующей истории кликом по экрану, но продолжаю следующий цикл'
        );
        await sleep(800);
        continue;
      }

      await sleep(800);
      continue;
    } else {
      // сбрасываем счётчик, как только попали на обычного автора
      lastExcludedKey = null;
      sameExcludedCount = 0;
    }

    // === обычная ветка: скрываем историю ===

    // Берём кнопку меню глобально, а не из activeStory
    const menuButton = document.querySelector(
      '[data-testid="story_header_menu_button"]'
    );
    if (!menuButton) {
      console.warn(
        'Кнопка меню (три точки) не найдена, попробую ещё в следующем цикле'
      );
      await sleep(500);
      continue;
    }

    menuButton.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window,
      })
    );
    menuButton.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        view: window,
      })
    );
    menuButton.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      })
    );

    // ждём открытие меню
    await sleep(250);

    const hideFromStoriesItem = document.querySelector(
      '[data-testid="story_header_menu_action_add_blacklist"]'
    );
    if (!hideFromStoriesItem) {
      console.warn(
        'Пункт меню "Скрыть из историй" не найден, попробую ещё в следующем цикле'
      );
      await sleep(500);
      continue;
    }

    hideFromStoriesItem.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window,
      })
    );
    hideFromStoriesItem.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        view: window,
      })
    );
    hideFromStoriesItem.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      })
    );

    // ждём появление модалки
    await sleep(300);

    const buttons = Array.from(
      document.querySelectorAll(
        'button.FlatButton.FlatButton--primary.FlatButton--size-m'
      )
    );

    const confirmButton = buttons.find(
      (btn) =>
        (btn.textContent || '').trim().toLowerCase() === 'скрыть из историй'
    );

    if (!confirmButton) {
      console.warn(
        'Кнопка подтверждения "Скрыть из историй" не найдена, попробую ещё в следующем цикле'
      );
      await sleep(500);
      continue;
    }

    confirmButton.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window,
      })
    );
    confirmButton.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        view: window,
      })
    );
    confirmButton.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      })
    );

    console.log('История скрыта');

    await sleep(600);
  }

  console.log('Скрипт завершил работу');
}

// Пример запуска в консоли:
hideVkStoriesWithExclusions(20);
