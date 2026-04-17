# 무료 게임 알리미 Discord 봇

Steam, Epic Games, GOG의 무료 게임을 자동으로 탐지해 Discord 채널에 알림을 보내는 봇입니다.

---

## 주요 기능

- **자동 알림** — 설정한 주기마다 무료 게임을 확인해 등록된 채널에 공지합니다.
- **다중 서버 지원** — 여러 Discord 서버에 봇을 초대해 서버별로 독립 운영할 수 있습니다.
- **DM 구독** — 원하는 유통사만 골라 개인 DM으로 알림을 받을 수 있습니다.
- **중복 방지** — SQLite DB로 이미 알린 게임은 다시 알리지 않습니다.

---

## 지원 유통사

| 유통사 | 수집 방식 |
|---|---|
| Epic Games | 공식 프로모션 API |
| Steam | 스토어 검색 페이지 스크래핑 (100% 할인 필터) |
| GOG | ajax/filtered API + 기브어웨이 페이지 스크래핑 |

---

## 시작하기

### 요구사항

- Node.js 18 이상
- Discord 봇 토큰 ([Discord Developer Portal](https://discord.com/developers/applications))

### 설치

```bash
git clone https://github.com/유저명/freeGameAlarm.git
cd freeGameAlarm
npm install
```

### 환경변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열고 값을 입력합니다.

```env
# Discord 봇 토큰
DISCORD_TOKEN=your_bot_token_here

# 슬래시 커맨드를 특정 서버에만 등록 (없으면 전역 등록, 반영까지 최대 1시간)
# DISCORD_GUILD_ID=987654321098765432

# 자동 확인 주기 (시간 단위, 기본값: 6)
CHECK_INTERVAL_HOURS=6
```

### 빌드 및 실행

```bash
# 빌드 후 실행
npm run build
npm start

# 개발 모드 (ts-node)
npm run dev
```

### Discord 봇 권한 설정

Developer Portal에서 봇에 다음 권한을 부여하세요.

- `Send Messages`
- `Embed Links`
- `Read Message History`

Privileged Intents는 필요하지 않습니다.

---

## 슬래시 커맨드

### 관리자 전용

| 커맨드 | 설명 |
|---|---|
| `/setchannel` | 현재 채널을 무료 게임 알림 채널로 등록 |
| `/unsetchannel` | 현재 채널의 알림 해제 |
| `/check` | 지금 바로 무료 게임을 확인하고 등록된 모든 채널에 공지 |

### 일반

| 커맨드 | 설명 |
|---|---|
| `/list` | 현재 무료 게임 전체 목록 조회 (본인에게만 표시) |
| `/subscribe [유통사]` | 특정 유통사의 무료 게임 DM 알림 구독 |
| `/unsubscribe [유통사]` | 구독 해제 |
| `/subscriptions` | 내 구독 현황 확인 |

---

## 사용 방법

### 서버 알림 채널 등록

1. 봇을 서버에 초대합니다.
2. 알림을 받을 채널에서 `/setchannel`을 실행합니다.
3. 이후 설정한 주기마다 새 무료 게임이 자동으로 공지됩니다.

### DM 알림 구독

```
/subscribe Epic Games   → Epic Games 게임만 DM 수신
/subscribe Steam        → Steam 게임만 DM 수신
/subscribe 전체         → 모든 유통사 DM 수신
```

> Discord 설정에서 **개인 메시지 허용**이 켜져 있어야 DM이 수신됩니다.

---

## 프로젝트 구조

```
src/
├── bot.ts              # Discord 봇 메인 + 슬래시 커맨드 핸들러
├── db.ts               # SQLite (알림 추적, 채널 및 구독 관리)
├── notifier.ts         # Embed 생성 + 채널 및 DM 전송
├── types.ts            # 공통 타입 정의
└── scrapers/
    ├── index.ts        # 전체 스크래퍼 통합
    ├── epic.ts         # Epic Games API
    ├── steam.ts        # Steam 스토어 스크래핑
    └── gog.ts          # GOG API + 스크래핑
```

---

## 라이선스

MIT
