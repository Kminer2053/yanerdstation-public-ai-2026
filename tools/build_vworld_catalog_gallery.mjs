import fs from "node:fs";
import path from "node:path";

const [catalogPath, outputPath] = process.argv.slice(2);
if (!catalogPath || !outputPath) {
  console.error("usage: node build_vworld_catalog_gallery.mjs <image-catalog.json> <catalog.html>");
  process.exit(2);
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const relativeRootPath = path.relative(path.dirname(outputPath), path.dirname(catalogPath)).replaceAll("\\", "/");
const relativeRoot = relativeRootPath || ".";
for (const row of catalog) {
  row.asset_url = `${relativeRoot}/${row.asset_path}`.replace(/^\.\//, "");
  row.preview_url = `${relativeRoot}/${row.preview_path}`.replace(/^\.\//, "");
}

const manifest = JSON.parse(fs.readFileSync(path.join(path.dirname(catalogPath), "manifest.json"), "utf8"));
const featureCatalog = JSON.parse(fs.readFileSync(path.join(path.dirname(catalogPath), "feature-catalog.json"), "utf8"));
const data = JSON.stringify(catalog).replaceAll("</script>", "<\\/script>");
const meta = JSON.stringify(manifest).replaceAll("</script>", "<\\/script>");
const featureData = JSON.stringify(featureCatalog).replaceAll("</script>", "<\\/script>");
const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="VWorld 서울역 실내 3D의 이미지 원본을 위치별로 확인하고 같은 규격의 최신 이미지로 교체 등록하는 작업대">
  <title>VWorld 서울역 이미지 교체 작업대</title>
  <link rel="stylesheet" href="./catalog-workbench.css">
</head>
<body>
  <header class="topbar">
    <div class="heading-row">
      <div>
        <span class="eyebrow">S202103 · IMAGE REPLACEMENT WORKBENCH</span>
        <h1>VWorld 서울역 이미지 교체 작업대</h1>
        <p>타일이 아닌 <b>고유 이미지 1개</b>를 기준으로, 실제 지도 위치를 확인하고 같은 픽셀 규격의 최신 이미지를 등록합니다.</p>
      </div>
      <a class="app-link" href="../../app/" target="_blank" rel="noreferrer">STATION ONE 열기 ↗</a>
    </div>
    <div class="stats" id="stats" aria-live="polite"></div>
    <div class="controls">
      <label class="search-control"><span>검색</span><input id="search" type="search" placeholder="OCR·매장명·모델명·TD_ID"></label>
      <label><span>층</span><select id="floor"></select></label>
      <label><span>분류</span><select id="klass"></select></label>
      <label><span>교체 우선순위</span><select id="priority"></select></label>
      <label><span>작업 상태</span><select id="replacement-status"><option value="">전체</option><option value="pending">미등록</option><option value="saved">교체 등록됨</option></select></label>
      <label><span>정렬</span><select id="sort"><option value="near">층·근접 위치순</option><option value="priority">우선순위순</option><option value="name">이름순</option></select></label>
      <label class="check-control"><input id="placeholder" type="checkbox" checked><span>1×1 제외</span></label>
      <div class="view-switch" role="group" aria-label="보기 방식"><button id="galleryBtn" class="active" type="button">이미지 목록</button><button id="mapBtn" type="button">공간 분포</button></div>
    </div>
  </header>

  <main>
    <section class="workflow-note">
      <strong>현장 갱신 순서</strong>
      <ol><li>이미지를 눌러 VWorld 실제 표현 확인</li><li>현장에서 같은 정면 구도로 촬영</li><li>원본과 동일한 픽셀 규격으로 편집</li><li>교체 등록 후 버전 이력 확인</li></ol>
      <span>원본 B3DM은 보존되며, 이 화면에서는 교체 파일과 메타데이터만 별도 저장합니다.</span>
    </section>
    <section id="gallery" aria-label="이미지 단위 목록"></section>
    <section id="mapView" aria-label="이미지 공간 분포">
      <div id="mapPanel"><span class="axis north">북 ↑</span><span class="axis east">동 →</span></div>
      <aside id="mapDetail" class="map-detail"><div class="empty">점을 선택하면 이미지 원본과 사용 위치가 표시됩니다.</div></aside>
    </section>
  </main>

  <dialog id="originalDialog" class="work-dialog">
    <form method="dialog"><button class="dialog-close" aria-label="닫기">×</button></form>
    <div id="originalContent"></div>
  </dialog>

  <dialog id="replaceDialog" class="work-dialog replace-dialog">
    <form method="dialog"><button class="dialog-close" aria-label="닫기">×</button></form>
    <div class="dialog-heading"><span class="eyebrow">VERSIONED REPLACEMENT</span><h2>교체 이미지 등록</h2><p>원본 규격과 정확히 일치할 때만 저장할 수 있습니다.</p></div>
    <div class="compare-grid">
      <section><span class="panel-label">현재 원본</span><div class="compare-image"><img id="replaceOriginal" alt="현재 원본"></div><strong id="replaceOriginalSpec"></strong></section>
      <section><span class="panel-label">새 이미지</span><label class="file-drop" for="replacementFile"><input id="replacementFile" type="file" accept="image/png,image/jpeg,image/webp"><span>PNG·JPEG·WebP 선택</span><small>동일한 픽셀 크기만 등록 가능</small></label><div class="compare-image replacement-preview"><img id="replacementPreview" alt="선택한 교체 이미지"><span id="replacementEmpty">선택한 이미지가 여기에 표시됩니다.</span></div><strong id="replacementSpec">파일을 선택하세요.</strong></section>
    </div>
    <div class="replacement-fields">
      <label><span>최신 매장·시설명</span><input id="replacementStore" maxlength="120" placeholder="예: 서울돈까스 서울역점"></label>
      <label><span>작업 메모</span><textarea id="replacementNote" maxlength="600" placeholder="촬영일, 파사드 방향, 확인자 등을 기록하세요."></textarea></label>
    </div>
    <div id="replacementMessage" class="validation-message" aria-live="polite"></div>
    <div class="dialog-actions"><button id="saveReplacement" class="primary-action" type="button" disabled>교체 버전 저장</button><button type="button" data-close-dialog="replaceDialog">취소</button></div>
  </dialog>

  <div id="toast" class="toast" role="status" aria-live="polite"></div>
  <script id="catalogData" type="application/json">${data}</script>
  <script id="featureData" type="application/json">${featureData}</script>
  <script id="manifestData" type="application/json">${meta}</script>
  <script src="./catalog-workbench.js"></script>
</body>
</html>`;

fs.writeFileSync(outputPath, html);
console.log(JSON.stringify({ output: outputPath, rows: catalog.length, bytes: Buffer.byteLength(html) }));
