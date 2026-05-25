<script lang="ts">
  import {
    CalendarDays,
    Check,
    ChefHat,
    CirclePlus,
    Clock3,
    Leaf,
    ShoppingBasket,
    Sparkles,
  } from "lucide-svelte";

  const days = [
    { day: "월", meal: "두부 채소 덮밥", time: "20분", tag: "가볍게" },
    { day: "화", meal: "닭가슴살 또띠아", time: "15분", tag: "고단백" },
    { day: "수", meal: "버섯 크림 리조또", time: "30분", tag: "따뜻하게" },
    { day: "목", meal: "연어 포케", time: "18분", tag: "신선하게" },
    { day: "금", meal: "토마토 비프 파스타", time: "25분", tag: "든든하게" },
  ];

  const groceries = ["현미밥", "두부", "샐러드 채소", "닭가슴살", "연어", "토마토", "버섯"];
</script>

<svelte:head>
  <title>Mealplanner</title>
  <meta
    name="description"
    content="A SvelteKit PWA meal planner with Pretendard and lucide icons."
  />
</svelte:head>

<main class="app-shell">
  <aside class="sidebar" aria-label="Mealplanner navigation">
    <div class="brand">
      <span class="brand-mark"><ChefHat size={22} strokeWidth={2.3} /></span>
      <span>Mealplanner</span>
    </div>

    <nav class="nav-list">
      <a class="active" href="/" aria-current="page"><CalendarDays size={18} /> 주간 식단</a>
      <a href="/"><ShoppingBasket size={18} /> 장보기</a>
      <a href="/"><Sparkles size={18} /> 추천</a>
    </nav>
  </aside>

  <section class="workspace" aria-label="Weekly meal planner">
    <header class="topbar">
      <div>
        <p class="eyebrow">이번 주 플랜</p>
        <h1>바쁜 평일 식단을 한눈에 정리해요.</h1>
      </div>
      <button class="primary" type="button"><CirclePlus size={18} /> 식단 추가</button>
    </header>

    <section class="summary-grid" aria-label="Meal plan summary">
      <div class="metric">
        <Clock3 size={20} />
        <span>평균 조리</span>
        <strong>21분</strong>
      </div>
      <div class="metric">
        <Leaf size={20} />
        <span>채소 메뉴</span>
        <strong>4개</strong>
      </div>
      <div class="metric">
        <Check size={20} />
        <span>준비 완료</span>
        <strong>72%</strong>
      </div>
    </section>

    <section class="planner-grid" aria-label="Weekday meals">
      {#each days as item}
        <article class="meal-card">
          <div class="day">{item.day}</div>
          <div>
            <h2>{item.meal}</h2>
            <p>{item.time} · {item.tag}</p>
          </div>
        </article>
      {/each}
    </section>

    <section class="grocery-panel" aria-label="Grocery checklist">
      <div>
        <p class="eyebrow">자동 장보기 목록</p>
        <h2>이번 주 필요한 재료</h2>
      </div>
      <div class="chips">
        {#each groceries as item}
          <span>{item}</span>
        {/each}
      </div>
    </section>
  </section>
</main>

<style>
  .app-shell {
    display: grid;
    grid-template-columns: 240px minmax(0, 1fr);
    min-height: 100vh;
  }

  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 28px;
    border-right: 1px solid #ded7ca;
    background: #fffcf6;
    padding: 24px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 18px;
    font-weight: 700;
  }

  .brand-mark {
    display: inline-grid;
    width: 38px;
    height: 38px;
    place-items: center;
    border-radius: 8px;
    color: #ffffff;
    background: #264f3f;
  }

  .nav-list {
    display: grid;
    gap: 6px;
  }

  .nav-list a {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 42px;
    border-radius: 8px;
    color: #5c574f;
    padding: 0 12px;
    text-decoration: none;
  }

  .nav-list a.active {
    color: #1f3f34;
    background: #e8efe7;
    font-weight: 700;
  }

  .workspace {
    display: grid;
    align-content: start;
    gap: 22px;
    padding: 28px;
  }

  .topbar {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 20px;
  }

  .eyebrow {
    margin: 0 0 8px;
    color: #7c7166;
    font-size: 13px;
    font-weight: 700;
  }

  h1,
  h2,
  p {
    margin: 0;
  }

  h1 {
    max-width: 680px;
    font-size: 36px;
    line-height: 1.18;
  }

  .primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
    border: 0;
    border-radius: 8px;
    color: #ffffff;
    background: #264f3f;
    padding: 0 16px;
    font-weight: 700;
    white-space: nowrap;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .metric {
    display: grid;
    gap: 8px;
    border: 1px solid #ded7ca;
    border-radius: 8px;
    background: #fffcf6;
    padding: 18px;
  }

  .metric :global(svg) {
    color: #8a5f2d;
  }

  .metric span {
    color: #6d665e;
    font-size: 14px;
  }

  .metric strong {
    font-size: 28px;
  }

  .planner-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(150px, 1fr));
    gap: 12px;
  }

  .meal-card {
    display: grid;
    gap: 18px;
    min-height: 190px;
    border: 1px solid #ded7ca;
    border-radius: 8px;
    background: #ffffff;
    padding: 18px;
  }

  .day {
    display: grid;
    width: 42px;
    height: 42px;
    place-items: center;
    border-radius: 8px;
    color: #264f3f;
    background: #e8efe7;
    font-weight: 800;
  }

  .meal-card h2 {
    font-size: 18px;
    line-height: 1.35;
  }

  .meal-card p {
    margin-top: 8px;
    color: #756d64;
    font-size: 14px;
  }

  .grocery-panel {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    border: 1px solid #ded7ca;
    border-radius: 8px;
    background: #fffcf6;
    padding: 20px;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    justify-content: end;
    gap: 8px;
  }

  .chips span {
    border: 1px solid #d7cab9;
    border-radius: 999px;
    background: #ffffff;
    padding: 8px 12px;
    color: #4e4841;
    font-size: 14px;
    font-weight: 600;
  }

  @media (max-width: 920px) {
    .app-shell {
      grid-template-columns: 1fr;
    }

    .sidebar {
      position: sticky;
      top: 0;
      z-index: 2;
      border-right: 0;
      border-bottom: 1px solid #ded7ca;
      padding: 14px 16px;
    }

    .nav-list {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .nav-list a {
      justify-content: center;
    }

    .planner-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 640px) {
    .workspace {
      padding: 20px 16px;
    }

    .topbar,
    .grocery-panel {
      align-items: stretch;
      flex-direction: column;
    }

    h1 {
      font-size: 28px;
    }

    .summary-grid,
    .planner-grid {
      grid-template-columns: 1fr;
    }

    .chips {
      justify-content: start;
    }
  }
</style>
