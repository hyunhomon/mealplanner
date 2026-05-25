<script lang="ts">
  import { onMount } from "svelte";
  import {
    BarChart3,
    CalendarDays,
    Camera,
    ChefHat,
    ChevronLeft,
    ChevronRight,
    Clock,
    Home,
    LogOut,
    Menu,
    Minus,
    Plus,
    RefreshCw,
    Search,
    Sprout,
    Utensils,
    X,
  } from "lucide-svelte";
  import type { IngredientSummary, RecipeRecommendation } from "@mealplanner/shared";
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

  type IngredientView = IngredientSummary & {
    storage: string;
    memo: string;
  };

  type RecipeView = RecipeRecommendation;

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

  const nowIso = "2026-05-25T09:00:00.000Z";
  const userId = "user-demo";

  const ingredients: IngredientView[] = [
    {
      id: "ing-tofu",
      userId,
      itemCode: "tofu",
      expiresAt: "2026-05-25T23:59:59.000Z",
      totalQuantity: 1,
      remainingQuantity: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
      storage: "냉장",
      memo: "오늘 저녁에 먼저 쓰면 좋아요.",
      item: { itemCode: "tofu", name: "두부", category: "콩류", unit: "모", unitSize: "1모", grade: "국산", market: "로컬마트", region: "서울", price: 2800 },
    },
    {
      id: "ing-spinach",
      userId,
      itemCode: "spinach",
      expiresAt: "2026-05-26T23:59:59.000Z",
      totalQuantity: 240,
      remainingQuantity: 180,
      createdAt: nowIso,
      updatedAt: nowIso,
      storage: "냉장",
      memo: "잎이 숨죽기 전에 데쳐 보관해요.",
      item: { itemCode: "spinach", name: "시금치", category: "채소", unit: "g", unitSize: "240g", grade: "특", market: "친환경 장터", region: "경기", price: 3900 },
    },
    {
      id: "ing-chicken",
      userId,
      itemCode: "chicken-breast",
      expiresAt: "2026-05-27T23:59:59.000Z",
      totalQuantity: 350,
      remainingQuantity: 350,
      createdAt: nowIso,
      updatedAt: nowIso,
      storage: "냉장",
      memo: "소분 후 냉동하면 손실을 줄일 수 있어요.",
      item: { itemCode: "chicken-breast", name: "닭가슴살", category: "육류", unit: "g", unitSize: "350g", market: "동네정육", region: "국내산", price: 6200 },
    },
    {
      id: "ing-tomato",
      userId,
      itemCode: "cherry-tomato",
      expiresAt: "2026-05-31T23:59:59.000Z",
      totalQuantity: 500,
      remainingQuantity: 420,
      createdAt: nowIso,
      updatedAt: nowIso,
      storage: "냉장",
      memo: "샐러드나 파스타 토핑으로 쓰기 좋아요.",
      item: { itemCode: "cherry-tomato", name: "방울토마토", category: "과채", unit: "g", unitSize: "500g", market: "로컬마트", region: "충남", price: 5600 },
    },
    {
      id: "ing-egg",
      userId,
      itemCode: "egg",
      expiresAt: "2026-06-03T23:59:59.000Z",
      totalQuantity: 10,
      remainingQuantity: 7,
      createdAt: nowIso,
      updatedAt: nowIso,
      storage: "냉장",
      memo: "아침 식사용으로 남겨둔 재료예요.",
      item: { itemCode: "egg", name: "계란", category: "난류", unit: "개", unitSize: "10개", grade: "1등급", market: "친환경 장터", region: "경북", price: 4900 },
    },
    {
      id: "ing-onion",
      userId,
      itemCode: "onion",
      expiresAt: "2026-06-06T23:59:59.000Z",
      totalQuantity: 4,
      remainingQuantity: 3,
      createdAt: nowIso,
      updatedAt: nowIso,
      storage: "상온",
      memo: "통풍이 되는 곳에 보관 중이에요.",
      item: { itemCode: "onion", name: "양파", category: "채소", unit: "개", unitSize: "4개", market: "로컬마트", region: "전남", price: 3200 },
    },
    {
      id: "ing-yogurt",
      userId,
      itemCode: "greek-yogurt",
      expiresAt: "2026-05-30T23:59:59.000Z",
      totalQuantity: 450,
      remainingQuantity: 260,
      createdAt: nowIso,
      updatedAt: nowIso,
      storage: "냉장",
      memo: "과일과 같이 먹으면 빠르게 소진돼요.",
      item: { itemCode: "greek-yogurt", name: "그릭요거트", category: "유제품", unit: "g", unitSize: "450g", market: "로컬마트", price: 7800 },
    },
    {
      id: "ing-mushroom",
      userId,
      itemCode: "mushroom",
      expiresAt: "2026-05-28T23:59:59.000Z",
      totalQuantity: 300,
      remainingQuantity: 160,
      createdAt: nowIso,
      updatedAt: nowIso,
      storage: "냉장",
      memo: "수분이 생기기 전에 볶아두면 좋아요.",
      item: { itemCode: "mushroom", name: "새송이버섯", category: "버섯", unit: "g", unitSize: "300g", market: "친환경 장터", region: "강원", price: 3600 },
    },
  ];

  const recipes: RecipeView[] = [
    {
      recipe: {
        id: "recipe-tofu-rice",
        name: "두부 채소 덮밥",
        ingredientText: "두부 1모, 시금치, 양파, 방울토마토, 간장, 현미밥",
        ingredientNames: ["두부", "시금치", "양파", "방울토마토"],
        cookingMethod: "볶기",
        dishType: "밥",
        hashTag: "저탄소,냉장고파먹기",
        tip: "두부는 물기를 충분히 제거하면 식감이 좋아져요.",
        nutrition: { calories: 420, carbohydrate: 56, protein: 24, fat: 12, sodium: 680, weight: 420 },
        steps: [
          { order: 1, description: "두부의 물기를 제거하고 한입 크기로 자릅니다." },
          { order: 2, description: "양파와 시금치를 가볍게 볶다가 두부를 넣습니다." },
          { order: 3, description: "간장 소스로 간을 맞추고 밥 위에 올립니다." },
        ],
      },
      matchedIngredientIds: ["ing-tofu", "ing-spinach", "ing-onion", "ing-tomato"],
      matchedIngredientNames: ["두부", "시금치", "양파", "방울토마토"],
      missingIngredientNames: ["현미밥"],
      matchScore: 0.8,
      expiringSoonScore: 0.75,
      score: 0.86,
    },
    {
      recipe: {
        id: "recipe-mushroom-omelet",
        name: "버섯 오믈렛",
        ingredientText: "계란 2개, 새송이버섯, 양파, 우유 약간",
        ingredientNames: ["계란", "새송이버섯", "양파"],
        cookingMethod: "부치기",
        dishType: "반찬",
        hashTag: "아침,단백질",
        tip: "약불에서 천천히 익히면 촉촉하게 완성돼요.",
        nutrition: { calories: 310, carbohydrate: 12, protein: 22, fat: 18, sodium: 430, weight: 260 },
        steps: [
          { order: 1, description: "버섯과 양파를 얇게 썰어 먼저 볶습니다." },
          { order: 2, description: "계란물을 붓고 가장자리가 익을 때까지 둡니다." },
          { order: 3, description: "반으로 접어 잔열로 속까지 익힙니다." },
        ],
      },
      matchedIngredientIds: ["ing-egg", "ing-mushroom", "ing-onion"],
      matchedIngredientNames: ["계란", "새송이버섯", "양파"],
      missingIngredientNames: ["우유"],
      matchScore: 0.75,
      expiringSoonScore: 0.35,
      score: 0.78,
    },
    {
      recipe: {
        id: "recipe-vegetable-soup",
        name: "남은 채소 수프",
        ingredientText: "방울토마토, 양파, 시금치, 버섯, 채소 육수",
        ingredientNames: ["방울토마토", "양파", "시금치", "새송이버섯"],
        cookingMethod: "끓이기",
        dishType: "국/탕",
        hashTag: "남은재료,가벼운식사",
        tip: "토마토를 먼저 볶으면 국물 맛이 깊어져요.",
        nutrition: { calories: 260, carbohydrate: 34, protein: 9, fat: 8, sodium: 520, weight: 480 },
        steps: [
          { order: 1, description: "양파와 토마토를 올리브오일에 볶습니다." },
          { order: 2, description: "버섯과 육수를 넣고 10분간 끓입니다." },
          { order: 3, description: "마지막에 시금치를 넣고 숨이 죽으면 불을 끕니다." },
        ],
      },
      matchedIngredientIds: ["ing-tomato", "ing-onion", "ing-spinach", "ing-mushroom"],
      matchedIngredientNames: ["방울토마토", "양파", "시금치", "새송이버섯"],
      missingIngredientNames: ["채소 육수"],
      matchScore: 0.8,
      expiringSoonScore: 0.55,
      score: 0.82,
    },
  ];

  const stats = [
    { label: "이번 달 식비", value: "284,500원" },
    { label: "살린 식재료", value: "31개" },
    { label: "외식 대체", value: "9회" },
  ];

  const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];
  const today = new Date("2026-05-25T00:00:00");

  const toStartOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const addDays = (date: Date, days: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  };
  const formatMonth = (date: Date) => `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
  const formatDate = (date: Date) => `${date.getMonth() + 1}월 ${date.getDate()}일`;
  const formatExpireDate = (iso: string) => formatDate(new Date(iso));
  const daysUntil = (iso: string) => {
    const target = toStartOfDay(new Date(iso));
    return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  };
  const dueLabel = (iso: string) => {
    const left = daysUntil(iso);
    if (left < 0) return "만료";
    if (left === 0) return "오늘";
    if (left === 1) return "내일";
    return `${left}일`;
  };
  const ingredientName = (ingredient: IngredientView) => ingredient.item?.name ?? ingredient.itemCode;
  const ingredientUnit = (ingredient: IngredientView) => ingredient.item?.unit ?? "";
  const ingredientAmount = (ingredient: IngredientView) => `${ingredient.remainingQuantity}${ingredientUnit}`;
  const ingredientTag = (ingredient: IngredientView) => ingredient.item?.category ?? ingredient.storage;
  const ingredientMeta = (ingredient: IngredientView) => `${ingredient.storage} · ${dueLabel(ingredient.expiresAt)} 남음`;
  const sameDate = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
  const weekStartOf = (date: Date) => addDays(toStartOfDay(date), -((date.getDay() + 6) % 7));

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
  let weekOffset = 0;
  let selectedIngredient: IngredientView | null = null;
  let selectedRecipe: RecipeView | null = null;
  let state: GreeneyState = defaultState();
  let selectedResult: MockMealResult | null = null;
  let selectedFileName = "";
  let mounted = false;

  $: currentPage = pages.find((page) => page.id === activePage) ?? pages[0];
  $: weekStart = addDays(weekStartOf(today), weekOffset * 7);
  $: weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const count = ingredients.filter((ingredient) => sameDate(new Date(ingredient.expiresAt), date)).length;
    return {
      day: dayLabels[date.getDay()],
      date,
      dateLabel: String(date.getDate()),
      count,
      active: sameDate(date, today),
    };
  });
  $: weekRangeLabel = `${formatDate(weekDays[0].date)} - ${formatDate(weekDays[6].date)}`;
  $: urgent = [...ingredients].sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime()).slice(0, 3);
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

  const closeDetailSheet = () => {
    selectedIngredient = null;
    selectedRecipe = null;
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
              <CardHeader class="flex items-start justify-between gap-3 p-5 pb-2">
                <div class="min-w-0">
                  <p class="text-sm text-[#7c837d]">{formatMonth(weekStart)}</p>
                  <h2 class="text-xl font-semibold">유통기한 캘린더</h2>
                </div>
                <div class="ml-auto flex shrink-0 items-center gap-1">
                  <Button class="size-9 rounded-full bg-[#f5f3ed] text-[#2c302b] hover:bg-[#ece8df]" size="icon" variant="ghost" aria-label="이전 주" onclick={() => (weekOffset -= 1)}>
                    <ChevronLeft class="size-4" />
                  </Button>
                  <Button class="size-9 rounded-full bg-[#f5f3ed] text-[#2c302b] hover:bg-[#ece8df]" size="icon" variant="ghost" aria-label="다음 주" onclick={() => (weekOffset += 1)}>
                    <ChevronRight class="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent class="grid gap-4 p-5">
                <div class="flex items-center justify-between gap-3">
                  <p class="text-sm font-medium text-[#69716b]">{weekRangeLabel}</p>
                  <Badge class="rounded-full" variant="secondary">{weekDays.reduce((sum, item) => sum + item.count, 0)}개 예정</Badge>
                </div>
                <div class="grid grid-cols-7 gap-1.5">
                  {#each weekDays as item}
                    <button type="button" class={`grid h-20 content-center gap-1 rounded-xl text-center text-sm transition ${item.active ? "bg-[#1d211c] text-white" : "bg-[#f5f3ed] hover:bg-[#ece8df]"}`}>
                      <span class="text-xs opacity-70">{item.day}</span>
                      <strong class="text-lg">{item.dateLabel}</strong>
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
                  <button type="button" class="grid gap-2 rounded-xl bg-[#f5f3ed] p-4 text-left transition hover:bg-[#ece8df]" onclick={() => (selectedIngredient = item)}>
                    <div class="flex items-start justify-between gap-4">
                      <div>
                        <h3 class="font-semibold">{ingredientName(item)}</h3>
                        <p class="text-sm text-[#7c837d]">{ingredientAmount(item)} · {formatExpireDate(item.expiresAt)}</p>
                      </div>
                      <Badge class="rounded-full" variant={dueLabel(item.expiresAt) === "오늘" ? "default" : "outline"}>{dueLabel(item.expiresAt)}</Badge>
                    </div>
                    <Progress class="[&>div]:bg-[#5fb76e]" value={(item.remainingQuantity / item.totalQuantity) * 100} />
                  </button>
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
                    <button type="button" class="flex items-center gap-3 rounded-xl bg-[#f5f3ed] p-4 text-left transition hover:bg-[#ece8df]" onclick={() => (selectedIngredient = item)}>
                      <div class="size-2 rounded-full bg-[#5fb76e]"></div>
                      <div class="min-w-0 flex-1">
                        <h3 class="truncate font-semibold">{ingredientName(item)}</h3>
                        <p class="truncate text-sm text-[#7c837d]">{ingredientMeta(item)}</p>
                      </div>
                      <Badge class="rounded-full" variant="muted">{ingredientTag(item)}</Badge>
                    </button>
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
                  <button type="button" class="flex min-h-16 items-center justify-between gap-4 rounded-xl bg-[#f5f3ed] px-4 text-left transition hover:bg-[#ece8df]" onclick={() => (selectedRecipe = recipe)}>
                    <div class="min-w-0">
                      <h2 class="truncate font-semibold">{recipe.recipe.name}</h2>
                      <p class="mt-1 text-sm text-[#7c837d]">{recipe.recipe.cookingMethod} · 보유 재료 {Math.round(recipe.matchScore * 100)}%</p>
                    </div>
                    <Badge class="rounded-full" variant="secondary">{Math.round(recipe.score * 100)}점</Badge>
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

    {#if selectedIngredient || selectedRecipe}
      <div class="fixed inset-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 overflow-hidden" role="dialog" aria-modal="true">
        <button class="absolute inset-0 bg-black/24 backdrop-blur-[1px]" type="button" aria-label="상세 닫기" onclick={closeDetailSheet}></button>
        <section class="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-[1.75rem] bg-[#f7f6f1] p-4 pb-6 shadow-[0_-24px_70px_rgba(29,33,28,0.24)]">
          <div class="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#d7d1c6]"></div>
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-[#5d7564]">{selectedIngredient ? "식재료 상세" : "레시피 상세"}</p>
              <h2 class="mt-1 truncate text-2xl font-semibold tracking-normal">
                {selectedIngredient ? ingredientName(selectedIngredient) : selectedRecipe?.recipe.name}
              </h2>
            </div>
            <Button class="size-10 shrink-0 rounded-full bg-[#e2ded5] text-[#2c302b] hover:bg-[#d7d1c6]" size="icon" variant="secondary" aria-label="상세 닫기" onclick={closeDetailSheet}>
              <X class="size-4" />
            </Button>
          </div>

          {#if selectedIngredient}
            <div class="mt-5 grid gap-3">
              <div class="grid grid-cols-3 gap-2">
                <div class="rounded-2xl bg-white p-4">
                  <p class="text-xs font-medium text-[#7c837d]">남은 양</p>
                  <strong class="mt-2 block text-lg">{ingredientAmount(selectedIngredient)}</strong>
                </div>
                <div class="rounded-2xl bg-white p-4">
                  <p class="text-xs font-medium text-[#7c837d]">보관</p>
                  <strong class="mt-2 block text-lg">{selectedIngredient.storage}</strong>
                </div>
                <div class="rounded-2xl bg-white p-4">
                  <p class="text-xs font-medium text-[#7c837d]">기한</p>
                  <strong class="mt-2 block text-lg">{dueLabel(selectedIngredient.expiresAt)}</strong>
                </div>
              </div>

              <Card class="rounded-[1.25rem] border-[#e6e0d6] bg-white shadow-sm">
                <CardContent class="grid gap-4 p-5">
                  <div class="grid gap-2">
                    <div class="flex items-center justify-between text-sm">
                      <span class="text-[#69716b]">사용 가능량</span>
                      <span class="font-semibold">{selectedIngredient.remainingQuantity} / {selectedIngredient.totalQuantity}{ingredientUnit(selectedIngredient)}</span>
                    </div>
                    <Progress class="[&>div]:bg-[#5fb76e]" value={(selectedIngredient.remainingQuantity / selectedIngredient.totalQuantity) * 100} />
                  </div>
                  <div class="grid gap-2 text-sm">
                    <div class="flex items-center justify-between gap-4">
                      <span class="text-[#69716b]">만료일</span>
                      <span class="font-medium">{formatExpireDate(selectedIngredient.expiresAt)}</span>
                    </div>
                    <div class="flex items-center justify-between gap-4">
                      <span class="text-[#69716b]">품목 코드</span>
                      <span class="font-medium">{selectedIngredient.itemCode}</span>
                    </div>
                    <div class="flex items-center justify-between gap-4">
                      <span class="text-[#69716b]">분류</span>
                      <span class="font-medium">{selectedIngredient.item?.category ?? "-"}</span>
                    </div>
                    <div class="flex items-center justify-between gap-4">
                      <span class="text-[#69716b]">단위</span>
                      <span class="font-medium">{selectedIngredient.item?.unitSize ?? selectedIngredient.item?.unit ?? "-"}</span>
                    </div>
                    <div class="flex items-center justify-between gap-4">
                      <span class="text-[#69716b]">가격</span>
                      <span class="font-medium">{selectedIngredient.item?.price ? `${selectedIngredient.item.price.toLocaleString()}원` : "-"}</span>
                    </div>
                    <div class="flex items-center justify-between gap-4">
                      <span class="text-[#69716b]">시장/지역</span>
                      <span class="truncate font-medium">{[selectedIngredient.item?.market, selectedIngredient.item?.region].filter(Boolean).join(" · ") || "-"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <p class="rounded-2xl bg-[#f0ede5] p-4 text-sm leading-6 text-[#69716b]">{selectedIngredient.memo}</p>
            </div>
          {:else if selectedRecipe}
            <div class="mt-5 grid gap-3">
              <div class="grid grid-cols-3 gap-2">
                <div class="rounded-2xl bg-white p-4">
                  <p class="text-xs font-medium text-[#7c837d]">매칭</p>
                  <strong class="mt-2 block text-lg">{Math.round(selectedRecipe.matchScore * 100)}%</strong>
                </div>
                <div class="rounded-2xl bg-white p-4">
                  <p class="text-xs font-medium text-[#7c837d]">임박 활용</p>
                  <strong class="mt-2 block text-lg">{Math.round(selectedRecipe.expiringSoonScore * 100)}%</strong>
                </div>
                <div class="rounded-2xl bg-white p-4">
                  <p class="text-xs font-medium text-[#7c837d]">점수</p>
                  <strong class="mt-2 block text-lg">{Math.round(selectedRecipe.score * 100)}</strong>
                </div>
              </div>

              <Card class="rounded-[1.25rem] border-[#e6e0d6] bg-white shadow-sm">
                <CardContent class="grid gap-4 p-5">
                  <div class="flex flex-wrap gap-2">
                    {#if selectedRecipe.recipe.cookingMethod}
                      <Badge class="gap-1 rounded-full" variant="secondary"><Utensils class="size-3.5" /> {selectedRecipe.recipe.cookingMethod}</Badge>
                    {/if}
                    {#if selectedRecipe.recipe.dishType}
                      <Badge class="gap-1 rounded-full" variant="outline"><ChefHat class="size-3.5" /> {selectedRecipe.recipe.dishType}</Badge>
                    {/if}
                    {#if selectedRecipe.recipe.nutrition?.calories}
                      <Badge class="gap-1 rounded-full" variant="outline"><Clock class="size-3.5" /> {selectedRecipe.recipe.nutrition.calories}kcal</Badge>
                    {/if}
                  </div>

                  <div class="grid gap-2">
                    <h3 class="font-semibold">재료</h3>
                    <p class="text-sm leading-6 text-[#69716b]">{selectedRecipe.recipe.ingredientText}</p>
                  </div>

                  <div class="grid gap-2">
                    <h3 class="font-semibold">보유 재료</h3>
                    <div class="flex flex-wrap gap-1.5">
                      {#each selectedRecipe.matchedIngredientNames as name}
                        <Badge class="rounded-full bg-[#e8f6e9] text-[#2f7c43]" variant="outline">{name}</Badge>
                      {/each}
                    </div>
                  </div>

                  {#if selectedRecipe.missingIngredientNames.length}
                    <div class="grid gap-2">
                      <h3 class="font-semibold">부족한 재료</h3>
                      <div class="flex flex-wrap gap-1.5">
                        {#each selectedRecipe.missingIngredientNames as name}
                          <Badge class="rounded-full" variant="outline">{name}</Badge>
                        {/each}
                      </div>
                    </div>
                  {/if}
                </CardContent>
              </Card>

              <Card class="rounded-[1.25rem] border-[#e6e0d6] bg-white shadow-sm">
                <CardContent class="grid gap-3 p-5">
                  <h3 class="font-semibold">조리 순서</h3>
                  {#each selectedRecipe.recipe.steps as step}
                    <div class="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3">
                      <span class="grid size-7 place-items-center rounded-full bg-[#1d211c] text-xs font-semibold text-white">{step.order}</span>
                      <p class="text-sm leading-6 text-[#69716b]">{step.description}</p>
                    </div>
                  {/each}
                </CardContent>
              </Card>

              {#if selectedRecipe.recipe.tip}
                <p class="rounded-2xl bg-[#f0ede5] p-4 text-sm leading-6 text-[#69716b]">{selectedRecipe.recipe.tip}</p>
              {/if}
            </div>
          {/if}
        </section>
      </div>
    {/if}
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
