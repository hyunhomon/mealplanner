<script lang="ts">
  import { onMount, tick } from "svelte";
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
  import {
    clearSession,
    getStoredSession,
    loadCharacter,
    loadIngredients,
    loadRecipeRecommendations,
    logout,
    rebirthCharacter,
    submitMealPhoto,
    type CharacterStateDto,
  } from "$lib/api";

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
  let isLoggedIn = false;
  let sessionEmail = "";
  let loadingRemote = false;
  let remoteError = "";

  const pages: { id: PageId; label: string; description: string; icon: typeof Home }[] = [
    { id: "greeney", label: "그리니", description: "오늘의 그리니 상태를 확인해요", icon: Sprout },
    { id: "fridge", label: "냉장고", description: "유통기한이 가까운 재료를 확인해요.", icon: Home },
    { id: "recipes", label: "레시피", description: "지금 가진 재료로 만들 메뉴를 찾아요.", icon: ChefHat },
    { id: "reports", label: "리포트", description: "이번 주 절약과 친환경 식사를 살펴봐요.", icon: BarChart3 },
  ];

  const nowIso = "2026-05-25T09:00:00.000Z";
  const userId = "user-demo";

  let ingredients: IngredientView[] = [
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

  let recipes: RecipeView[] = [
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
  let cameraOpen = false;
  let cameraBusy = false;
  let cameraError = "";
  let cameraSource: "greeney" | "fridge" = "greeney";
  let cameraStream: MediaStream | null = null;
  let cameraVideo: HTMLVideoElement;
  let cameraCanvas: HTMLCanvasElement;
  let detailSheetClosing = false;
  let detailSheetDragging = false;
  let detailSheetDragY = 0;
  let detailSheetStartY = 0;
  let detailSheetLastY = 0;
  let detailSheetLastTime = 0;

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
  $: mascotSrc =
    mood === "happy"
      ? "/assets/mascot/happy.svg"
      : mood === "sad"
        ? "/assets/mascot/weak.svg"
        : mood === "dead"
          ? "/assets/mascot/death.svg"
          : "/assets/mascot/default.svg";
  $: moodTitle =
    mood === "happy"
      ? "그리니는 행복해요"
      : mood === "normal"
        ? "그리니는 괜찮아요"
        : mood === "sad"
          ? "그리니는 우울해요"
          : "그리니가 멈췄어요";

  $: detailSheetStyle = `--sheet-y: ${detailSheetDragY}px; --overlay-opacity: ${Math.max(0, 1 - detailSheetDragY / 320)};`;

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

  const applyCharacter = (character: CharacterStateDto) => {
    state = {
      happiness: clamp(character.hp),
      isDead: character.stage === "dead" || character.hp <= 0,
      lastUpdatedAt: character.updated_at ?? character.last_fed_at ?? new Date().toISOString(),
      activityLog: state.activityLog,
    };
    persist();
  };

  const refreshRemoteData = async () => {
    const session = getStoredSession();
    isLoggedIn = Boolean(session);
    sessionEmail = session?.email ?? "";
    if (!session) return;

    loadingRemote = true;
    remoteError = "";

    try {
      const [remoteIngredients, remoteRecipes, character] = await Promise.all([
        loadIngredients(),
        loadRecipeRecommendations(),
        loadCharacter(),
      ]);
      ingredients = remoteIngredients.length ? remoteIngredients : ingredients;
      recipes = remoteRecipes.length ? remoteRecipes : recipes;
      applyCharacter(character);
    } catch (error) {
      remoteError = error instanceof Error ? error.message : "API 데이터를 불러오지 못했어요.";
      if (remoteError.toLowerCase().includes("unauthorized")) {
        clearSession();
        isLoggedIn = false;
        sessionEmail = "";
      }
    } finally {
      loadingRemote = false;
    }
  };

  const pickMockResult = (fileName: string) => {
    const seed = [...fileName].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return mockMealResults[seed % mockMealResults.length];
  };

  const handleMealPhoto = async (image: string, fileName: string) => {
    if (state.isDead) return;

    selectedFileName = fileName;

    try {
      const session = getStoredSession();
      if (session) {
        const response = await submitMealPhoto(image, selectedRecipe?.recipe.name);
        const delta = response.hp_change ?? response.hp - state.happiness;
        const result: MockMealResult = {
          title: response.food_name ?? "?앹궗 ?ъ쭊 遺꾩꽍",
          mealName: response.food_name ?? fileName,
          comment: response.reason ?? response.message ?? "?ъ쭊 遺꾩꽍 寃곌낵瑜?諛섏쁺?덉뼱??",
          reaction: response.status_message ?? response.message ?? "",
          delta,
        };
        selectedResult = result;
        applyCharacter(response);
        state = { ...state, activityLog: [createLogItem(result), ...state.activityLog].slice(0, 5) };
        persist();
        return;
      }

      const result = pickMockResult(fileName);
      selectedResult = result;
      updateState({
        ...state,
        happiness: clamp(state.happiness + result.delta),
        activityLog: [createLogItem(result), ...state.activityLog].slice(0, 5),
      });
    } catch (error) {
      const result = pickMockResult(fileName);
      selectedResult = {
        ...result,
        comment: error instanceof Error ? error.message : result.comment,
      };
    }
  };

  const stopCamera = () => {
    cameraStream?.getTracks().forEach((track) => track.stop());
    cameraStream = null;
    if (cameraVideo) {
      cameraVideo.srcObject = null;
    }
  };

  const openCamera = async (source: "greeney" | "fridge") => {
    if (source === "greeney" && state.isDead) return;

    cameraSource = source;
    cameraOpen = true;
    cameraBusy = false;
    cameraError = "";

    await tick();
    stopCamera();

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("이 브라우저에서는 웹캠 촬영을 사용할 수 없어요.");
      }

      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });

      await tick();
      if (cameraVideo) {
        cameraVideo.srcObject = cameraStream;
        await cameraVideo.play();
      }
    } catch (error) {
      cameraError = error instanceof Error ? error.message : "웹캠 권한을 가져오지 못했어요.";
      stopCamera();
    }
  };

  const closeCamera = () => {
    cameraOpen = false;
    cameraBusy = false;
    cameraError = "";
    stopCamera();
  };

  const captureCameraPhoto = async () => {
    if (!cameraVideo || !cameraCanvas || cameraBusy) return;

    const width = cameraVideo.videoWidth;
    const height = cameraVideo.videoHeight;
    if (!width || !height) {
      cameraError = "카메라 화면이 준비되지 않았어요. 잠시 후 다시 촬영해 주세요.";
      return;
    }

    cameraBusy = true;
    cameraCanvas.width = width;
    cameraCanvas.height = height;
    cameraCanvas.getContext("2d")?.drawImage(cameraVideo, 0, 0, width, height);

    const image = cameraCanvas.toDataURL("image/jpeg", 0.9).split(",")[1] ?? "";
    const fileName = `webcam-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`;

    if (cameraSource === "fridge") {
      activePage = "greeney";
    }

    try {
      await handleMealPhoto(image, fileName);
      closeCamera();
    } finally {
      cameraBusy = false;
    }
  };

  const restartGreeney = async () => {
    selectedResult = null;
    selectedFileName = "";
    try {
      if (getStoredSession()) {
        applyCharacter(await rebirthCharacter());
        return;
      }
    } catch (error) {
      remoteError = error instanceof Error ? error.message : "다시 시작하지 못했어요.";
    }

    state = defaultState();
    persist();
  };

  const handleLogout = async () => {
    await logout();
    isLoggedIn = false;
    sessionEmail = "";
  };

  const movePage = (page: PageId) => {
    activePage = page;
    menuOpen = false;
  };

  const resetDetailSheetDrag = () => {
    detailSheetDragging = false;
    detailSheetDragY = 0;
    detailSheetStartY = 0;
    detailSheetLastY = 0;
    detailSheetLastTime = 0;
  };

  const closeDetailSheet = async () => {
    if (detailSheetClosing) return;

    detailSheetClosing = true;
    detailSheetDragging = false;
    detailSheetDragY = Math.max(detailSheetDragY, 24);
    await new Promise((resolve) => window.setTimeout(resolve, 190));
    selectedIngredient = null;
    selectedRecipe = null;
    detailSheetClosing = false;
    resetDetailSheetDrag();
  };

  const startDetailSheetDrag = (event: PointerEvent) => {
    if (detailSheetClosing) return;

    detailSheetDragging = true;
    detailSheetStartY = event.clientY - detailSheetDragY;
    detailSheetLastY = event.clientY;
    detailSheetLastTime = performance.now();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const moveDetailSheetDrag = (event: PointerEvent) => {
    if (!detailSheetDragging) return;

    detailSheetDragY = Math.max(0, event.clientY - detailSheetStartY);
    detailSheetLastY = event.clientY;
    detailSheetLastTime = performance.now();
  };

  const endDetailSheetDrag = (event: PointerEvent) => {
    if (!detailSheetDragging) return;

    const elapsed = Math.max(1, performance.now() - detailSheetLastTime);
    const velocity = Math.max(0, (event.clientY - detailSheetLastY) / elapsed);
    const shouldClose = detailSheetDragY > 120 || (detailSheetDragY > 56 && velocity > 0.35);
    detailSheetDragging = false;

    if (shouldClose) {
      void closeDetailSheet();
    } else {
      detailSheetDragY = 0;
    }
  };

  onMount(() => {
    mounted = true;
    state = readState();
    persist();
    void refreshRemoteData();

    const interval = window.setInterval(() => {
      if (state.isDead) return;
      updateState(applyDecay(state));
    }, 60_000);

    return () => {
      window.clearInterval(interval);
      stopCamera();
    };
  });
</script>

<svelte:window onpointermove={moveDetailSheetDrag} onpointerup={endDetailSheetDrag} onpointercancel={endDetailSheetDrag} />

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
                      <img class={`greeney greeney-${mood}`} src={mascotSrc} alt={`greeney ${stateLabel} 상태`} />
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
      <button type="button" class="fixed bottom-6 left-[max(1rem,calc(50%-240px+1rem))] z-40 inline-flex h-14 cursor-pointer items-center gap-3 rounded-full bg-[#5fb76e] pl-4 pr-5 text-white shadow-[0_14px_40px_rgba(74,151,87,0.3)] transition hover:bg-[#4da25c]" aria-label="음식 촬영" onclick={() => openCamera("greeney")}>
        <span class="grid size-8 place-items-center rounded-full bg-white/18">
          <Camera class="size-5" />
        </span>
        <span class="text-sm font-semibold">음식 촬영</span>
      </button>
    {:else if activePage === "fridge"}
      <button
        type="button"
        class="fixed bottom-6 left-[max(1rem,calc(50%-240px+1rem))] z-40 inline-flex h-14 cursor-pointer items-center gap-3 rounded-full bg-[#5fb76e] pl-4 pr-5 text-white shadow-[0_14px_40px_rgba(74,151,87,0.3)] transition hover:bg-[#4da25c]"
        aria-label="식재료 추가"
        onclick={() => openCamera("fridge")}
      >
        <span class="grid size-8 place-items-center rounded-full bg-white/18">
          <Camera class="size-5" />
        </span>
        <span class="text-sm font-semibold">식재료 추가</span>
      </button>
    {/if}

    {#if cameraOpen}
      <div class="fixed inset-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 overflow-hidden bg-[#10130f]" role="dialog" aria-modal="true" aria-label="웹캠 촬영">
        <video bind:this={cameraVideo} class="h-full w-full object-cover" autoplay playsinline muted></video>
        <canvas bind:this={cameraCanvas} class="hidden"></canvas>

        {#if cameraError}
          <div class="absolute inset-x-4 top-20 rounded-2xl bg-white p-4 text-sm font-medium leading-6 text-[#2c302b] shadow-[0_14px_40px_rgba(0,0,0,0.24)]">
            {cameraError}
          </div>
        {/if}

        <div class="absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-gradient-to-b from-black/55 to-transparent p-4">
          <p class="text-sm font-semibold text-white">{cameraSource === "fridge" ? "식재료 촬영" : "음식 촬영"}</p>
          <Button class="size-10 rounded-full bg-white/16 text-white backdrop-blur hover:bg-white/24" size="icon" aria-label="촬영 닫기" onclick={closeCamera}>
            <X class="size-5" />
          </Button>
        </div>

        <div class="absolute inset-x-0 bottom-0 grid justify-items-center gap-3 bg-gradient-to-t from-black/70 to-transparent p-6 pb-8">
          <Button class="size-20 rounded-full border-4 border-white/55 bg-white text-[#1d211c] shadow-[0_14px_40px_rgba(0,0,0,0.3)] hover:bg-[#f5f3ed]" size="icon" aria-label="촬영하기" onclick={captureCameraPhoto} disabled={cameraBusy || !!cameraError}>
            <Camera class="size-8" />
          </Button>
          <p class="text-xs font-medium text-white/80">{cameraBusy ? "업로드 중" : "가운데 버튼을 눌러 촬영"}</p>
        </div>
      </div>
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
            <p class="mt-0 truncate text-xl font-medium leading-6 tracking-normal text-[#1d211c]">{isLoggedIn ? sessionEmail || "로그인 계정" : "익명의 사용자"}</p>
          </div>
          {#if isLoggedIn}
            <Button class="size-10 rounded-full bg-[#e2ded5] text-[#2c302b] hover:bg-[#d7d1c6]" size="icon" variant="secondary" aria-label="로그아웃" onclick={handleLogout}>
              <LogOut class="size-4" />
            </Button>
          {:else}
            <Button class="rounded-full px-4" href="/login" variant="secondary">로그인</Button>
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
      <div class="fixed inset-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 overflow-hidden" role="dialog" aria-modal="true" style={detailSheetStyle}>
        <button class={`detail-sheet-backdrop absolute inset-0 bg-black/24 backdrop-blur-[1px] ${detailSheetClosing ? "detail-sheet-backdrop-closing" : ""}`} type="button" aria-label="상세 닫기" onclick={closeDetailSheet}></button>
        <section class={`detail-sheet-panel absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-[1.75rem] bg-[#f7f6f1] p-4 pb-6 shadow-[0_-24px_70px_rgba(29,33,28,0.24)] ${detailSheetDragging ? "detail-sheet-dragging" : ""} ${detailSheetClosing ? "detail-sheet-closing" : ""}`}>
          <button
            class="detail-sheet-handle mx-auto mb-4 grid h-8 w-24 touch-none place-items-center rounded-full"
            type="button"
            aria-label="상세 시트 내리기"
            onpointerdown={startDetailSheetDrag}
          >
            <span class="h-1.5 w-12 rounded-full bg-[#d7d1c6]"></span>
          </button>
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
  .detail-sheet-backdrop {
    opacity: var(--overlay-opacity);
    animation: detailBackdropIn 180ms ease-out both;
  }

  .detail-sheet-backdrop-closing {
    animation: detailBackdropOut 180ms ease-in both;
  }

  .detail-sheet-panel {
    transform: translate3d(0, var(--sheet-y), 0);
    animation: detailSheetIn 240ms cubic-bezier(0.2, 0.85, 0.2, 1) both;
    will-change: transform;
  }

  .detail-sheet-panel:not(.detail-sheet-dragging):not(.detail-sheet-closing) {
    transition: transform 220ms cubic-bezier(0.2, 0.85, 0.2, 1);
  }

  .detail-sheet-dragging {
    animation: none;
    transition: none;
  }

  .detail-sheet-closing {
    animation: detailSheetOut 190ms cubic-bezier(0.4, 0, 1, 1) both;
  }

  .detail-sheet-handle {
    cursor: grab;
  }

  .detail-sheet-handle:active {
    cursor: grabbing;
  }

  @keyframes detailBackdropIn {
    from {
      opacity: 0;
    }

    to {
      opacity: var(--overlay-opacity);
    }
  }

  @keyframes detailBackdropOut {
    from {
      opacity: var(--overlay-opacity);
    }

    to {
      opacity: 0;
    }
  }

  @keyframes detailSheetIn {
    from {
      transform: translate3d(0, 100%, 0);
    }

    to {
      transform: translate3d(0, var(--sheet-y), 0);
    }
  }

  @keyframes detailSheetOut {
    from {
      transform: translate3d(0, var(--sheet-y), 0);
    }

    to {
      transform: translate3d(0, 100%, 0);
    }
  }

  .greeney {
    width: min(70%, 15rem);
    max-height: 14.5rem;
    object-fit: contain;
    filter: drop-shadow(0 18px 20px rgb(84 122 74 / 18%));
    transition:
      transform 240ms ease,
      filter 240ms ease;
  }

  .greeney-happy {
    animation: floaty 2.6s ease-in-out infinite;
  }

  .greeney-sad {
    filter: saturate(0.74);
    transform: translateY(0.4rem) rotate(-2deg);
  }

  .greeney-dead {
    width: min(76%, 16rem);
    max-height: 15rem;
    filter: drop-shadow(0 18px 20px rgb(84 122 74 / 14%));
    transform: rotate(2deg);
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
