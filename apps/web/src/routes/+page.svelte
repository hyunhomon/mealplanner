<script lang="ts">
  import { onMount } from "svelte";
  import { BarChart3, Camera, ChefHat, ChevronRight, Home, LogOut, Menu, Plus, RefreshCw, Search, Sprout, X } from "lucide-svelte";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardHeader } from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Progress } from "$lib/components/ui/progress";
  import { Sheet, SheetContent, SheetOverlay } from "$lib/components/ui/sheet";

  type PageId = "greeney" | "fridge" | "recipes" | "reports";
  type GreeneyMood = "happy" | "normal" | "sad" | "dead";

  interface ActivityLogItem {
    id: string;
    title: string;
    message: string;
    delta: number;
    createdAt: string;
  }

  interface GreeneyState {
    happiness: number;
    lastUpdatedAt: string;
    activityLog: ActivityLogItem[];
    isDead: boolean;
  }

  interface MockMealResult {
    title: string;
    mealName: string;
    comment: string;
    reaction: string;
    delta: number;
  }

  const STORAGE_KEY = "greeney-state-v1";
  const DAILY_DECAY = 15;
  const DECAY_PER_MS = DAILY_DECAY / (24 * 60 * 60 * 1000);
  const initialHappiness = 50;
  const isLoggedIn = true;

  const pages: { id: PageId; label: string; description: string; icon: typeof Home }[] = [
    { id: "greeney", label: "그리니", description: "오늘의 그리니 상태를 확인해요", icon: Sprout },
    { id: "fridge", label: "냉장고", description: "유통기한이 가까운 재료를 확인해요.", icon: Home },
    { id: "recipes", label: "레시피", description: "지금 가진 재료로 만들 메뉴를 찾아요.", icon: ChefHat },
    { id: "reports", label: "리포트", description: "이번 주 절약과 친환경 식사를 살펴봐요.", icon: BarChart3 },
  ];

  const calendar = [
    { day: "월", date: "25", count: 2, active: false },
    { day: "화", date: "26", count: 4, active: true },
    { day: "수", date: "27", count: 3, active: false },
    { day: "목", date: "28", count: 1, active: false },
    { day: "금", date: "29", count: 5, active: false },
    { day: "토", date: "30", count: 2, active: false },
    { day: "일", date: "31", count: 0, active: false },
  ];

  const urgent = [
    { name: "두부", due: "오늘", amount: "1모", value: 92 },
    { name: "시금치", due: "내일", amount: "240g", value: 78 },
    { name: "닭가슴살", due: "2일", amount: "350g", value: 64 },
  ];

  const ingredients = [
    { name: "방울토마토", meta: "냉장 · 6일 남음", tag: "샐러드" },
    { name: "계란", meta: "냉장 · 9일 남음", tag: "아침" },
    { name: "양파", meta: "상온 · 12일 남음", tag: "기본" },
    { name: "그릭요거트", meta: "냉장 · 5일 남음", tag: "간식" },
    { name: "새송이버섯", meta: "냉장 · 3일 남음", tag: "볶음" },
  ];

  const recipes = [
    { title: "두부 채소 덮밥", detail: "18분 · 보유 재료 86%", saving: "+24 그리니" },
    { title: "버섯 오믈렛", detail: "12분 · 보유 재료 100%", saving: "+16 그리니" },
    { title: "남은 채소 수프", detail: "24분 · 보유 재료 72%", saving: "+16 그리니" },
  ];

  const stats = [
    { label: "이번 달 식비", value: "284,500원" },
    { label: "살린 식재료", value: "31개" },
    { label: "외식 대체", value: "9회" },
  ];

  const mockMealResults: MockMealResult[] = [
    {
      title: "레시피 그대로 만든 초록 식사",
      mealName: "두부 채소 덮밥",
      comment: "추천 레시피에 따라 만든 균형 잡힌 식사예요. 재료 낭비가 적어서 그리니가 가볍게 회복했어요.",
      reaction: "오늘은 몸과 공기가 조금 더 가벼워진 기분이야.",
      delta: 24,
    },
    {
      title: "채소와 곡물 중심 식사",
      mealName: "버섯 오믈렛",
      comment: "채소와 곡물이 중심이라 환경 부담이 낮아요. 하루 감소량을 충분히 메울 수 있어요.",
      reaction: "초록 에너지가 차오르고 있어.",
      delta: 16,
    },
    {
      title: "괜찮지만 조금 아쉬운 식사",
      mealName: "집밥 한 접시",
      comment: "무난한 식사예요. 큰 보너스는 아니지만 그리니가 조금 안정됐어요.",
      reaction: "나쁘지 않아. 내일은 더 산뜻하게 먹어보자.",
      delta: 8,
    },
    {
      title: "고탄소 식사",
      mealName: "고기 중심 메뉴",
      comment: "육류 비중이 높아 환경 부담이 커요. 그리니의 HP가 내려갔어요.",
      reaction: "오늘은 조금 무거운 기분이야.",
      delta: -10,
    },
    {
      title: "포장과 가공이 많은 식사",
      mealName: "포장 간편식",
      comment: "포장 쓰레기와 가공도가 높아 그리니에게 부담스러운 식사예요.",
      reaction: "초록 기운이 많이 줄었어.",
      delta: -16,
    },
  ];

  const clamp = (value: number) => Math.min(100, Math.max(0, value));

  const createLogItem = (result: MockMealResult): ActivityLogItem => ({
    id: crypto.randomUUID(),
    title: result.mealName,
    message: result.comment,
    delta: result.delta,
    createdAt: new Date().toISOString(),
  });

  const getMood = (value: number): GreeneyMood => {
    if (value <= 0) return "dead";
    if (value >= 80) return "happy";
    if (value <= 30) return "sad";
    return "normal";
  };

  const defaultState = (): GreeneyState => ({
    happiness: initialHappiness,
    lastUpdatedAt: new Date().toISOString(),
    activityLog: [
      {
        id: crypto.randomUUID(),
        title: "그리니가 깨어났어요",
        message: "하루에 좋은 식사 사진 한 장이면 HP를 지킬 수 있어요.",
        delta: 0,
        createdAt: new Date().toISOString(),
      },
    ],
    isDead: false,
  });

  const applyDecay = (currentState: GreeneyState): GreeneyState => {
    const now = Date.now();
    const lastUpdatedAt = new Date(currentState.lastUpdatedAt).getTime();
    const elapsed = Number.isFinite(lastUpdatedAt) ? Math.max(0, now - lastUpdatedAt) : 0;
    const decayedHappiness = clamp(currentState.happiness - elapsed * DECAY_PER_MS);

    return {
      ...currentState,
      happiness: decayedHappiness,
      lastUpdatedAt: new Date(now).toISOString(),
      isDead: decayedHappiness <= 0,
    };
  };

  const readState = (): GreeneyState => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();

    try {
      const parsed = JSON.parse(raw) as Partial<GreeneyState>;
      return applyDecay({
        happiness: typeof parsed.happiness === "number" ? clamp(parsed.happiness) : initialHappiness,
        lastUpdatedAt: parsed.lastUpdatedAt ?? new Date().toISOString(),
        activityLog: Array.isArray(parsed.activityLog) ? parsed.activityLog.slice(0, 5) : [],
        isDead: Boolean(parsed.isDead),
      });
    } catch {
      return defaultState();
    }
  };

  let activePage: PageId = "greeney";
  let menuOpen = false;
  let state: GreeneyState = defaultState();
  let selectedResult: MockMealResult | null = null;
  let selectedFileName = "";
  let mounted = false;

  $: currentPage = pages.find((page) => page.id === activePage) ?? pages[0];
  $: roundedHappiness = Math.round(state.happiness);
  $: mood = getMood(state.happiness);
  $: stateLabel = mood === "happy" ? "행복" : mood === "normal" ? "보통" : mood === "sad" ? "우울" : "멈춤";
  $: moodTitle =
    mood === "happy"
      ? "그리니는 행복해요"
      : mood === "normal"
        ? "그리니는 괜찮아요"
        : mood === "sad"
          ? "그리니는 우울해요"
          : "그리니가 멈췄어요";

  const persist = () => {
    if (!mounted) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  };

  const updateState = (next: GreeneyState) => {
    state = {
      ...next,
      happiness: clamp(next.happiness),
      isDead: next.happiness <= 0,
      lastUpdatedAt: new Date().toISOString(),
    };
    persist();
  };

  const pickMockResult = (fileName: string) => {
    const seed = [...fileName].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return mockMealResults[seed % mockMealResults.length];
  };

  const handleMealUpload = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || state.isDead) return;

    const result = pickMockResult(file.name);
    selectedResult = result;
    selectedFileName = file.name;

    updateState({
      ...state,
      happiness: clamp(state.happiness + result.delta),
      activityLog: [createLogItem(result), ...state.activityLog].slice(0, 5),
    });

    input.value = "";
  };

  const restartGreeney = () => {
    selectedResult = null;
    selectedFileName = "";
    state = defaultState();
    persist();
  };

  const movePage = (page: PageId) => {
    activePage = page;
    menuOpen = false;
  };

  onMount(() => {
    mounted = true;
    state = readState();
    persist();

    const interval = window.setInterval(() => {
      if (state.isDead) return;
      updateState(applyDecay(state));
    }, 60_000);

    return () => window.clearInterval(interval);
  });
