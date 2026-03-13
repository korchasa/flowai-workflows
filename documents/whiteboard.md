# Zero-Touch Pipeline — автономная работа без ручного труда

Задача: https://github.com/korchasa/auto-flow/issues/53

## Цель

Конвейер работает непрерывно без участия человека. Transient failures → auto-resume. Pipeline failures → классификация, маркировка issue, переход к следующей задаче. Issues **не закрываются** — остаются открытыми для ручной обработки или повторной попытки. Бизнес-ценность: ночные запуски без присмотра, непрерывный поток решённых задач.

## Обзор

### Контекст

Текущий процесс:
1. Узел падает → `state.json` обновляется, конвейер останавливается.
2. Meta-agent пишет анализ в `meta.md` (только рекомендации).
3. Человек читает, исправляет, запускает `--resume`.

Проблемы:
- Нет auto-resume для transient failures.
- Нет классификации сбоев и маркировки issues.
- Конвейер останавливается на первом сбое, не переходит к следующей задаче.
- PM и self_runner не знают какие issues пропускать.

Связанные файлы:
- `engine/engine.ts` — основной исполнитель, post-pipeline, откат.
- `engine/state.ts` — RunState/NodeState persistence, `loadState()`.
- `engine/agent.ts` — Claude CLI invocation, continuation loop, retry.
- `engine/cli.ts` — CLI args, exit codes (0=success, 1=failure, 2=crash).
- `.sdlc/pipeline.yaml` — конфигурация конвейера. Узел `review` ссылается на `agents/tech-lead-review/SKILL.md` — **директория не существует**, нужно создать.
- `agents/tech-lead-reviewer/SKILL.md` — **другой** агент: ревью плана архитектора (output: `03-revised-plan.md`). Не путать с post-pipeline `review` node.
- `agents/meta-agent/SKILL.md` — анализ сбоев (run_on: always).
- `agents/pm/SKILL.md` — выбор issues.
- `scripts/self_runner.ts` — **уже существующий** внешний цикл: check issues → run pipeline → repeat. Фильтрует `in-progress` label, но не `auto-flow:*`.
- `scripts/self_runner_test.ts` — тесты для self_runner (только `nextPause`).

### Текущее состояние

Два уровня execution loop:
1. **Внешний** (`scripts/self_runner.ts`, task `loop`): бесконечный цикл — проверяет open issues через `gh`, запускает `deno task run`, повторяет. Backoff 30s→4h когда нет issues.
2. **Внутренний** (engine): один запуск pipeline. При failure → rollback, `failed-node.txt`, post-pipeline agents, exit 1.

Существующие механизмы устойчивости:
- `max_retries: 3` с exponential backoff для transient Claude CLI errors (`engine/agent.ts`).
- `max_continuations: 3` — retry внутри узла при validation failure.
- `--resume <run-id>` — пропуск completed-узлов, перезапуск failed/running.
- `run_on: "failure"` — опция конфигурации, существует в engine, не используется.
- `rollbackUncommitted()` — откат грязного состояния перед post-pipeline.
- `failed-node.txt` — ID упавшего узла для meta-agent.
- Meta-agent (`run_on: always`) — правит промпты агентов, пишет changelog.
- Review node (`run_on: always`) — **объявлен** в pipeline.yaml, но `agents/tech-lead-review/SKILL.md` не существует. Нужно создать с нуля.

Exit codes движка (`engine/cli.ts`):
- 0 = success (`state.status === "completed"`)
- 1 = pipeline failure (`state.status !== "completed"`)
- 2 = uncaught error (crash, parse error)

Жизненный цикл движка:
```
config → DAG → levels → on fail: rollback + failed-node.txt →
  post-pipeline (run_on filter) → markRunCompleted/Failed → exit(0|1)
  uncaught exception → exit(2)
```

### Ключевое решение: Skip & Continue вместо Self-Healing

Старый подход (recovery agent): пытается починить сбой правкой промптов → низкая вероятность успеха (промпт ≠ причина), дорого (opus), мутация state.json вне engine.

Новый подход: **классификация + маркировка + переход к следующей задаче**.
- Transient failures (exit code 2) → wrapper делает `--resume`.
- Pipeline failures (exit code 1) → post-pipeline agents уже отработали: tech-lead-review классифицировал, поставил label. Wrapper просто выходит.
- Следующий цикл self_runner → PM пропускает маркированные issues, берёт следующую.
- Meta-agent продолжает улучшать промпты (`run_on: always`) — косвенно повышает success rate.

### Система меток (labels)

Три метки на GitHub issues для классификации pipeline failures:

- `auto-flow:decompose` — задача слишком большая/сложная. Tech-lead-review создаёт 2-3 под-issues, комментирует оригинальную issue ссылками. Issue **не закрывается**. PM при следующем запуске подхватывает под-issues.
- `auto-flow:needs-human` — требуется человеческий ввод. Неясное ТЗ, внешние зависимости, выход за рамки автоматизации. Issue **не закрывается**, ждёт человека.
- `auto-flow:retry` — плохой план или дизайн. Meta-agent поправил промпты, можно попробовать снова. PM **подхватывает** issues с этой меткой (снимает метку перед запуском). **Лимит:** максимум 2 retry (PM считает по количеству `auto-flow:retry` label events в timeline или по комментариям; после 2-го retry → PM ставит `auto-flow:needs-human`).

Правила для PM при выборе issue:
- Пропускать issues с `auto-flow:decompose` и `auto-flow:needs-human`.
- Подхватывать issues с `auto-flow:retry` (снять метку → запустить). Макс 2 retry на issue.
- Приоритет: issues без `auto-flow:*` меток > issues с `auto-flow:retry`.

### Ограничения

- Без изменений в ядре движка (engine остаётся domain-agnostic).
- Wrapper не мутирует `state.json` — только читает.
- Issues НЕ закрываются при failure — остаются открытыми.
- Labels создаются через `gh label create --force` если не существуют.
- `deno task check` должен проходить после изменений.

## Критерии готовности (Definition of Done)

- [ ] `scripts/run-with-retry.ts` — wrapper для transient failure recovery (resume loop). Зависимость: `runEngine` инжектируется для тестируемости.
- [ ] `deno task run-auto` в `deno.json` как точка входа (wrapper).
- [ ] Тесты для wrapper (`scripts/run-with-retry_test.ts`), TDD. Mock `runEngine` через dependency injection.
- [ ] `agents/tech-lead-review/SKILL.md` — **создать** (директория не существует). Failure path: классификация, label, комментарий, закрытие draft PR. Success path: review + merge. Issues НЕ закрываются при failure.
- [ ] `agents/tech-lead-review/SKILL.md` — decompose path: создание под-issues через `gh issue create`.
- [ ] `agents/pm/SKILL.md` — пропуск issues с `auto-flow:decompose` и `auto-flow:needs-human`, подхват `auto-flow:retry` (макс 2 retry).
- [ ] `scripts/self_runner.ts` — обновить `fetchActionableIssues()`: фильтровать `auto-flow:decompose` и `auto-flow:needs-human` (сейчас фильтрует только `in-progress`).
- [ ] Labels `auto-flow:decompose`, `auto-flow:needs-human`, `auto-flow:retry` созданы в репозитории.
- [ ] `deno task check` проходит.
- [ ] Wrapper ориентируется на exit code (0/1/2), state.json — fallback.
- [ ] Wrapper имеет `MAX_TOTAL_TIME` (3ч) помимо `MAX_RETRIES`.
- [ ] Wrapper обрабатывает corrupted state.json (JSON parse error → transient retry).
- [ ] Обновлены SRS + SDS.

## Решение

### Архитектура: два уровня loop

```
deno task loop (внешний цикл, уже существует)
  └─ scripts/self_runner.ts
       │  бесконечный цикл: check issues → run-auto → repeat
       │  backoff 30s→4h когда нет issues
       │
       └─ deno task run-auto (новый, transient retry)
            └─ scripts/run-with-retry.ts
                 │
                 ├─ TRANSIENT RETRY LOOP (max 5, timeout 3h)
                 │   для каждой попытки:
                 │     deno task run [--resume <id>]
                 │     exit code 0 → exit 0 (success)
                 │     exit code 1 → exit 1 (pipeline failure, не retry)
                 │     exit code 2 → sleep(backoff), retry с --resume
                 │
                 └─ РЕЗУЛЬТАТ
                     success → exit 0
                     failed  → exit 1 (post-pipeline agents уже отработали:
                                tech-lead-review поставил label,
                                meta-agent поправил промпты)
```

Wrapper НЕ делает: мутацию state.json, запуск recovery agent, сброс узлов.
Wrapper ТОЛЬКО: retry при exit code 2, чтение state.json как fallback диагностики.

### Observability

Wrapper логирует в stdout (JSON lines):
- `{"event":"run_start","run_id":"...","attempt":1,"timestamp":"..."}`
- `{"event":"run_end","run_id":"...","attempt":1,"exit_code":0|1|2,"timestamp":"..."}`
- `{"event":"wrapper_exit","total_attempts":2,"total_time_ms":...,"exit_code":0}`

