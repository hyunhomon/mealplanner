<script lang="ts">
  import { ArrowLeft, Check, Leaf, Lock, Mail } from "lucide-svelte";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { login, signup } from "$lib/api";

  type AuthMode = "login" | "signup";

  let { mode }: { mode: AuthMode } = $props();

  const isSignup = $derived(mode === "signup");
  const page = $derived(
    isSignup
      ? {
          eyebrow: "새 계정 만들기",
          title: "그리니와 식재료를 함께 관리해요",
          description: "냉장고 재료와 레시피 추천, 그리니 HP를 한 계정에서 이어서 볼 수 있어요.",
          action: "회원가입",
          switchText: "이미 계정이 있나요?",
          switchAction: "로그인",
          switchHref: "/login",
        }
      : {
          eyebrow: "다시 만나서 반가워요",
          title: "오늘의 냉장고를 이어서 확인해요",
          description: "저장해둔 식재료와 그리니 상태를 불러와 바로 이어갈 수 있어요.",
          action: "로그인",
          switchText: "아직 계정이 없나요?",
          switchAction: "회원가입",
          switchHref: "/signup",
        }
  );

  let email = $state("");
  let password = $state("");
  let errorMessage = $state("");
  let loading = $state(false);

  const handleSubmit = async () => {
    if (loading) return;

    loading = true;
    errorMessage = "";

    try {
      const session = isSignup ? await signup(email, password) : await login(email, password);
      if (session.accessToken) {
        window.location.href = "/";
        return;
      }

      errorMessage = "가입 확인 메일을 확인한 뒤 로그인해 주세요.";
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "요청을 처리하지 못했어요.";
    } finally {
      loading = false;
    }
  };
</script>

<svelte:head>
  <title>{page.action} | greeney</title>
  <meta name="description" content="greeney 계정으로 식재료와 레시피를 관리하세요." />
</svelte:head>

<main class="flex min-h-screen justify-center bg-[#ece9df] text-[#1d211c]">
  <div class="relative flex min-h-screen w-full max-w-[480px] flex-col overflow-hidden bg-[#f7f6f1] px-4 py-5 shadow-[0_0_60px_rgba(29,33,28,0.12)]">
    <div class="flex items-center justify-between">
      <Button class="size-10 rounded-full bg-white text-[#2c302b] shadow-sm hover:bg-[#f0ede5]" href="/" size="icon" variant="ghost" aria-label="뒤로 가기">
        <ArrowLeft class="size-5" />
      </Button>
      <Badge class="rounded-full bg-[#e8f6e9] px-3 py-1 text-[#2f7c43]" variant="outline">
        <Leaf class="size-3.5" />
        greeney
      </Badge>
    </div>

    <section class="flex flex-1 flex-col justify-center gap-7 pb-10 pt-8">
      <div class="grid gap-4">
        <div class="grid size-16 place-items-center rounded-[1.25rem] bg-[#1d211c] text-[#d8f4a7] shadow-[0_18px_44px_rgba(29,33,28,0.18)]">
          <Leaf class="size-8" />
        </div>
        <div class="grid gap-2">
          <p class="text-sm font-semibold text-[#5d7564]">{page.eyebrow}</p>
          <h1 class="text-[2rem] font-semibold leading-tight tracking-normal">{page.title}</h1>
          <p class="max-w-[22rem] text-sm leading-6 text-[#69716b]">{page.description}</p>
        </div>
      </div>

      <form class="grid gap-3" onsubmit={(event) => { event.preventDefault(); void handleSubmit(); }}>
        <label class="grid gap-2">
          <span class="text-sm font-semibold text-[#3b4139]">이메일</span>
          <span class="relative">
            <Mail class="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#8a9088]" />
            <Input class="h-14 rounded-2xl border-[#e6e0d6] bg-white pl-11 text-base shadow-none focus-visible:ring-[#5fb76e]/20" autocomplete="email" oninput={(event) => (email = event.currentTarget.value)} placeholder="you@example.com" required type="email" value={email} />
          </span>
        </label>

        <label class="grid gap-2">
          <span class="text-sm font-semibold text-[#3b4139]">비밀번호</span>
          <span class="relative">
            <Lock class="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#8a9088]" />
            <Input class="h-14 rounded-2xl border-[#e6e0d6] bg-white pl-11 text-base shadow-none focus-visible:ring-[#5fb76e]/20" autocomplete={isSignup ? "new-password" : "current-password"} minlength={8} oninput={(event) => (password = event.currentTarget.value)} placeholder="8자 이상 입력해요" required type="password" value={password} />
          </span>
        </label>

        {#if isSignup}
          <label class="mt-1 flex items-start gap-3 rounded-2xl bg-[#f0ede5] p-4 text-sm leading-5 text-[#69716b]">
            <span class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md bg-[#1d211c] text-white">
              <Check class="size-3.5" />
            </span>
            <span>식재료와 레시피 추천을 위해 계정 정보를 저장하는 데 동의해요.</span>
          </label>
        {:else}
          <div class="flex justify-end">
            <Button class="h-auto px-0 text-[#5d7564] hover:bg-transparent" href="/login" variant="ghost">비밀번호를 잊었나요?</Button>
          </div>
        {/if}

        {#if errorMessage}
          <p class="rounded-2xl bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">{errorMessage}</p>
        {/if}

        <Button class="mt-2 h-14 rounded-full bg-[#1d211c] text-base font-semibold text-white shadow-[0_16px_44px_rgba(29,33,28,0.2)] hover:bg-[#30382f]" disabled={loading} type="submit">
          {loading ? "처리 중..." : page.action}
        </Button>
      </form>

      <div class="flex items-center justify-center gap-2 text-sm text-[#69716b]">
        <span>{page.switchText}</span>
        <Button class="h-auto px-0 font-semibold text-[#2f7c43] hover:bg-transparent" href={page.switchHref} variant="ghost">{page.switchAction}</Button>
      </div>
    </section>
  </div>
</main>