</script>

<svelte:head>
  <title>greeney | Mealplanner</title>
  <meta name="description" content="식사 사진으로 그리니의 HP를 돌보고 친환경 식사를 이어주는 Mealplanner" />
</svelte:head>

<main class="flex min-h-screen justify-center bg-[#ece9df] text-[#1d211c]">
  <div class="relative min-h-screen w-full max-w-[480px] overflow-hidden bg-[#f7f6f1] shadow-[0_0_60px_rgba(29,33,28,0.12)]">
    <div class="flex min-h-screen flex-col gap-5 px-4 py-6 pb-24">
      <section class="grid gap-4">
        <div class="flex items-end justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-semibold leading-5 text-[#5d7564]">{activePage === "greeney" ? "오늘의 그리니 상태" : currentPage.label}</p>
            <h1 class="mt-1 truncate text-2xl font-semibold tracking-normal">{activePage === "greeney" ? moodTitle : currentPage.description}</h1>
          </div>
        </div>

        {#if activePage === "greeney"}
          <div class="grid gap-3">
            <Card class="overflow-hidden rounded-[2rem] border-[#cfc8bd] bg-[#e3ded0] p-4 shadow-[0_24px_80px_rgba(37,35,28,0.16)]">
              <CardContent class="grid gap-5 p-0">
                <div class="grid gap-2">
                  <div class="flex items-center justify-between px-1 text-[#68635b]">
                    <span class="text-xs font-semibold tracking-[0.2em]">GREENEY POCKET</span>
                    <span class="h-1.5 w-16 rounded-full bg-[#bcb5aa]"></span>
                  </div>
                  <div class="relative overflow-hidden rounded-[1.4rem] bg-[#22251f] p-3 shadow-[inset_0_0_0_2px_rgba(0,0,0,0.18)]">
                    <div class="relative grid min-h-[18rem] place-items-center overflow-hidden rounded-[1rem] bg-[#dfeccc] p-5 shadow-[inset_0_0_34px_rgba(46,67,47,0.18)]">
                      <div class="absolute left-4 top-4 z-10 rounded-full bg-[#1d211c]/85 px-3 py-1 text-xs font-semibold text-[#d8f4a7]">ECO MODE</div>
                      <div class="absolute right-4 top-4 z-10 min-w-28 rounded-xl bg-[#1d211c]/88 px-3 py-2 text-white shadow-sm">
                        <div class="flex items-center justify-between gap-3 text-xs font-semibold">
                          <span class="text-[#d8f4a7]">HP</span>
                          <span>{roundedHappiness}</span>
                        </div>
                        <Progress class="mt-2 h-2 bg-white/15 [&>div]:bg-[#70d77d]" value={roundedHappiness} />
                      </div>
                      <div class="absolute inset-x-8 top-10 h-16 rounded-full bg-white/45 blur-2xl"></div>
                      <div class={`greeney greeney-${mood}`} aria-label={`greeney ${stateLabel} 상태`}>
                        <div class="greeney-stem"></div>
                        <div class="greeney-body">
                          <div class="greeney-eye left"></div>
                          <div class="greeney-eye right"></div>
                          <div class="greeney-mouth"></div>
                        </div>
                        <div class="greeney-arm left"></div>
                        <div class="greeney-arm right"></div>
                        <div class="greeney-leg left"></div>
                        <div class="greeney-leg right"></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-[4.75rem_minmax(0,1fr)_5.5rem] items-center gap-4 px-2 pb-2">
                  <div class="relative size-18">
                    <span class="absolute left-1/2 top-0 h-18 w-6 -translate-x-1/2 rounded-md bg-[#4d5149] shadow-sm"></span>
                    <span class="absolute left-0 top-1/2 h-6 w-18 -translate-y-1/2 rounded-md bg-[#4d5149] shadow-sm"></span>
                    <span class="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded bg-[#343832]"></span>
                  </div>
                  <div class="grid justify-items-center gap-2">
                    <div class="h-2 w-20 rounded-full bg-[#b8b1a4]"></div>
                    <div class="h-2 w-12 rounded-full bg-[#b8b1a4]"></div>
                    <div class="grid grid-cols-6 gap-1 pt-2">
                      {#each Array(18) as _}
                        <span class="size-1.5 rounded-full bg-[#aaa398]"></span>
                      {/each}
                    </div>
                  </div>
                  <div class="grid rotate-[-18deg] grid-cols-2 gap-2.5">
                    <span class="size-10 rounded-full bg-[#b95d72] shadow-[inset_0_-4px_0_rgba(0,0,0,0.15)]"></span>
                    <span class="size-10 rounded-full bg-[#b95d72] shadow-[inset_0_-4px_0_rgba(0,0,0,0.15)]"></span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <p class="px-2 text-xs font-medium leading-5 text-[#9aa099]">
              환경에 이로운 음식을 촬영하면 그리니가 회복해요. 환경에 해로운 음식을 촬영한다면 그리니가 아파해요 ㅜㅜ
            </p>

            {#if mood === "dead"}
              <Button class="h-12 rounded-full bg-[#1d211c] px-6 text-base" onclick={restartGreeney}>
                <RefreshCw size={19} />
                다시 시작하기
              </Button>
            {/if}

            {#if selectedResult}
              <Card class="rounded-[1.5rem] border-[#e6e0d6] bg-white shadow-sm">
                <CardContent class="grid gap-3 p-5">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <p class="text-sm font-semibold text-[#5d7564]">Mock 분석 완료</p>
                      <h2 class="mt-1 text-xl font-semibold">{selectedResult.title}</h2>
                    </div>
                    <Badge class={`rounded-full border-0 px-3 py-1 ${selectedResult.delta >= 0 ? "bg-[#e8f6e9] text-[#2f7c43]" : "bg-[#fff0ec] text-[#bd4a35]"}`} variant="outline">
                      {selectedResult.delta >= 0 ? "+" : ""}{selectedResult.delta}
                    </Badge>
                  </div>
                  <p class="text-sm text-[#7c837d]">{selectedFileName}</p>
                  <p class="leading-6 text-[#69716b]">{selectedResult.comment}</p>
                  <p class="rounded-xl bg-[#f5f3ed] p-4 text-sm font-medium text-[#3b4139]">greeney: {selectedResult.reaction}</p>
                </CardContent>
              </Card>
            {/if}
          </div>
        {:else if activePage === "fridge"}
          <div class="grid gap-4">
            <Card class="rounded-[1.5rem] border-[#e6e0d6] bg-white shadow-sm">
              <CardHeader class="flex-row items-center justify-between gap-3 p-5 pb-2">
                <div>
                  <p class="text-sm text-[#7c837d]">2026년 5월</p>
                  <h2 class="text-xl font-semibold">유통기한 캘린더</h2>
                </div>
                <Badge class="rounded-full" variant="secondary">14개 예정</Badge>
              </CardHeader>
              <CardContent class="p-5">
                <div class="grid grid-cols-7 gap-1.5">
                  {#each calendar as item}
                    <button type="button" class={`grid h-20 content-center gap-1 rounded-xl text-center text-sm transition ${item.active ? "bg-[#1d211c] text-white" : "bg-[#f5f3ed] hover:bg-[#ece8df]"}`}>
                      <span class="text-xs opacity-70">{item.day}</span>
                      <strong class="text-lg">{item.date}</strong>
                      <span class="text-xs opacity-70">{item.count}개</span>
                    </button>
                  {/each}
                </div>
              </CardContent>
            </Card>

            <Card class="rounded-[1.5rem] border-[#e6e0d6] bg-white shadow-sm">
              <CardHeader class="p-5 pb-2">
                <h2 class="text-xl font-semibold">급한 식재료</h2>
              </CardHeader>
              <CardContent class="grid gap-3 p-5">
                {#each urgent as item}
                  <div class="grid gap-2 rounded-xl bg-[#f5f3ed] p-4">
                    <div class="flex items-start justify-between gap-4">
                      <div>
                        <h3 class="font-semibold">{item.name}</h3>
                        <p class="text-sm text-[#7c837d]">{item.amount}</p>
                      </div>
                      <Badge class="rounded-full" variant={item.due === "오늘" ? "default" : "outline"}>{item.due}</Badge>
                    </div>
                    <Progress class="[&>div]:bg-[#5fb76e]" value={item.value} />
                  </div>
                {/each}
              </CardContent>
            </Card>

            <Card class="rounded-[1.5rem] border-[#e6e0d6] bg-white shadow-sm">
              <CardContent class="grid gap-4 p-5">
                <div class="relative">
                  <Search class="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#7c837d]" />
                  <Input class="h-12 rounded-full bg-[#f5f3ed] pl-10" placeholder="식재료 검색" />
                </div>
                <div class="grid gap-2">
                  {#each ingredients as item}
                    <div class="flex items-center gap-3 rounded-xl bg-[#f5f3ed] p-4">
                      <div class="size-2 rounded-full bg-[#5fb76e]"></div>
                      <div class="min-w-0 flex-1">
                        <h3 class="truncate font-semibold">{item.name}</h3>
                        <p class="truncate text-sm text-[#7c837d]">{item.meta}</p>
                      </div>
                      <Badge class="rounded-full" variant="muted">{item.tag}</Badge>
                    </div>
                  {/each}
                </div>
              </CardContent>
            </Card>
          </div>
        {:else if activePage === "recipes"}
          <Card class="rounded-[1.5rem] border-[#e6e0d6] bg-white shadow-sm">
            <CardContent class="grid gap-4 p-5">
              <div class="relative">
                <Search class="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#7c837d]" />
                <Input class="h-12 rounded-full bg-[#f5f3ed] pl-10" placeholder="레시피 검색" />
              </div>
              <div class="grid gap-2">
                {#each recipes as recipe}
                  <button type="button" class="flex min-h-16 items-center justify-between gap-4 rounded-xl bg-[#f5f3ed] px-4 text-left transition hover:bg-[#ece8df]">
                    <div class="min-w-0">
                      <h2 class="truncate font-semibold">{recipe.title}</h2>
                      <p class="mt-1 text-sm text-[#7c837d]">{recipe.detail}</p>
                    </div>
                    <Badge class="rounded-full" variant="secondary">{recipe.saving}</Badge>
                  </button>
                {/each}
              </div>
            </CardContent>
          </Card>
        {:else}
          <div class="grid gap-4">
            <Card class="rounded-[1.5rem] border-0 bg-[#1d211c] text-white shadow-sm">
              <CardContent class="p-6">
                <p class="text-sm text-white/70">이번 주 총 절약 금액</p>
                <strong class="mt-2 block text-4xl font-semibold tracking-normal">127,400원</strong>
              </CardContent>
            </Card>
            <div class="grid gap-2">
              {#each stats as stat}
                <Card class="rounded-xl border-[#e6e0d6] bg-white shadow-sm">
                  <CardContent class="flex items-center justify-between p-4">
                    <span class="text-[#69716b]">{stat.label}</span>
                    <strong>{stat.value}</strong>
                  </CardContent>
                </Card>
              {/each}
            </div>
            <Card class="rounded-[1.5rem] border-[#e6e0d6] bg-white shadow-sm">
              <CardHeader class="p-5 pb-2">
                <h2 class="text-xl font-semibold">카테고리</h2>
              </CardHeader>
              <CardContent class="grid gap-4 p-5">
                {#each [["신선식품", 42], ["단백질", 28], ["간편식", 18]] as row}
                  <div class="grid gap-1.5">
                    <div class="flex justify-between text-sm">
                      <span>{row[0]}</span>
                      <span class="text-[#7c837d]">{row[1]}%</span>
                    </div>
                    <Progress class="[&>div]:bg-[#5fb76e]" value={Number(row[1])} />
                  </div>
                {/each}
              </CardContent>
            </Card>
          </div>
        {/if}
      </section>
    </div>

    {#if activePage === "greeney" && mood !== "dead"}
      <label class="fixed bottom-6 left-[max(1rem,calc(50%-240px+1rem))] z-40 inline-flex h-14 cursor-pointer items-center gap-3 rounded-full bg-[#5fb76e] pl-4 pr-5 text-white shadow-[0_14px_40px_rgba(74,151,87,0.3)] transition hover:bg-[#4da25c]" aria-label="음식 촬영">
        <span class="grid size-8 place-items-center rounded-full bg-white/18">
          <Camera class="size-5" />
        </span>
        <span class="text-sm font-semibold">음식 촬영</span>
        <input class="sr-only" type="file" accept="image/*" onchange={handleMealUpload} />
      </label>
    {:else if activePage === "fridge"}
      <button
        type="button"
        class="fixed bottom-6 left-[max(1rem,calc(50%-240px+1rem))] z-40 inline-flex h-14 items-center gap-3 rounded-full bg-[#5fb76e] pl-4 pr-5 text-white shadow-[0_14px_40px_rgba(74,151,87,0.3)] transition hover:bg-[#4da25c]"
        aria-label="식재료 추가"
      >
        <span class="grid size-8 place-items-center rounded-full bg-white/18">
          <Plus class="size-5" />
        </span>
        <span class="text-sm font-semibold">식재료 추가</span>
      </button>
    {/if}

    <Button
      class="fixed bottom-6 right-[max(1rem,calc(50%-240px+1rem))] z-40 size-14 rounded-full bg-[#1d211c] text-white shadow-[0_14px_40px_rgba(29,33,28,0.28)] hover:bg-[#30382f]"
      size="icon"
      aria-label="메뉴 열기"
      onclick={() => (menuOpen = true)}
    >
      <Menu class="size-6" />
    </Button>

    <Sheet open={menuOpen} class="left-1/2 w-full max-w-[480px] -translate-x-1/2 overflow-hidden">
      <SheetOverlay aria-label="메뉴 닫기" onclick={() => (menuOpen = false)} />
      <SheetContent class="right-0 w-[min(360px,100%)] border-l-0 bg-[#f7f6f1] p-4 pb-24" aria-label="메뉴">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs font-medium leading-none text-[#69716b]">{isLoggedIn ? "로그인된 계정" : "로그인되지 않았어요"}</p>
            <p class="mt-0 truncate text-xl font-medium leading-6 tracking-normal text-[#1d211c]">{isLoggedIn ? "hyunhomon@gmail.com" : "익명의 사용자"}</p>
          </div>
          {#if isLoggedIn}
            <Button class="size-10 rounded-full bg-[#e2ded5] text-[#2c302b] hover:bg-[#d7d1c6]" size="icon" variant="secondary" aria-label="로그아웃">
              <LogOut class="size-4" />
            </Button>
          {:else}
            <Button class="rounded-full px-4" variant="secondary">로그인</Button>
          {/if}
        </div>

        <nav class="mt-4 grid gap-2">
          {#each pages as page}
            <button type="button" class={`flex min-h-14 items-center gap-3 rounded-xl px-4 text-left transition ${activePage === page.id ? "bg-[#1d211c] text-white" : "bg-white text-[#2c302b] hover:bg-[#ece8df]"}`} onclick={() => movePage(page.id)}>
              <svelte:component this={page.icon} size={19} />
              <span class="min-w-0">
                <span class="block font-semibold">{page.label}</span>
                <span class={`mt-0.5 block truncate text-xs ${activePage === page.id ? "text-white/65" : "text-[#7c837d]"}`}>{page.description}</span>
              </span>
              <ChevronRight class="ml-auto size-4 opacity-55" />
            </button>
          {/each}
        </nav>

        <Button
          class="absolute bottom-6 right-4 z-50 size-14 rounded-full bg-white text-[#1d211c] shadow-[0_14px_40px_rgba(29,33,28,0.22)] hover:bg-[#f2f0ea]"
          size="icon"
          aria-label="메뉴 닫기"
          onclick={() => (menuOpen = false)}
        >
          <X class="size-6" />
        </Button>
      </SheetContent>
    </Sheet>
  </div>
</main>

<style>
  .greeney {
    position: relative;
    width: min(58%, 13rem);
    height: 14.25rem;
    transition:
      transform 240ms ease,
      filter 240ms ease;
  }

  .greeney-body {
    position: absolute;
    inset: 2.6rem 1.45rem 2rem;
    background: #d8f4a7;
    clip-path: polygon(50% 0%, 100% 100%, 0% 100%);
    filter: drop-shadow(0 18px 20px rgb(84 122 74 / 18%));
  }

  .greeney-body::after {
    content: "";
    position: absolute;
    inset: 0;
    clip-path: polygon(50% 0%, 100% 100%, 0% 100%);
    border: 0.28rem solid #111;
  }

  .greeney-stem,
  .greeney-arm,
  .greeney-leg {
    position: absolute;
    border-radius: 999px;
    background: #111;
  }

  .greeney-stem {
    right: 1.8rem;
    top: 3.1rem;
    width: 3.55rem;
    height: 0.42rem;
    transform: rotate(22deg);
    transform-origin: left center;
  }

  .greeney-arm.left {
    left: 2.4rem;
    bottom: 4.55rem;
    width: 0.42rem;
    height: 2.75rem;
    transform: rotate(-16deg);
  }

  .greeney-arm.right {
    right: 2.25rem;
    bottom: 4.6rem;
    width: 0.42rem;
    height: 2.8rem;
    transform: rotate(16deg);
  }

  .greeney-leg.left,
  .greeney-leg.right {
    bottom: 0.7rem;
    width: 0.42rem;
    height: 3.15rem;
  }

  .greeney-leg.left {
    left: 4.85rem;
    transform: rotate(6deg);
  }

  .greeney-leg.right {
    right: 4.85rem;
    transform: rotate(-6deg);
  }

  .greeney-eye,
  .greeney-mouth {
    position: absolute;
    z-index: 2;
    background: #111;
  }

  .greeney-eye {
    top: 46%;
    width: 0.72rem;
    height: 0.72rem;
    border-radius: 999px;
  }

  .greeney-eye.left {
    left: 38%;
  }

  .greeney-eye.right {
    right: 38%;
  }

  .greeney-mouth {
    left: 50%;
    top: 58%;
    width: 1.9rem;
    height: 1rem;
    border: 0.22rem solid #111;
    border-top: 0;
    border-radius: 0 0 999px 999px;
    background: transparent;
    transform: translateX(-50%);
  }

  .greeney-happy {
    animation: floaty 2.6s ease-in-out infinite;
  }

  .greeney-happy .greeney-body {
    background: #c9f57d;
  }

  .greeney-happy .greeney-eye {
    height: 0.34rem;
    border-radius: 999px;
  }

  .greeney-sad {
    filter: saturate(0.74);
    transform: translateY(0.4rem) rotate(-2deg);
  }

  .greeney-sad .greeney-mouth {
    top: 62%;
    border-top: 0.22rem solid #111;
    border-bottom: 0;
    border-radius: 999px 999px 0 0;
  }

  .greeney-dead {
    filter: grayscale(1);
    opacity: 0.62;
    transform: rotate(7deg);
  }

  .greeney-dead .greeney-eye {
    width: 1rem;
    height: 0.22rem;
    border-radius: 999px;
    transform: rotate(35deg);
  }

  .greeney-dead .greeney-eye.right {
    transform: rotate(-35deg);
  }

  .greeney-dead .greeney-mouth {
    width: 1.7rem;
    height: 0.22rem;
    border: 0;
    border-radius: 999px;
    background: #111;
  }

  @keyframes floaty {
    0%,
    100% {
      transform: translateY(0);
    }

    50% {
      transform: translateY(-0.45rem);
    }
  }
</style>