### Компоненты

#### 1. Wrapper (`scripts/run-with-retry.ts`)

```typescript
// Псевдокод — dependency injection для тестируемости
interface EngineResult {
  exitCode: number;   // 0=success, 1=failure, 2=transient
  runId?: string;
}

type RunEngineFn = (runId?: string) => Promise<EngineResult>;

export async function runWithRetry(
  runEngine: RunEngineFn,
  options?: { maxRetries?: number; maxTotalTime?: number; retryDelay?: number }
): Promise<number> {
  const MAX_RETRIES = options?.maxRetries ?? 5;
  const MAX_TOTAL_TIME = options?.maxTotalTime ?? 3 * 60 * 60 * 1000;
  const RETRY_DELAY = options?.retryDelay ?? 10_000;

  const startTime = Date.now();
  let runId: string | undefined;

  for (let i = 0; i < MAX_RETRIES; i++) {
    if (Date.now() - startTime > MAX_TOTAL_TIME) {
      log({ event: "timeout" });
      break;
    }
    log({ event: "run_start", attempt: i + 1 });
    const result = await runEngine(runId);
    runId = result.runId ?? runId;
    log({ event: "run_end", attempt: i + 1, exit_code: result.exitCode });

    if (result.exitCode === 0) return 0;        // success
    if (result.exitCode === 1) return 1;        // pipeline failure, no retry
    // exitCode === 2: transient, retry
    await sleep(RETRY_DELAY * Math.pow(2, i));  // exponential backoff
  }
  return 1;
}

// main
if (import.meta.main) {
  const code = await runWithRetry(realRunEngine);
  Deno.exit(code);
}
```

Ключевые решения:
- **Exit code как primary signal:** 0→success, 1→pipeline fail (break), 2→transient (retry). Без парсинга state.json.
- **Exponential backoff:** 10s, 20s, 40s, 80s, 160s — единообразно с `engine/agent.ts`.
- **DI для тестов:** `runEngine` — параметр, в тестах подставляется mock.
- **State.json fallback:** если exit code недоступен (killed process), wrapper пробует прочитать state.json для определения: есть running nodes → transient.

#### 2. Создание `agents/tech-lead-review/SKILL.md` (НОВЫЙ агент)

Это **новый** агент для post-pipeline узла `review` в `pipeline.yaml`. Не путать с `agents/tech-lead-reviewer/` (ревью плана архитектора, mid-pipeline).

Два режима работы:

**Success path** (нет `failed-node.txt`):
- Review кода через `gh pr diff`.
- CI gate: проверить `deno task check`.
- Merge PR: `gh pr merge --squash`.
- Написать `08-review.md`.

**Failure path** (`failed-node.txt` существует):

Шаг 1 — Классификация. Читает `failed-node.txt`, `state.json`, логи узла, issue body.

Критерии:
- **decompose**: failed node = `build` (executor) И continuations ≥ 3 (исчерпаны). Источник: `state.json` → `nodes.<build-node>.continuations`.
- **needs-human**: issue body содержит ссылки на внешние системы, упоминает credentials/secrets, или failed node = `specification` (PM не смог понять задачу).
- **retry**: всё остальное (test failure, lint error, timeout, design error).

Шаг 2 — Действия:

**decompose:**
- Анализирует scope задачи и точку сбоя.
- Создаёт 2-3 под-issues: `gh issue create --title "..." --body "Parent: #N. ..." --label "auto-flow"`.
- Комментирует оригинальную issue: `gh issue comment <N> --body "Decomposed into #X, #Y, #Z"`.
- Ставит label: `gh issue edit <N> --add-label "auto-flow:decompose"`.
- Закрывает draft PR: `gh pr close <N>`.
- Issue НЕ закрывается.

**needs-human:**
- Комментирует issue: что пошло не так, что нужно от человека.
- `gh issue edit <N> --add-label "auto-flow:needs-human"`.
- Закрывает draft PR.

**retry:**
- Комментирует issue: краткое описание сбоя.
- `gh issue edit <N> --add-label "auto-flow:retry"`.
- Закрывает draft PR.

#### 3. Изменения в `agents/pm/SKILL.md`

Добавить фильтрацию issues по labels при выборе:

```bash
# Получить все open issues с labels
gh issue list --state open --json number,title,labels --limit 100

# Фильтрация (jq):
# 1. Исключить auto-flow:decompose и auto-flow:needs-human
# 2. Issues без auto-flow:* меток → приоритет 1
# 3. Issues с auto-flow:retry → приоритет 2 (снять метку перед запуском)
# 4. При подхвате auto-flow:retry → проверить кол-во retry (макс 2)

gh issue edit <N> --remove-label "auto-flow:retry"
```

