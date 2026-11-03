import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "outputs/20260814_station_feasibility";
const previewDir = `${outputDir}/previews`;
await fs.mkdir(previewDir, { recursive: true });

const wb = Workbook.create();
const sheets = [
  "00_요청요약",
  "01_회사개요",
  "02_점포마스터",
  "03_월별매출",
  "04_임대계약",
  "05_운영KPI",
  "06_데이터목록",
  "99_코드표",
];
for (const name of sheets) wb.worksheets.add(name);

const navy = "#071829";
const blue = "#0B63F6";
const cyan = "#00B8D9";
const orange = "#FF8A00";
const green = "#0E9F6E";
const red = "#D92D20";
const paleBlue = "#EAF2FF";
const paleOrange = "#FFF3E0";
const paleGreen = "#E8F7F1";
const line = "#D0D5DD";
const gray = "#667085";
const white = "#FFFFFF";

function setTitle(sheet, title, subtitle, endCol = "K") {
  sheet.showGridLines = false;
  sheet.mergeCells(`A1:${endCol}1`);
  sheet.getRange("A1").values = [[title]];
  sheet.getRange(`A1:${endCol}1`).format = {
    fill: navy,
    font: { bold: true, color: white, size: 18 },
    rowHeight: 34,
    verticalAlignment: "center",
  };
  sheet.mergeCells(`A2:${endCol}2`);
  sheet.getRange("A2").values = [[subtitle]];
  sheet.getRange(`A2:${endCol}2`).format = {
    fill: "#102A43",
    font: { color: "#DCEBFA", size: 10 },
    rowHeight: 26,
    verticalAlignment: "center",
    wrapText: true,
  };
}

function styleHeader(sheet, range) {
  sheet.getRange(range).format = {
    fill: blue,
    font: { bold: true, color: white },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
    borders: { preset: "all", style: "thin", color: line },
    rowHeight: 32,
  };
}

function styleBody(sheet, range) {
  sheet.getRange(range).format = {
    borders: { preset: "all", style: "thin", color: line },
    verticalAlignment: "center",
    wrapText: true,
    rowHeight: 24,
  };
}

function addInputNote(sheet, cell, text) {
  sheet.getRange(cell).values = [[text]];
  sheet.getRange(cell).format = { fill: paleOrange, font: { color: "#7A2E0E", italic: true }, wrapText: true };
}

