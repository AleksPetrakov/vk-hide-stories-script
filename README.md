# VK Stories Auto Hider

Браузерный скрипт для консоли, который автоматически скрывает истории друзей ВКонтакте  
из вашей ленты, с настраиваемыми списками исключений по имени и ID пользователя и продолжает работать,  
даже если вкладка с VK не активна (можно переключиться на другие вкладки и пользоваться браузером как обычно).

<details>
<summary><strong>Инструкция на русском</strong></summary>

## Обзор

`vk-stories-auto-hider.js` — небольшой скрипт для браузерной консоли, который:

* Автоматически открывает меню истории → нажимает «Скрыть из историй» → подтверждает действие.
* Работает в цикле (количество итераций задаётся параметром).
* Поддерживает **список исключений по имени** и **по user id** (из `href="/какой-то_id"`).
* Для авторов из списков исключений истории **не скрываются**, а аккуратно **пропускаются** (переход к следующей истории).
* После запуска скрипт продолжает работать **даже в неактивной вкладке браузера** — можно переключиться на другие вкладки и пользоваться браузером как обычно.

---

## Как пользоваться

1. Откройте сайт **vk.com** и выполните вход в свой аккаунт.
2. Откройте **первую историю**, с которой хотите начать (история должна быть по центру экрана в просмотрщике сторис).
3. Откройте **консоль разработчика**:

   * Windows / Linux: `F12` или `Ctrl+Shift+I`, вкладка **Console**.
   * macOS: `Cmd+Opt+I`, вкладка **Console**.
4. Откройте файл `vk-stories-auto-hider.js` из репозитория и скопируйте **весь скрипт**.
5. Вставьте скрипт в консоль браузера и нажмите Enter.
6. При необходимости отредактируйте массивы `EXCLUDED_NAMES` и `EXCLUDED_IDS` в начале скрипта (см. ниже).
7. Запустите скрипт, например:

   ```js
   hideVkStoriesWithExclusions(200);
   ```

   где `200` — количество циклов (примерно сколько раз скрипт попытается скрыть или пропустить истории подряд).

После запуска достаточно **оставить вкладку с VK открытой**, а сами можете переключиться в другие вкладки/приложения — скрипт будет продолжать работать в фоне, пока вкладка не будет выгружена или жёстко «усыплена» браузером.

---

## Настройка списков исключений

В начале файла `vk-stories-auto-hider.js` есть два массива:

```js
// Список имён друзей, чьи истории НЕ нужно скрывать.
// Формат: 'Имя Фамилия', регистр не важен.
const EXCLUDED_NAMES = [
  // 'Пример ИмяФамилия',
];

// Список id друзей (из href="/idилиник"), чьи истории НЕ нужно скрывать.
const EXCLUDED_IDS = [
  // 'example_id',
];
```

### Исключения по имени

* В `EXCLUDED_NAMES` добавляйте строки вида:

```js
const EXCLUDED_NAMES = [
  'Иван Иванов',
  'Some Name',
];
```

* Сравнение без учёта регистра: `ИВАН ИВАНОВ`, `Иван Иванов` и `иван иванов` считаются одинаковыми.

Имя берётся из шапки сторис — из элемента с классами вида
`StoryInfo__title StoryInfo__title--author`.

### Исключения по user id

* Посмотрите на ссылку профиля автора в шапке истории, в атрибуте `href`:

```text
/id123456
/some_nickname
```

* В массив `EXCLUDED_IDS` нужно добавлять часть после первого слэша:

```js
const EXCLUDED_IDS = [
  'id123456',
  'some_nickname',
];
```

Перед сравнением строка нормализуется (обрезаются пробелы, приводится к нижнему регистру).

---

## Пример запуска

1. Настраиваете:

```js
const EXCLUDED_NAMES = [
 'Иван Иванов',
];

const EXCLUDED_IDS = [
 'id123456',
];
```

2. Открываете любую историю VK.

3. Вставляете скрипт в консоль.

4. Запускаете:

```js
hideVkStoriesWithExclusions(100);
```

Дальше скрипт:

* скрывает истории всех авторов, которых **нет** в списках исключений;
* пропускает истории тех, кто **есть** в `EXCLUDED_NAMES` или `EXCLUDED_IDS`, переходя к следующей истории.

---

## Как это работает (упрощённо)

Для каждого шага:

1. Скрипт находит **активную историю** по селекторам:

```js
.stories_item.multi_stories.active
// или запасной вариант:
.stories_item.active
```