#### 4. Изменения в `scripts/self_runner.ts`

Обновить `fetchActionableIssues()` — добавить фильтрацию `auto-flow:decompose` и `auto-flow:needs-human` к существующему фильтру `in-progress`:

```typescript
// Текущая фильтрация (строка 44):
return raw.filter((i) => !i.labels.some((l) => l.name === "in-progress"))

// Новая фильтрация:
const SKIP_LABELS = ["in-progress", "auto-flow:decompose", "auto-flow:needs-human"];
return raw.filter((i) => !i.labels.some((l) => SKIP_LABELS.includes(l.name)))
```

`auto-flow:retry` НЕ фильтруется в self_runner — эти issues должны быть видны, чтобы PM мог их подхватить.

#### 5. Точка входа

`deno.json` — новый task:
```json
"run-auto": "deno run -A --no-check scripts/run-with-retry.ts"
```

`deno task loop` (`self_runner.ts`) меняет вызов `deno task run` → `deno task run-auto` для получения transient retry.

### Поток выполнения: `build` падает → decompose

```
T0:  deno task loop
T1:  self_runner: fetchActionableIssues() → #53 (open, no blocking labels)
T2:  self_runner → deno task run-auto
T3:  wrapper → deno task run
T4:  Engine: spec ✓ → design ✓ → decision ✓ → build: FAIL (3 continuations)
T5:  Engine: rollback, failed-node.txt = "build"
T6:  Post-pipeline:
       review(always): видит failure →
         state.json: build.continuations=3 →
         классифицирует как decompose →
         создаёт под-issues #54, #55 →
         gh issue edit #53 --add-label "auto-flow:decompose" →
         gh issue comment #53 "Decomposed into #54, #55" →
         gh pr close
       optimize(always): правит промпты executor/qa
T7:  Engine: markRunFailed → exit 1
T8:  wrapper: exit code 1 → exit 1 (no retry)
T9:  self_runner: pipeline failed → sleep 30s → next cycle

Следующий цикл:
T10: self_runner: fetchActionableIssues() →
       #53 (auto-flow:decompose → skip), #54 (open), #55 (open)
T11: self_runner → deno task run-auto
T12: PM выбирает #54 → spec → design → decision → build ✓ → verify ✓
T13: review: merge ✓
```

### Поток выполнения: transient failure

```
T0:  deno task run-auto
T1:  wrapper → deno task run
T2:  Engine: spec ✓ → design ✓ → decision: Claude CLI crash (OOM)
     Engine: uncaught exception → exit 2
T3:  wrapper: exit code 2 → sleep(10s) → retry
T4:  wrapper → deno task run --resume <id>
T5:  Engine: skip spec, design (completed) → decision: resume → ✓
     → build ✓ → verify ✓ → review ✓ → optimize ✓
T6:  wrapper: exit code 0 → exit 0
```

### Шаги реализации

1. **Создать** `agents/tech-lead-review/SKILL.md` — новый post-pipeline агент (success + failure paths).

2. RED: Тесты для wrapper (`scripts/run-with-retry_test.ts`).
   - exit 0 → return 0, no retry.
   - exit 2 (transient) → resume, then exit 0.
   - exit 2 × max retries → return 1.
   - exit 1 (pipeline failure) → return 1 immediately, no retry.
   - total timeout exceeded → return 1.
   - exponential backoff timing.

3. GREEN: Реализация `scripts/run-with-retry.ts`.

4. Добавить `run-auto` task в `deno.json`.

5. Обновить `scripts/self_runner.ts`:
   - `fetchActionableIssues()`: добавить `auto-flow:decompose`, `auto-flow:needs-human` в фильтр.
   - `runPipeline()`: вызывать `deno task run-auto` вместо `deno task run`.

6. Обновить `agents/pm/SKILL.md`: label-based filtering + retry limit.

7. Создать labels в репозитории:
   ```bash
   gh label create "auto-flow:decompose" --description "Task too large, decomposed into sub-issues" --color "D93F0B" --force
   gh label create "auto-flow:needs-human" --description "Requires human input" --color "FBCA04" --force
   gh label create "auto-flow:retry" --description "Ready for retry after prompt improvements" --color "0E8A16" --force
   ```

8. Обновить SRS — FR для zero-touch pipeline, label system.

9. Обновить SDS — wrapper, label flow, agent changes.

10. CHECK: `deno task check`.