const summary = wb.worksheets.getItem("00_요청요약");
setTitle(summary, "서울역 디지털트윈 — 사내자료 요청 패키지", "경진대회 마감 2026-09-18 23:59 · 1차 회수 권장일 2026-08-21 · 원본 대신 비식별 집계자료를 우선 제출", "K");
summary.getRange("A4:H4").values = [["필수 요청", null, "수급 가능(Y)", null, "완료", null, "준비율", null]];
summary.getRange("A4:H4").format = { fill: "#F2F4F7", font: { bold: true, color: gray }, horizontalAlignment: "center", borders: { preset: "all", style: "thin", color: line } };
summary.mergeCells("A5:B6"); summary.mergeCells("C5:D6"); summary.mergeCells("E5:F6"); summary.mergeCells("G5:H6");
summary.getRange("A5").formulas = [["=COUNTIF(C9:C17,\"필수\")"]];
summary.getRange("C5").formulas = [["=COUNTIF(G9:G17,\"Y\")"]];
summary.getRange("E5").formulas = [["=COUNTIF(H9:H17,\"완료\")"]];
summary.getRange("G5").formulas = [["=IFERROR(E5/A5,0)"]];
summary.getRange("A5:H6").format = { fill: white, font: { bold: true, color: navy, size: 20 }, horizontalAlignment: "center", verticalAlignment: "center", borders: { preset: "all", style: "thin", color: line } };
summary.getRange("G5").format.numberFormat = "0%";
summary.getRange("A8:K8").values = [["No", "데이터셋", "우선순위", "사용 목적", "최소 요청 범위", "담당부서/담당자", "수급가능", "진행상태", "공개등급", "회수희망일", "제공파일명"]];
styleHeader(summary, "A8:K8");
summary.getRange("A9:K18").values = [
  [1, "회사 매출·손익 요약", "필수", "사업성·투자효과", "2023~2025 연간 + 2026 YTD", "재무/경영기획", "", "미착수", "C", new Date("2026-08-21"), ""],
  [2, "서울역 점포 마스터", "필수", "3D 공간 매핑", "현재 영업점 전체", "사업운영/임대", "", "미착수", "B", new Date("2026-08-21"), ""],
  [3, "점포별 월매출", "필수", "상권·매출 분석", "최근 24~36개월", "재무/영업", "", "미착수", "C", new Date("2026-08-21"), ""],
  [4, "임대·수수료 계약 요약", "권장", "수익성·공실 시뮬레이션", "현행 계약, 금액은 구간화 가능", "임대/법무", "", "미착수", "C", new Date("2026-08-26"), ""],
  [5, "역사 운영 KPI", "필수", "정량 기대효과", "최근 12~24개월 월별", "역무/시설/안전", "", "미착수", "C", new Date("2026-08-21"), ""],
  [6, "유동·혼잡 집계", "필수", "동선·혼잡 시각화", "시간대×구역, 개인식별 제외", "데이터/보안", "", "미착수", "B", new Date("2026-08-21"), ""],
  [7, "시설·장애·작업오더", "권장", "예지·대응시간 개선", "최근 12개월 집계", "시설관리", "", "미착수", "C", new Date("2026-08-26"), ""],
  [8, "에너지 사용량", "선택", "ESG·비용절감", "월별 또는 계량기별", "시설/ESG", "", "미착수", "B", new Date("2026-08-26"), ""],
  [9, "보유 데이터·시스템 목록", "필수", "연계 실현가능성", "원본 불필요, 메타정보만", "IT/데이터", "", "미착수", "B", new Date("2026-08-21"), ""],
  [null, null, null, null, null, null, null, null, null, null, null],
];
styleBody(summary, "A9:K18");
summary.getRange("G9:G18").dataValidation = { rule: { type: "list", values: ["Y", "N", "협의필요"] } };
summary.getRange("H9:H18").dataValidation = { rule: { type: "list", values: ["미착수", "확인중", "추출중", "완료", "제외"] } };
summary.getRange("I9:I18").dataValidation = { rule: { type: "list", values: ["A", "B", "C", "D"] } };
summary.getRange("J9:J18").format.numberFormat = "yyyy-mm-dd";
summary.getRange("H9:H18").conditionalFormats.add("containsText", { text: "완료", format: { fill: paleGreen, font: { color: green, bold: true } } });
summary.getRange("H9:H18").conditionalFormats.add("containsText", { text: "미착수", format: { fill: "#FEE4E2", font: { color: red } } });
summary.getRange("A20:K20").merge();
addInputNote(summary, "A20", "제출 원칙: CSV(UTF-8) 또는 XLSX · 한 행=한 점포/한 기간 · 병합셀 금지 · 날짜 YYYY-MM-DD · 금액 KRW 정수 · 사람/카드/기기 식별자는 해시 또는 삭제 · CCTV 원본은 요청하지 않음");
summary.getRange("A22:K26").values = [
  ["공개등급", "의미", null, null, null, null, null, null, null, null, null],
  ["A", "공개 가능 — 공모전 신청서·발표·데모에 수치 그대로 사용", null, null, null, null, null, null, null, null, null],
  ["B", "집계 공개 — 금액·점포명을 구간/지수/카테고리로 변환 후 사용", null, null, null, null, null, null, null, null, null],
  ["C", "사내용 — ROI 산정에만 사용하고 외부자료에는 범위·비율만 표기", null, null, null, null, null, null, null, null, null],
  ["D", "제공 불가 — 존재 여부·담당부서만 기록", null, null, null, null, null, null, null, null, null],
];
for (let r = 22; r <= 26; r++) summary.mergeCells(`B${r}:K${r}`);
summary.getRange("A22:K22").format = { fill: navy, font: { bold: true, color: white }, borders: { preset: "all", style: "thin", color: line } };
styleBody(summary, "A23:K26");
summary.freezePanes.freezeRows(8);
summary.getRange("A:K").format.columnWidth = 14;
summary.getRange("B:B").format.columnWidth = 24;
summary.getRange("D:F").format.columnWidth = 22;
summary.getRange("K:K").format.columnWidth = 22;