2. Из шапки истории получаются:

   * **имя автора** — из элемента `StoryInfo__title StoryInfo__title--author`;
   * **user id** — из `href` ссылки на профиль (`/idXXXXXX` или `/nickname`), либо из ссылки аватарки.

3. Имя и id нормализуются (обрезка пробелов, перевод в нижний регистр) и сравниваются с `EXCLUDED_NAMES` и `EXCLUDED_IDS`.

4. Если автор **в списках исключений**:

   * история **не скрывается**;
   * скрипт находит контейнер истории `.stories_item_cont` и по его прямоугольнику вычисляет точку клика:

     * X = правая граница истории + 100px (но не дальше правого края окна),
     * Y = вертикальный центр окна (`window.innerHeight / 2`);
   * по элементу в этой точке (`document.elementFromPoint(x, y)`) отправляется последовательность событий мыши: `mousedown`, `mouseup`, `click`;
   * VK воспринимает это как клик справа от истории и переходит к следующей истории.

5. Если автор **не в списках исключений**:

   * скрипт находит кнопку меню истории (три точки) по `data-testid="story_header_menu_button"` (по всему документу);
   * имитируются события `mousedown`, `mouseup`, `click` по этой кнопке;
   * в открывшемся меню выбирается пункт с `data-testid="story_header_menu_action_add_blacklist"` — действие «Скрыть из историй»;
   * в модальном окне находится основная кнопка с текстом `Скрыть из историй`, и по ней также отправляются `mousedown`, `mouseup`, `click`;
   * история скрывается из вашей ленты историй.

6. Между шагами используются небольшие задержки (`sleep`), чтобы интерфейс VK успевал открыть меню, модалку и обновить состояние.

7. В консоль логируется текущий автор, его id, факт скрытия истории или попытки перехода к следующей.

---

## Работа в неактивной вкладке

После запуска:

```js
hideVkStoriesWithExclusions(200);
```

* скрипт продолжает выполняться, **даже если вкладка не активна**;
* вы можете переключиться на другие вкладки или приложения и вернуться позже;
* большинство браузеров выполняют JavaScript в фоновых вкладках, хотя могут замедлять или «усыплять» их при жёсткой экономии ресурсов.

Если браузер сильно агрессивно экономит батарею/память и выгружает вкладку, выполнение скрипта может быть приостановлено до возвращения к этой вкладке.

---

## Ограничения

* Вёрстка и атрибуты на стороне VK могут со временем измениться:

  * если скрипт перестанет находить кнопку меню, пункт «Скрыть из историй» или кнопку подтверждения, проверьте классы и `data-testid` в инспекторе и обновите селекторы.
* Скрипт не отправляет собственных сетевых запросов, а только имитирует ваши клики в уже открытом интерфейсе.
* Используйте скрипт ответственно и в рамках пользовательского соглашения VK.

---

## Быстрый чек-лист

1. Открыть историю VK.

2. Открыть консоль браузера.

3. Вставить содержимое `vk-stories-auto-hider.js`.

4. Настроить `EXCLUDED_NAMES` и `EXCLUDED_IDS`.

5. Запустить:

```js
hideVkStoriesWithExclusions(100);
```

6. Переключиться на другие вкладки — скрипт продолжит работать в фоне.

</details>

---

Browser console script that automatically hides VK friends’ stories from your feed,  
with configurable exclude lists by author name and user ID, and keeps running even when the VK tab is inactive  
(you can switch to other tabs and continue using your browser as usual).


<details>
<summary><strong>English instructions</strong></summary>

## Overview

`vk-stories-auto-hider.js` is a small browser console script that:

- Automatically opens the story menu → clicks “Hide from stories” → confirms the action.
- Runs in a loop (number of iterations is configurable).
- Supports **exclude lists by author name** and **by user ID** (from `href="/someid"`).
- For authors in the exclude lists, stories are **not hidden**, they are **skipped** by jumping to the next story.
- After you start it, the script keeps working **even if the browser tab is not active** — you can switch to other tabs and continue using your browser normally.

---

## How to use

1. Open **vk.com** and log in to your account.
2. Open the **first story** you want to process in the VK story viewer (the story should be centered on the screen).
3. Open the **developer console**:
   - Windows / Linux: `F12` or `Ctrl+Shift+I`, then go to the **Console** tab.
   - macOS: `Cmd+Opt+I`, then go to the **Console** tab.
4. Open `vk-stories-auto-hider.js` from this repository and copy **the entire script**.
5. Paste the script into the browser console and press Enter.
6. Adjust the `EXCLUDED_NAMES` and `EXCLUDED_IDS` arrays at the top of the script if needed (see below).
7. Run the script with, for example:

```js
hideVkStoriesWithExclusions(200);
```

where `200` is the number of cycles (roughly, how many times the script will attempt to hide or skip stories in a row).

You can now **leave the VK tab open and switch to other tabs**.
The script will continue to work in the background as long as the tab stays loaded and is not fully suspended by the browser.

---

## Configuring exclude lists

At the top of `vk-stories-auto-hider.js` there are two arrays:

```js
// Friends whose stories should NOT be hidden.
// Format: 'First Last', case-insensitive.
const EXCLUDED_NAMES = [
  // 'Example Name',
];

// Friends whose stories should NOT be hidden, by VK ID from href="/idOrNickname".
const EXCLUDED_IDS = [
  // 'example_id',
];
```

### Excluding by name

* Add entries like this:

```js
const EXCLUDED_NAMES = [
  'First Last',
  'Some Name',
];
```

* Comparison is case-insensitive, so `FIRST LAST`, `First Last` and `first last` are treated the same.

The name is taken from the story header, from an element with classes like
`StoryInfo__title StoryInfo__title--author`.

### Excluding by user ID

* Open the author’s profile link in the story header and look at the `href` attribute:

```text
/id123456
/some_nickname
```

* Use the part after `/` as an entry in `EXCLUDED_IDS`:

```js
const EXCLUDED_IDS = [
  'id123456',
  'some_nickname',
];
```

The script normalizes the ID (trims spaces, lowercases) before comparison.

---

## Example run

1. Configure:

 ```js
 const EXCLUDED_NAMES = [
   'First Last',
 ];

 const EXCLUDED_IDS = [
   'id123456',
 ];
 ```

2. Open any VK story.

3. Paste the script into the console.

4. Start it:

 ```js
 hideVkStoriesWithExclusions(100);
 ```

What happens next:

* Stories of authors **not** in the exclude lists are automatically hidden.
* Stories of authors **in** the exclude lists are **not** hidden; instead, the script simulates a click on the area to the right of the story to move to the next one.

---

## How it works (simplified)

For each step (cycle):

1. The script finds the **active story** using selectors like:

 ```js
 .stories_item.multi_stories.active
 // or fallback:
 .stories_item.active
 ```

2. It reads the current author:

   * The **name** from `StoryInfo__title StoryInfo__title--author`.
   * The **user ID** from `href` of the profile/author link (`/idXXXX` or `/nickname`), or from the avatar link.

3. It normalizes name and ID (trim, lowercase) and checks them against `EXCLUDED_NAMES` and `EXCLUDED_IDS`.

4. If the author is in the exclude lists:

   * The story is **not hidden**.
   * The script finds the story container `.stories_item_cont`, calculates its bounding box, and then:

     * X = right edge of the story + 100px (clamped to the window width).
     * Y = vertical center of the window.
     * It calls `document.elementFromPoint(x, y)` and dispatches a sequence of mouse events: `mousedown`, `mouseup`, `click`.
   * VK interprets this as a click to the right of the story and moves to the next story.

5. If the author is **not** in the exclude lists:

   * The script finds the story menu button using `data-testid="story_header_menu_button"` (globally).
   * It simulates `mousedown`, `mouseup`, `click` on that button.
   * In the opened menu it selects the item with `data-testid="story_header_menu_action_add_blacklist"` (the “Hide from stories” action).
   * In the confirmation modal it searches for the primary button with text `Скрыть из историй` and clicks it (again via `mousedown`, `mouseup`, `click`).
   * The story is hidden from your stories feed.

6. Between steps, the script waits short delays (`sleep`) to give VK time to open menus and update the UI.

7. The script logs what it’s doing into the console: current author, ID, whether the story was hidden or skipped, etc.

---

## Running in a background / inactive tab

After you start:

```js
hideVkStoriesWithExclusions(200);
```

* The script keeps running **even if the tab is not active**.
* You can switch to other tabs or apps and return later to see the result.
* Most modern browsers keep JavaScript running in an inactive tab, though they can slow it down or suspend it if the tab stays idle for a long time or if there are aggressive power-saving settings.

---

## Notes and limitations

* VK’s HTML structure (`data-testid`, class names, etc.) may change in the future.

  * If the script stops finding elements (menu button, menu item, confirmation button), inspect the page and update the selectors in the script.
* The script does not send any network requests itself; it only simulates your own clicks in the interface.
* Use it responsibly and in accordance with VK’s terms of service.

</details>
