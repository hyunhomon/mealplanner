<script lang="ts">
  import {
    BarChart3,
    Camera,
    ChefHat,
    Home,
    Menu,
    Mic,
    Plus,
    ReceiptText,
    Search,
    UserRound,
    X,
  } from "lucide-svelte";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardHeader } from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Progress } from "$lib/components/ui/progress";
  import { Sheet, SheetContent, SheetOverlay } from "$lib/components/ui/sheet";

  type PageId = "home" | "recipes" | "reports";

  const pages: { id: PageId; label: string; description: string; icon: typeof Home }[] = [
    { id: "home", label: "홈", description: "유통기한이 가까운 식재료부터 확인해요.", icon: Home },
    { id: "recipes", label: "레시피", description: "지금 가진 재료로 만들 수 있는 메뉴를 찾아요.", icon: ChefHat },
    { id: "reports", label: "식비", description: "이번 달 절약과 소비 흐름을 가볍게 봐요.", icon: BarChart3 },
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
    { name: "달걀", meta: "냉장 · 9일 남음", tag: "아침" },
    { name: "양파", meta: "실온 · 12일 남음", tag: "기본" },
    { name: "그릭요거트", meta: "냉장 · 5일 남음", tag: "간식" },
    { name: "새송이버섯", meta: "냉장 · 3일 남음", tag: "볶음" },
  ];

  const recipes = [
    { title: "두부 시금치 덮밥", detail: "18분 · 보유 재료 86%", saving: "6,200원 절약" },
    { title: "토마토 달걀 볶음", detail: "12분 · 보유 재료 100%", saving: "4,100원 절약" },
    { title: "닭가슴살 버섯 파스타", detail: "24분 · 보유 재료 72%", saving: "7,800원 절약" },
  ];

  const stats = [
    { label: "이번 달 식비", value: "284,500원" },
    { label: "폐기 방지", value: "31개" },
    { label: "외식 대체", value: "9회" },
  ];

  const preferences = ["고단백", "채소 많이", "15분 요리", "매운맛 보통"];

  let activePage: PageId = "home";
  let menuOpen = false;
  let fabOpen = false;

  $: currentPage = pages.find((page) => page.id === activePage) ?? pages[0];
</script>

<svelte:head>
  <title>Mealplanner</title>
  <meta name="description" content="식재료 유통기한과 레시피를 lean하게 관리하는 모바일 앱" />
</svelte:head>