const company = wb.worksheets.getItem("01_회사개요");
setTitle(company, "01 · 회사개요 및 재무요약", "연결/별도, 감사/가결산 여부를 구분해 주세요. 외부 공개가 어려우면 value 대신 index_value(2023=100)를 제공해도 됩니다.", "J");
company.getRange("A4:J4").values = [["company_id", "company_name", "period", "metric_code", "metric_name", "value", "unit", "scope", "audit_status", "source_document"]];
styleHeader(company, "A4:J4");
company.getRange("A5:J15").values = [
  ["C001", "예시회사", "2025", "revenue", "매출액", 125000000000, "KRW", "연결", "감사완료", "2025 사업보고서"],
  ["C001", "예시회사", "2025", "operating_profit", "영업이익", 8500000000, "KRW", "연결", "감사완료", "2025 사업보고서"],
  ["C001", "예시회사", "2025", "employees", "임직원수", 320, "명", "연결", "연말", "인사자료"],
  ...Array.from({ length: 8 }, () => Array(10).fill(null)),
];
styleBody(company, "A5:J15");
company.getRange("F5:F15").format.numberFormat = "#,##0";
company.getRange("H5:H15").dataValidation = { rule: { type: "list", values: ["연결", "별도", "서울역사업", "기타"] } };
company.getRange("I5:I15").dataValidation = { rule: { type: "list", values: ["감사완료", "가결산", "내부관리", "추정"] } };
company.freezePanes.freezeRows(4);
company.getRange("A:J").format.columnWidth = 16;
company.getRange("B:B").format.columnWidth = 22;
company.getRange("E:E").format.columnWidth = 20;
company.getRange("J:J").format.columnWidth = 24;

const stores = wb.worksheets.getItem("02_점포마스터");
setTitle(stores, "02 · 서울역 점포 마스터", "점포명 공개가 어려우면 store_id와 업종만 유지하세요. floor_code는 VWorld 층 표기(B7/B6/B3/B2/B1/1F/2F/3F/4F/RF)와 맞춥니다.", "N");
stores.getRange("A4:N4").values = [["station_code", "floor_code", "zone_id", "store_id", "store_name", "category_l1", "category_l2", "area_sqm", "open_date", "close_date", "business_status", "x_or_lon", "y_or_lat", "public_level"]];
styleHeader(stores, "A4:N4");
stores.getRange("A5:N20").values = [
  ["SEOUL_KTX", "2F", "Z-2F-01", "S-0001", "예시카페", "식음", "카페", 82.5, new Date("2023-05-01"), null, "영업중", null, null, "B"],
  ...Array.from({ length: 15 }, () => Array(14).fill(null)),
];
styleBody(stores, "A5:N20");
stores.getRange("B5:B20").dataValidation = { rule: { type: "list", values: ["B7", "B6", "B3", "B2", "B1", "1F", "2F", "3F", "4F", "RF"] } };
stores.getRange("K5:K20").dataValidation = { rule: { type: "list", values: ["영업중", "휴점", "폐점", "공실", "준비중"] } };
stores.getRange("N5:N20").dataValidation = { rule: { type: "list", values: ["A", "B", "C", "D"] } };
stores.getRange("H5:H20").format.numberFormat = "0.0";
stores.getRange("I5:J20").format.numberFormat = "yyyy-mm-dd";
stores.freezePanes.freezeRows(4);
stores.getRange("A:N").format.columnWidth = 14;
stores.getRange("E:G").format.columnWidth = 20;

const sales = wb.worksheets.getItem("03_월별매출");
setTitle(sales, "03 · 점포별 월매출", "가장 중요한 시트입니다. 금액 원본이 곤란하면 2023-01=100 매출지수와 전년동월증감률을 제공해 주세요.", "M");
sales.getRange("A4:M4").values = [["year_month", "station_code", "floor_code", "zone_id", "store_id", "gross_sales_krw", "sales_index", "transactions", "avg_ticket_krw", "open_days", "rent_krw", "opex_krw", "public_level"]];
styleHeader(sales, "A4:M4");
sales.getRange("A5:M30").values = [
  ["2025-01", "SEOUL_KTX", "2F", "Z-2F-01", "S-0001", 98000000, 112.4, 12450, 7871, 31, 14500000, 6200000, "C"],
  ...Array.from({ length: 25 }, () => Array(13).fill(null)),
];
styleBody(sales, "A5:M30");
sales.getRange("F5:F30").format.numberFormat = "#,##0";
sales.getRange("G5:G30").format.numberFormat = "0.0";
sales.getRange("H5:L30").format.numberFormat = "#,##0";
sales.getRange("C5:C30").dataValidation = { rule: { type: "list", values: ["B7", "B6", "B3", "B2", "B1", "1F", "2F", "3F", "4F", "RF"] } };
sales.getRange("M5:M30").dataValidation = { rule: { type: "list", values: ["A", "B", "C", "D"] } };
sales.freezePanes.freezeRows(4);
sales.getRange("A:M").format.columnWidth = 15;

