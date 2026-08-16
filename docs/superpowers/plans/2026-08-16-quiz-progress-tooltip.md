# Quiz Progress Tooltip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiển thị số câu và trạng thái khi người dùng rê chuột hoặc focus vào mọi nốt trên thanh tiến trình đố vui.

**Architecture:** Giữ nguyên trang HTML tĩnh hiện tại. `buildProgress()` tạo nhãn trạng thái cho từng nốt và gắn nhãn vào `data-tooltip` cùng `aria-label`; CSS pseudo-element hiển thị nhãn mà không làm thay đổi bố cục.

**Tech Stack:** HTML, CSS, JavaScript thuần, Next.js static export, GitHub Pages.

## Global Constraints

- Không thay đổi dữ liệu câu hỏi, cách tính điểm hoặc các màn hình khác.
- Không thay đổi kích thước hay bố cục của thanh trạng thái.
- Nốt đã trả lời vẫn click được để mở chế độ xem lại.
- Không bổ sung test theo yêu cầu; chỉ rà soát mã và chạy hai lệnh build hiện có.

---

### Task 1: Thêm tooltip và nhãn hỗ trợ

**Files:**
- Modify: `public/do-vui-do-meo.html:143-150`
- Modify: `public/do-vui-do-meo.html:863-879`
- Include: `docs/superpowers/plans/2026-08-16-quiz-progress-tooltip.md`

**Interfaces:**
- Consumes: `results`, `current`, `viewState`, `openReview(index)` và phần tử `progressEl` hiện có.
- Produces: mỗi `.dot` có `data-tooltip`, `aria-label`; nốt đã trả lời có `tabIndex = 0` và xử lý phím Enter/Space.

- [ ] **Step 1: Thêm CSS tooltip**

Thêm vào nhóm CSS `.dot`:

```css
.dot{ position:relative; }
.dot::after{
  content:attr(data-tooltip);
  position:absolute;
  left:50%;
  bottom:calc(100% + 8px);
  transform:translateX(-50%) translateY(3px);
  background:var(--ink);
  color:#fff;
  padding:5px 8px;
  border-radius:8px;
  font:700 12px/1.2 'Nunito',sans-serif;
  white-space:nowrap;
  opacity:0;
  visibility:hidden;
  pointer-events:none;
  z-index:20;
  transition:opacity .15s ease, transform .15s ease, visibility .15s ease;
}
.dot:hover::after,
.dot:focus-visible::after{
  opacity:1;
  visibility:visible;
  transform:translateX(-50%) translateY(0);
}
.dot:focus-visible{ outline:2px solid var(--ink); outline-offset:3px; }
```

- [ ] **Step 2: Gắn nội dung tooltip cho mọi nốt**

Trong `buildProgress()`, sau khi áp dụng các class trạng thái, xác định nhãn:

```js
let status = 'Chưa trả lời';
if(results[i] === true) status = 'Đúng';
else if(results[i] === false) status = 'Sai';
else if(viewState === 'quiz' && i === current) status = 'Hiện tại';

const label = `Câu ${i + 1} — ${status}`;
d.dataset.tooltip = label;
d.setAttribute('aria-label', label);
```

- [ ] **Step 3: Giữ click xem lại và hỗ trợ bàn phím**

Thay `title` hiện có bằng focus và phím Enter/Space cho nốt đã trả lời:

```js
if(results[i] !== undefined){
  d.classList.add('clickable');
  d.tabIndex = 0;
  d.setAttribute('role', 'button');
  d.addEventListener('click', () => openReview(i));
  d.addEventListener('keydown', (event) => {
    if(event.key === 'Enter' || event.key === ' '){
      event.preventDefault();
      openReview(i);
    }
  });
}
```

- [ ] **Step 4: Rà soát thay đổi**

Run: `git diff --check`

Expected: thoát với mã 0 và không có lỗi khoảng trắng.

- [ ] **Step 5: Build local và GitHub Pages**

Run: `npm run build`

Expected: `Build complete.`

Run: `GITHUB_ACTIONS=true BASE_PATH=/SunShinSon NEXT_PUBLIC_QUIZ_PATH=/SunShinSon/do-vui-do-meo.html npm run build:pages`

Expected: `Compiled successfully` và các route được prerender tĩnh.

- [ ] **Step 6: Commit**

```bash
git add public/do-vui-do-meo.html docs/superpowers/plans/2026-08-16-quiz-progress-tooltip.md
git commit -m "Add quiz progress tooltips"
```

---

### Task 2: Phát hành GitHub Pages

**Files:**
- No file changes.

**Interfaces:**
- Consumes: commit hoàn chỉnh từ Task 1 và workflow `.github/workflows/deploy-pages.yml`.
- Produces: bản website công khai có tooltip trên thanh trạng thái.

- [ ] **Step 1: Push nhánh main**

Run: `git push origin main`

Expected: remote `main` cập nhật tới commit mới.

- [ ] **Step 2: Theo dõi workflow deploy**

Run:

```bash
QUIZ_TOOLTIP_RUN_ID=$(gh run list --workflow deploy-pages.yml --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$QUIZ_TOOLTIP_RUN_ID" --exit-status
```

Expected: cả job `build` và `deploy` đều kết thúc với trạng thái success.
