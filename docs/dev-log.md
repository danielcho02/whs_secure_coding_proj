# Development Log - Frontend Visual System Redesign

Claude read-only 디자인 진단을 바탕으로 radius/shadow/card 중심 UI를 정리하고 marketplace visual system을 재설계했다.

- 둥근 곡률(Border Radius) 및 섀도우 축소:
  - `--radius-xs` 4px, `--radius-sm` 6px, `--radius-md` 8px, `--radius-lg` 10px, `--radius-xl` 12px로 통일.
  - `--shadow-raised` 제거 및 호버 시의 번잡한 scale/shadow 효과 배제.
  - 표면 구분은 1px 연한 테두리(`border: 1px solid var(--line)`)와 단색 page wash (`#faf9f6`) 위주로 단정하게 정리.
- 공통 컴포넌트:
  - 버튼 높이 38~40px 통일, 둥글기 8px, font-weight 600 적용.
  - 칩 및 뱃지의 pill 모양을 낮은 곡률의 사각형 칩으로 플랫하게 통일.
- 레이아웃 및 쉘:
  - 데스크톱 Flat Sidebar 적용 및 액티브 아이템 백그라운드 pill 스타일 제거.
  - 모바일 하단 탭바를 플랫한 Edge-to-edge 바텀 바로 교체.
- 모바일 거래 앱 디테일 강화:
  - 상세페이지 및 상품 등록 화면 등 하단 sticky 버튼/제출 바가 노출되는 페이지에서는 `body.has-sticky-action` 클래스를 통해 모바일 탭바를 숨김 처리하여, 실제 당근마켓 등 중고거래 앱처럼 하단 바가 바닥(`bottom: 0`)에 깔끔하게 도킹되도록 구현.
- 마이페이지 & 관심목록:
  - 찜 및 내 상품 가로 스크롤 캐러셀(Toy carousel) 구조를 반응형 플랫 그리드(`.photo-shelf` override)로 전환하여 일반적인 마켓플레이스 피드 리스트 형태로 탈바꿈.
- 채팅:
  - 말풍선 그림자 제거 및 둥글기 축소. 컴포저 인풋 박스의 pill 디자인을 플랫 보더 직사각형으로 변경.
- 거래 및 결제:
  - 타임라인 연결선 및 dot 인디케이터를 사각형 플랫 디자인으로 변경하여 고정된 느낌의 단단한 stepper로 개선.
- 관리자 화면:
  - 메트릭 카드 및 큰 로고 등의 브랜드 감성을 억제하고 블루/그레이 테마(`--market-orange`를 `--river`로 바인딩)로 분리 적용.
  - 리스트 행 패딩 조율 및 dense table/detail split 구조(좌측 dense 리스트, 우측 디테일 카드)를 고밀도로 보완.
  - 타임라인 형태의 로그 뷰를 심플한 audit log list 형태로 전환.