const lease = wb.worksheets.getItem("04_임대계약");
setTitle(lease, "04 · 임대·수수료 계약 요약", "계약서 원문은 불필요합니다. 점포별 계약유형과 금액·요율·기간만, 필요 시 금액을 구간화해 주세요.", "M");
lease.getRange("A4:M4").values = [["store_id", "contract_type", "start_date", "end_date", "fixed_rent_krw", "revenue_share_pct", "deposit_krw", "common_fee_krw", "renewal_option", "vacancy_days", "termination_reason", "public_level", "note"]];
styleHeader(lease, "A4:M4");
lease.getRange("A5:M20").values = [
  ["S-0001", "고정+수수료", new Date("2023-05-01"), new Date("2028-04-30"), 14500000, 0.05, 50000000, 1800000, "Y", 0, null, "C", "예시행 삭제 후 입력"],
  ...Array.from({ length: 15 }, () => Array(13).fill(null)),
];
styleBody(lease, "A5:M20");
lease.getRange("B5:B20").dataValidation = { rule: { type: "list", values: ["고정", "매출연동", "고정+수수료", "직영", "기타"] } };
lease.getRange("C5:D20").format.numberFormat = "yyyy-mm-dd";
lease.getRange("E5:E20").format.numberFormat = "#,##0";
lease.getRange("F5:F20").format.numberFormat = "0.0%";
lease.getRange("G5:H20").format.numberFormat = "#,##0";
lease.getRange("L5:L20").dataValidation = { rule: { type: "list", values: ["A", "B", "C", "D"] } };
lease.freezePanes.freezeRows(4);
lease.getRange("A:M").format.columnWidth = 16;
lease.getRange("K:M").format.columnWidth = 22;

const ops = wb.worksheets.getItem("05_운영KPI");
setTitle(ops, "05 · 운영 KPI 및 기준선", "개인 단위 원천데이터 없이 월·일·시간대×구역 집계값만 요청합니다. 2차 발표의 현실성·효과성 점수를 만드는 근거입니다.", "L");
ops.getRange("A4:L4").values = [["period", "station_code", "floor_code", "zone_id", "kpi_code", "kpi_name", "value", "unit", "aggregation", "source_system", "public_level", "quality_note"]];
styleHeader(ops, "A4:L4");
ops.getRange("A5:L24").values = [
  ["2025-01", "SEOUL_KTX", "2F", "Z-2F-01", "footfall", "유동인구", 1250000, "명", "월합계", "카운터/추정", "B", "개인식별 없음"],
  ["2025-01", "SEOUL_KTX", "2F", "Z-2F-01", "incident_response_min", "사고 평균대응시간", 8.5, "분", "월평균", "안전관리", "C", "중대사고 제외"],
  ["2025-01", "SEOUL_KTX", "2F", "Z-2F-01", "energy_kwh", "에너지 사용량", 420000, "kWh", "월합계", "BEMS", "B", ""],
  ...Array.from({ length: 17 }, () => Array(12).fill(null)),
];
styleBody(ops, "A5:L24");
ops.getRange("G5:G24").format.numberFormat = "#,##0.0";
ops.getRange("K5:K24").dataValidation = { rule: { type: "list", values: ["A", "B", "C", "D"] } };
ops.freezePanes.freezeRows(4);
ops.getRange("A:L").format.columnWidth = 15;
ops.getRange("F:F").format.columnWidth = 23;
ops.getRange("J:L").format.columnWidth = 22;

const inventory = wb.worksheets.getItem("06_데이터목록");
setTitle(inventory, "06 · 보유 데이터·시스템 목록", "원본을 주지 않아도 됩니다. 무엇이 어디에 있고 어떤 주기로 추출 가능한지만 적으면 연계 아키텍처와 비용을 산정할 수 있습니다.", "N");
inventory.getRange("A4:N4").values = [["dataset_id", "dataset_name", "business_owner", "system_name", "record_unit", "time_granularity", "history_from", "refresh_cycle", "export_format", "sample_available", "personal_data", "rights_owner", "public_level", "access_note"]];
styleHeader(inventory, "A4:N4");
inventory.getRange("A5:N22").values = [
  ["D-001", "점포 월매출", "재무팀", "ERP", "점포×월", "월", "2023-01", "월", "CSV", "Y", "N", "자사", "C", "승인 후 추출"],
  ["D-002", "구역별 유동량", "데이터팀", "영상분석", "구역×10분", "10분", "2025-01", "10분", "CSV/API", "Y", "집계만", "운영기관", "B", "영상 원본 제외"],
  ...Array.from({ length: 16 }, () => Array(14).fill(null)),
];
styleBody(inventory, "A5:N22");
inventory.getRange("J5:J22").dataValidation = { rule: { type: "list", values: ["Y", "N", "협의필요"] } };
inventory.getRange("K5:K22").dataValidation = { rule: { type: "list", values: ["N", "집계만", "가명", "개인정보 포함"] } };
inventory.getRange("M5:M22").dataValidation = { rule: { type: "list", values: ["A", "B", "C", "D"] } };
inventory.getRange("K5:K22").conditionalFormats.add("containsText", { text: "개인정보 포함", format: { fill: "#FEE4E2", font: { color: red, bold: true } } });
inventory.freezePanes.freezeRows(4);
inventory.getRange("A:N").format.columnWidth = 16;
inventory.getRange("B:D").format.columnWidth = 21;
inventory.getRange("N:N").format.columnWidth = 24;