<main class="min-h-screen bg-[#faf9f6] text-foreground">
  <div class="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-8 md:px-6">
    <header class="sticky top-0 z-30 -mx-4 bg-[#faf9f6]/90 px-4 py-4 backdrop-blur md:mx-0 md:px-0">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <p class="text-sm font-medium text-muted-foreground">Mealplanner</p>
          <h1 class="mt-1 text-2xl font-semibold tracking-normal">{currentPage.label}</h1>
          <p class="mt-1 max-w-[20rem] text-sm leading-5 text-muted-foreground">{currentPage.description}</p>
        </div>
        <Button size="icon" variant="outline" aria-label="메뉴 열기" onclick={() => (menuOpen = true)}>
          <Menu />
        </Button>
      </div>
    </header>

    <section class="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
      <div class="grid min-w-0 gap-4">
        {#if activePage === "home"}
          <Card class="overflow-hidden bg-white/90">
            <CardHeader class="flex-row items-center justify-between gap-3">
              <div>
                <p class="text-sm text-muted-foreground">2026년 5월</p>
                <h2 class="text-lg font-semibold">유통기한</h2>
              </div>
              <Badge variant="secondary">14개 예정</Badge>
            </CardHeader>
            <CardContent>
              <div class="grid grid-cols-7 gap-1.5">
                {#each calendar as item}
                  <button
                    type="button"
                    class={`grid h-20 content-center gap-1 rounded-lg border text-center text-sm transition ${
                      item.active ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:bg-muted"
                    }`}
                    aria-label={`${item.day}요일 만료 예정 ${item.count}개`}
                  >
                    <span class="text-xs opacity-70">{item.day}</span>
                    <strong class="text-lg">{item.date}</strong>
                    <span class="text-xs opacity-70">{item.count}개</span>
                  </button>
                {/each}
              </div>
            </CardContent>
          </Card>

          <section class="grid gap-2">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold">임박한 식재료</h2>
              <Button variant="ghost" size="sm">전체</Button>
            </div>
            {#each urgent as item}
              <Card class="bg-white/90">
                <CardContent class="grid gap-3">
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <h3 class="font-semibold">{item.name}</h3>
                      <p class="text-sm text-muted-foreground">{item.amount}</p>
                    </div>
                    <Badge variant={item.due === "오늘" ? "default" : "outline"}>{item.due}</Badge>
                  </div>
                  <Progress value={item.value} />
                </CardContent>
              </Card>
            {/each}
          </section>

          <section class="grid gap-3">
            <div class="sticky top-[106px] z-20 -mx-4 border-y bg-[#faf9f6]/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-lg md:border">
              <div class="relative">
                <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input class="h-11 bg-white pl-9" placeholder="식재료 검색" />
              </div>
            </div>
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold">식재료</h2>
              <span class="text-sm text-muted-foreground">{ingredients.length}개</span>
            </div>
            <div class="grid gap-2">
              {#each ingredients as item}
                <Card class="bg-white/90">
                  <CardContent class="flex items-center gap-3 py-3">
                    <div class="size-2 rounded-full bg-primary"></div>
                    <div class="min-w-0 flex-1">
                      <h3 class="truncate font-medium">{item.name}</h3>
                      <p class="truncate text-sm text-muted-foreground">{item.meta}</p>
                    </div>
                    <Badge variant="muted">{item.tag}</Badge>
                  </CardContent>
                </Card>
              {/each}
            </div>
          </section>
        {:else if activePage === "recipes"}
          <div class="relative">
            <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input class="h-12 bg-white pl-9" placeholder="레시피 검색" />
          </div>
          <div class="grid gap-2">
            {#each recipes as recipe}
              <Card class="bg-white/90">
                <CardContent class="flex items-center justify-between gap-4">
                  <div class="min-w-0">
                    <h2 class="truncate font-semibold">{recipe.title}</h2>
                    <p class="mt-1 text-sm text-muted-foreground">{recipe.detail}</p>
                  </div>
                  <Badge variant="secondary">{recipe.saving}</Badge>
                </CardContent>
              </Card>
            {/each}
          </div>
        {:else}
          <Card class="bg-foreground text-background">
            <CardContent class="p-5">
              <p class="text-sm opacity-70">이번 달 총 절약 금액</p>
              <strong class="mt-2 block text-4xl font-semibold tracking-normal">127,400원</strong>
            </CardContent>
          </Card>
          <div class="grid gap-2">
            {#each stats as stat}
              <Card class="bg-white/90">
                <CardContent class="flex items-center justify-between">
                  <span class="text-muted-foreground">{stat.label}</span>
                  <strong>{stat.value}</strong>
                </CardContent>
              </Card>
            {/each}
          </div>
          <Card class="bg-white/90">
            <CardHeader>
              <h2 class="font-semibold">카테고리</h2>
            </CardHeader>
            <CardContent class="grid gap-3">
              {#each [["신선식품", 42], ["단백질", 28], ["간편식", 18]] as row}
                <div class="grid gap-1.5">
                  <div class="flex justify-between text-sm">
                    <span>{row[0]}</span>
                    <span class="text-muted-foreground">{row[1]}%</span>
                  </div>
                  <Progress value={Number(row[1])} />
                </div>
              {/each}
            </CardContent>
          </Card>
        {/if}
      </div>

      <aside class="hidden md:block">
        <Card class="sticky top-28 bg-white/90">
          <CardHeader>
            <p class="text-sm text-muted-foreground">오늘의 추천</p>
            <h2 class="text-lg font-semibold">두부 시금치 덮밥</h2>
          </CardHeader>
          <CardContent class="grid gap-4">
            <p class="text-sm leading-6 text-muted-foreground">오늘 만료되는 두부와 내일 만료되는 시금치를 한 번에 사용할 수 있어요.</p>
            <Button>레시피 보기</Button>
          </CardContent>
        </Card>
      </aside>
    </section>

    {#if activePage === "home"}
      <div class="fixed bottom-6 right-4 z-40 grid justify-items-end gap-2 md:right-[calc((100vw-min(64rem,100vw))/2+1.5rem)]">
        {#if fabOpen}
          <Card class="bg-white/95 shadow-lg">
            <CardContent class="grid gap-1 p-1.5">
              <Button variant="ghost" class="justify-start gap-2"><Mic size={17} /> 음성 입력</Button>
              <Button variant="ghost" class="justify-start gap-2"><ReceiptText size={17} /> 영수증 촬영</Button>
              <Button variant="ghost" class="justify-start gap-2"><Camera size={17} /> 식재료 촬영</Button>
            </CardContent>
          </Card>
        {/if}
        <Button
          class="size-14 rounded-full shadow-lg"
          size="icon"
          aria-label="식재료 추가"
          aria-expanded={fabOpen}
          onclick={() => (fabOpen = !fabOpen)}
        >
          <Plus class={`transition ${fabOpen ? "rotate-45" : ""}`} />
        </Button>
      </div>
    {/if}
  </div>

  <Sheet open={menuOpen}>
    <SheetOverlay onclick={() => (menuOpen = false)} />
    <SheetContent aria-label="메뉴">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm text-muted-foreground">Menu</p>
          <h2 class="text-2xl font-semibold tracking-normal">Mealplanner</h2>
        </div>
        <Button size="icon" variant="ghost" aria-label="메뉴 닫기" onclick={() => (menuOpen = false)}>
          <X />
        </Button>
      </div>

      <Card class="mt-6 bg-white/90">
        <CardContent class="grid gap-4 p-4">
          <div class="flex items-center gap-3">
            <div class="grid size-11 place-items-center rounded-lg bg-foreground text-background">
              <UserRound size={21} />
            </div>
            <div class="min-w-0">
              <p class="text-sm text-muted-foreground">로그인됨</p>
              <h3 class="truncate font-semibold">hyun@example.com</h3>
            </div>
          </div>
          <div class="flex flex-wrap gap-1.5">
            {#each preferences as preference}
              <Badge variant="outline">{preference}</Badge>
            {/each}
          </div>
        </CardContent>
      </Card>

      <nav class="mt-6 grid gap-1">
        {#each pages as page}
          <button
            type="button"
            class={`flex min-h-12 items-center gap-3 rounded-lg px-3 text-left transition ${
              activePage === page.id ? "bg-foreground text-background" : "hover:bg-muted"
            }`}
            aria-current={activePage === page.id ? "page" : undefined}
            onclick={() => {
              activePage = page.id;
              menuOpen = false;
              fabOpen = false;
            }}
          >
            <svelte:component this={page.icon} size={18} />
            <span class="font-medium">{page.label}</span>
          </button>
        {/each}
      </nav>

      <div class="mt-auto grid gap-2 border-t pt-4">
        <Button variant="secondary">계정 관리</Button>
        <Button variant="outline">로그아웃</Button>
      </div>
    </SheetContent>
  </Sheet>
</main>
