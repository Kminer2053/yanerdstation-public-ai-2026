# 서울역 구역 조명 / 움직이는 플랫폼111 — 2026-09-29

## 반영 범위

- 서비스만 변경. 공개 편집기(toolkit), 서울역 확정 데이터와 심사 잠금은 변경하지 않는다.
- 2층의 3층 바닥 아래 구역에 사각 LED 천장을 표시한다. 3층 바닥 메시의 구멍·외곽을 보존하여 열린 공간까지 덮지 않는다.
- 그 밖의 2층 바닥 구역은 자연채광이 드는 높은 **실내**로 분류한다. 시간에 따라 밝기와 노을 기운이 변하되 야외로 취급하지 않는다.
- 천장은 보행 높이에서만 보인다. 전층·위에서 보는 분석 화면에는 표시하지 않아 지도를 가리지 않는다.
- 플랫폼111 광고 면: 파스텔 도시 파노라마의 24초 무음 반복 영상, 완만한 줌·이동·반사 효과. 긴 면의 영상 비율을 유지하고 경계는 반전 반복으로 연결한다.
- 열차안내 면: 기존 사진의 시각·열차정보·카드·좌표를 그대로 보존한다. 가장자리와 하단 리본에만 은은한 빛의 이동을 반복한다. 실시간 열차정보가 아니다.

## 근거와 한계

3층 바닥의 수평 삼각형 137개, 2층 바닥의 수평 삼각형 457개를 기존 로컬 지도 메시에서 추출했다. 구역 경계는 지도 기반이며 LED 크기 0.66m, 간격 3.6m, 천장 내림 1.4m와 조도는 현장 사진을 참고한 시각화 가정이다. 실측 조명 설계 또는 광학 시뮬레이션이 아니다. 기존 지도 메시·통행 격자·층간연결은 수정하지 않는다.

광고 참고: <https://www.instagram.com/reels/DNddZgpBSh2/>

사용자가 승인한 “참고 영상과 유사한 시연용 재현”에 따라 원본 광고를 추출·복제하지 않았다. imagegen으로 새로운 파스텔 미니어처 도시 이미지를 만들고 이를 경량 반복 영상으로 가공했다. 실제 광고의 모든 물체가 개별적으로 움직이는 동일 영상은 아니다. 서비스의 `자료·추정 기준`에 이 한계를 명시한다.

생성 원본: `outputs/platform111_20260929/pastel-city-panorama.png` (상위 작업 폴더, 2172×724).

### 이미지 생성 프롬프트

```text
Use case: stylized-concept
Asset type: original continuous panorama artwork for an ultra-wide 99-meter LED media installation; the artwork itself, not a photograph of a screen.
Primary request: Create ONE joyful premium pastel miniature city panorama, landscape 3:1 framing, approximately 3072 by 1024 pixels. A finely detailed, softly rendered 3D city diorama with a continuous wide row of small modern and traditional buildings, pastel apartment blocks, elegant small glass towers, little tiled roofs and lush pink-lilac flowering trees.
Scene/backdrop: vivid blue-to-violet sky with a few fluffy lavender and pink floating clouds; shallow sky above a city that spreads across the entire width. City architecture and flowering trees are the main image content.
Style/medium: sophisticated Blender-style miniature 3D advertising render, clean detailed geometry, subtle clay-like pastel surfaces mixed with luminous glass, rounded soft forms, crisp architectural details, polished soft global illumination.
Composition/framing: direct frontal flat presentation of the content, wide panoramic elevation with only gentle diorama depth. The viewer looks straight at the city content. Spread buildings and flowering trees evenly across all three thirds. All building bases fully visible with a slim ground margin; no buildings cropped at the bottom. No single central hero structure. Avoid a center-heavy skyline. Keep the left and right edges similar in density, ground height, sky color and lighting, so horizontal repetition feels natural. Continuous city extending beyond both horizontal edges; no empty side borders.
Lighting/mood: bright, dreamy, happy, premium, gentle sunny illumination and soft pastel shadows.
Color palette: vivid blue and violet sky; blush pink and lilac trees; cream, mint, peach, baby blue and soft lavender buildings, attractive restrained highlights.
Constraints: original new artwork inspired by the general miniature-city aesthetic, not an exact reconstruction of any existing advertisement. Exactly one image. Full-bleed landscape panorama, no page layout or panels. No people or crowds, no railway station, no physical LED screen or display frame, no perspective photograph of a screen, no text, no typography, no logos, no watermarks.
```

## 성능 및 접근성

- 조명은 천장 메시 1개와 깊이 기반 후처리 1개. 대량의 동적 광원·그림자는 사용하지 않는다.
- 2층/3층 전광판이 비디오 디코더 하나를 공유한다.
- 1920×640, 24fps, 24초. WebM 약 2.02MB 또는 MP4 약 4.44MB 중 지원 형식 하나만 요청한다.
- 화면 밖·다른 층·백그라운드에서는 재생 중지. 처음에는 포스터만 표시하고 근처에서 지연 로딩한다.
- 동작 줄이기/데이터 절약 설정은 정지 이미지. 재생 실패 시에도 정지 이미지 유지.
- 모든 리스너·타이머·비디오·Cesium 객체는 종료 시 해제한다.

## 검증

- `node tools/test-lighting-platform111.mjs`: 구역 분류, 메시 수, 높이, 낮/밤, 원래 열차안내 사진 좌표 보존, 미디어 파일, 공유 디코더·숨김·동작 줄이기·해제 검사 통과.
- `npm run test:experience`: 데이터 및 심사 잠금, 경로, 카메라 등 기존 회귀 검사 통과.
- `npm run test:release-routing-rendering`: 방향 연결·기존 파사드 렌더링 계약 검사 통과.
- `npm run build`, `git diff --check`: 통과. 기존 큰 JS 청크 경고는 유지.
- 로컬 실제 WebGL 화면에서 LED 천장, 전광판 표시, 영상 재생 확인. 셰이더의 예약어 문제를 수정한 후 새 렌더링 오류 없음.
- 390×844 모바일 뷰포트에서 지도와 영상 재생 확인. 실물 Android/iPhone 발열·프레임 속도·Safari 자동재생은 이번 검증 범위 밖.

## 재생성 및 배포

- `node tools/build-lighting-zones.mjs`: 기존 로컬 캐시가 있는 작업 환경에서 구역 재추출.
- `node tools/build-platform111-film.mjs <생성 이미지 절대경로>`: sharp/ffmpeg로 포스터·MP4·WebM 생성.
- 서비스 GitHub에 변경 파일만 반영한 뒤 기존 Sites 공식 workflow로 빌드·패키징·save/deploy. sites 원격으로 직접 push하지 않는다.
- 기존 영업정보, 파사드 원본, 카탈로그 revision과 공개 편집기 설정은 변경하지 않는다.