const codes = wb.worksheets.getItem("99_코드표");
setTitle(codes, "99 · 코드표와 제출 규칙", "표준 코드를 그대로 쓰면 VWorld 층·점포·매출·KPI를 연결하는 시간이 크게 줄어듭니다.", "H");
codes.getRange("A4:H4").values = [["구분", "코드", "값/설명", "예시", "필수여부", "데이터형", "공개 권장", "비고"]];
styleHeader(codes, "A4:H4");
codes.getRange("A5:H20").values = [
  ["station_code", "SEOUL_KTX", "서울역 KTX", "SEOUL_KTX", "필수", "text", "A", "고정"],
  ["floor_code", "B7/B6/B3/B2/B1/1F/2F/3F/4F/RF", "VWorld 층 코드", "2F", "필수", "text", "A", "표기 일치"],
  ["public_level", "A", "외부 공개 가능", "A", "필수", "text", "A", "그대로 공개"],
  ["public_level", "B", "집계·지수화 후 공개", "B", "필수", "text", "A", "공모전 권장"],
  ["public_level", "C", "사내용", "C", "필수", "text", "A", "외부 수치 비공개"],
  ["public_level", "D", "제공 불가", "D", "필수", "text", "A", "존재만 기록"],
  ["date", "YYYY-MM-DD", "날짜", "2026-08-14", "필수", "date", "A", "시간대 포함 시 ISO-8601"],
  ["year_month", "YYYY-MM", "월", "2026-08", "필수", "text", "A", ""],
  ["money", "KRW", "원 단위 정수", "125000000", "권장", "integer", "B/C", "부가세 기준 명시"],
  ["ratio", "decimal", "0~1 사이", "0.052", "권장", "decimal", "B", "5.2%=0.052"],
  ["identifier", "hashed_id", "직원·고객·카드번호 삭제 또는 해시", "P-8F31...", "해당시", "text", "D", "직접식별자 금지"],
  ["CCTV", "derived_only", "원본 영상 대신 구역별 인원·체류·이벤트 집계", "Z-2F-01, 82명", "필수", "aggregate", "B", "원본 미요청"],
  ...Array.from({ length: 4 }, () => Array(8).fill(null)),
];
styleBody(codes, "A5:H20");
codes.getRange("A:H").format.columnWidth = 18;
codes.getRange("C:C").format.columnWidth = 30;
codes.getRange("H:H").format.columnWidth = 24;
codes.freezePanes.freezeRows(4);

for (const sheet of [company, stores, sales, lease, ops, inventory, codes]) {
  const used = sheet.getUsedRange();
  used.format.autofitRows();
}

const inspection = await wb.inspect({ kind: "sheet", include: "id,name", maxChars: 4000 });
await fs.writeFile(`${outputDir}/inspection_sheets.ndjson`, inspection.ndjson || String(inspection));

const formulas = await wb.inspect({ kind: "formula", sheetId: "00_요청요약", range: "A1:K30", maxChars: 6000, options: { maxResults: 100 } });
await fs.writeFile(`${outputDir}/inspection_formulas.ndjson`, formulas.ndjson || String(formulas));

for (const name of sheets) {
  const png = await wb.render({ sheetName: name, autoCrop: "all", scale: 0.85, format: "png" });
  await fs.writeFile(`${previewDir}/${name}.png`, new Uint8Array(await png.arrayBuffer()));
}

const xlsx = await SpreadsheetFile.exportXlsx(wb);
await xlsx.save(`${outputDir}/서울역_디지털트윈_사내자료_요청양식.xlsx`);

console.log(JSON.stringify({
  workbook: `${outputDir}/서울역_디지털트윈_사내자료_요청양식.xlsx`,
  previews: sheets.map((name) => `${previewDir}/${name}.png`),
  sheets,
}, null, 2));
