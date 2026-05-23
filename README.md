# MealPlanner

냉장고 속 식재료를 기록하고, 소비기한 기반으로 레시피를 추천해주는 AI 식단 관리 앱입니다.

## Overview

MealPlanner는 장을 본 뒤 식재료를 제때 소비하지 못해 발생하는 음식물 쓰레기와 식비 손실을 줄이기 위한 앱입니다.

사용자는 영수증 사진이나 음성 입력으로 식재료를 간편하게 등록하고, 앱은 소비기한이 임박한 재료를 기준으로 레시피를 추천합니다.

## Features

- 영수증 OCR 기반 식재료 등록
- 음성 입력 기반 식재료 등록
- 소비기한 자동 계산 및 알림
- 냉장고 재료 기반 AI 레시피 추천
- 식재료 소비 완료 처리
- 식비 절감 / 탄소 절감 리포트

## Architecture

```txt
mealplanner/
  apps/
    desktop/        # SvelteKit + Tauri
    api/            # Elysia

  packages/
    shared/         # shared types, schemas, constants
```

MealPlanner는 Bun workspace 기반의 모노레포로 구성됩니다.

`desktop`은 사용자 앱을 담당하고, `api`는 식재료 관리와 AI 기능 처리를 담당합니다.
공통 타입과 스키마는 `packages/shared`에서 관리하여 프론트엔드와 백엔드 간 데이터 구조를 일관되게 유지합니다.

## Tech Stack

* SvelteKit
* Tauri
* Elysia
* Bun
* TypeScript
