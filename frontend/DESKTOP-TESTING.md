# Desktop Browser Testing Checklist (KAN-145)

**Test Date:** [Date of testing]  
**Tester:** [Name]  
**Browsers Tested:** Chrome/Firefox  
**OS:** [Windows/Linux/macOS]

---

## Pages & Components to Test

### Dashboard (`/`)

**Item 1: Dashboard widgets arrange correctly (expected horizontal/column layout)**

| Zoom | Chrome 1024px | Chrome 1280px | Chrome 1440px | Chrome 1920px | Firefox 1024px | Firefox 1280px | Firefox 1440px | Firefox 1920px |
| ---- | ------------- | ------------- | ------------- | ------------- | -------------- | -------------- | -------------- | -------------- |
| 100% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |
| 125% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |
| 150% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |

**Item 2: Widgets do not overlap or clip**

| Zoom | Chrome 1024px | Chrome 1280px | Chrome 1440px | Chrome 1920px | Firefox 1024px | Firefox 1280px | Firefox 1440px | Firefox 1920px |
| ---- | ------------- | ------------- | ------------- | ------------- | -------------- | -------------- | -------------- | -------------- |
| 100% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |
| 125% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |
| 150% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |

**Item 3: No horizontal scrolling at any breakpoint**

| Zoom | Chrome 1024px | Chrome 1280px | Chrome 1440px | Chrome 1920px | Firefox 1024px | Firefox 1280px | Firefox 1440px | Firefox 1920px |
| ---- | ------------- | ------------- | ------------- | ------------- | -------------- | -------------- | -------------- | -------------- |
| 100% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [🟨]           |
| 125% | [✅]          | [✅]          | [✅]          | [❌]          | [✅]           | [🟨]           | [🟨]           | [🟨]           |
| 150% | [✅]          | [✅]          | [❌]          | [❌]          | [✅]           | [🟨]           | [🟨]           | [🟨]           |

"❌" the elements go off screen

"🟨" the elements here do not go off screen but a horizontal bar does appear!

i suspect it is just a developer tools issue and they are fine on those native resolutions(mine is 1920px and it dosent scroll horizontally when i zoom in and only starts breaking at 300% zoom)

https://drive.google.com/drive/folders/1uOAv5bMf3d8TDI_ffKzZr9bqCCDlkVpJ (screenshots)

**Item 4: Charts render without clipping**

| Zoom | Chrome 1024px | Chrome 1280px | Chrome 1440px | Chrome 1920px | Firefox 1024px | Firefox 1280px | Firefox 1440px | Firefox 1920px |
| ---- | ------------- | ------------- | ------------- | ------------- | -------------- | -------------- | -------------- | -------------- |
| 100% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |
| 125% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |
| 150% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |

note: "spending by category" dosen't clip but it shows a black box.
hovering on the right side shows some floating text: this only happens once every refresh it then appears when you hover on the left side https://drive.google.com/file/d/18B6UAo0FHID4Pyx4UaZ817zGXNeFFrGi/view?usp=drive_link

**Item 5: Hover and focus states visible on chart links and metric cards**

| Zoom | Chrome 1024px | Chrome 1280px | Chrome 1440px | Chrome 1920px | Firefox 1024px | Firefox 1280px | Firefox 1440px | Firefox 1920px |
| ---- | ------------- | ------------- | ------------- | ------------- | -------------- | -------------- | -------------- | -------------- |
| 100% | [🟨]          | [🟨]          | [🟨]          | [🟨]          | [🟨]           | [🟨]           | [🟨]           | [🟨]           |
| 125% | [🟨]          | [🟨]          | [🟨]          | [🟨]          | [🟨]           | [🟨]           | [🟨]           | [🟨]           |
| 150% | [🟨]          | [🟨]          | [🟨]          | [🟨]          | [🟨]           | [🟨]           | [🟨]           | [🟨]           |

"🟨" "spending by category" is a black box otherwise the rest are ok see screenshot above

---

### Transactions (`/transactions`)

**Item 1: Tables render correctly (no clipped cells)**

| Zoom | Chrome 1024px | Chrome 1280px | Chrome 1440px | Chrome 1920px | Firefox 1024px | Firefox 1280px | Firefox 1440px | Firefox 1920px |
| ---- | ------------- | ------------- | ------------- | ------------- | -------------- | -------------- | -------------- | -------------- |
| 100% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |
| 125% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |
| 150% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |

**Item 2: Large tables readable or support pagination**

| Zoom | Chrome 1024px | Chrome 1280px | Chrome 1440px | Chrome 1920px | Firefox 1024px | Firefox 1280px | Firefox 1440px | Firefox 1920px |
| ---- | ------------- | ------------- | ------------- | ------------- | -------------- | -------------- | -------------- | -------------- |
| 100% | [✅]          | [✅]          | [✅]          | [🟨]          | [✅]           | [✅]           | [✅]           | [✅]           |
| 125% | [✅]          | [🟨]          | [🟨]          | [🟨]          | [✅]           | [✅]           | [✅]           | [✅]           |
| 150% | [🟨]          | [🟨]          | [🟨]          | [🟨]          | [✅]           | [✅]           | [✅]           | [✅]           |

"🟨" i used Shaban's 6000 data set pagination works but you cant scroll down to click on the pages https://drive.google.com/file/d/1IehAcS8DaGvl8vDxQETrpkaczEthWFPg/view?usp=drive_link but i suspect it is just a developer tools issue and you can scroll fine on those native resolutions

**Item 3: No horizontal scrolling at any breakpoint**

| Zoom | Chrome 1024px | Chrome 1280px | Chrome 1440px | Chrome 1920px | Firefox 1024px | Firefox 1280px | Firefox 1440px | Firefox 1920px |
| ---- | ------------- | ------------- | ------------- | ------------- | -------------- | -------------- | -------------- | -------------- |
| 100% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [🟨]           |
| 125% | [✅]          | [✅]          | [✅]          | [❌]          | [✅]           | [🟨]           | [🟨]           | [🟨]           |
| 150% | [✅]          | [✅]          | [❌]          | [❌]          | [✅]           | [🟨]           | [🟨]           | [🟨]           |

"same story as dashboard"

**Item 4: Hover and focus states visible on table rows**

| Zoom | Chrome 1024px | Chrome 1280px | Chrome 1440px | Chrome 1920px | Firefox 1024px | Firefox 1280px | Firefox 1440px | Firefox 1920px |
| ---- | ------------- | ------------- | ------------- | ------------- | -------------- | -------------- | -------------- | -------------- |
| 100% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |
| 125% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |
| 150% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |

---

### Budgets (`/budgets`)

**Item 1: Widgets arrange correctly at all breakpoints**

| Zoom | Chrome 1024px | Chrome 1280px | Chrome 1440px | Chrome 1920px | Firefox 1024px | Firefox 1280px | Firefox 1440px | Firefox 1920px |
| ---- | ------------- | ------------- | ------------- | ------------- | -------------- | -------------- | -------------- | -------------- |
| 100% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |
| 125% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |
| 150% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |

**Item 2: No overlapping or clipping**

| Zoom | Chrome 1024px | Chrome 1280px | Chrome 1440px | Chrome 1920px | Firefox 1024px | Firefox 1280px | Firefox 1440px | Firefox 1920px |
| ---- | ------------- | ------------- | ------------- | ------------- | -------------- | -------------- | -------------- | -------------- |
| 100% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |
| 125% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |
| 150% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |

**Item 3: Modals/dialogs for create/edit center and scale correctly**

| Zoom | Chrome 1024px | Chrome 1280px | Chrome 1440px | Chrome 1920px | Firefox 1024px | Firefox 1280px | Firefox 1440px | Firefox 1920px |
| ---- | ------------- | ------------- | ------------- | ------------- | -------------- | -------------- | -------------- | -------------- |
| 100% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |
| 125% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |
| 150% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |

**Item 4: No overflow or hidden controls inside modals**

| Zoom | Chrome 1024px | Chrome 1280px | Chrome 1440px | Chrome 1920px | Firefox 1024px | Firefox 1280px | Firefox 1440px | Firefox 1920px |
| ---- | ------------- | ------------- | ------------- | ------------- | -------------- | -------------- | -------------- | -------------- |
| 100% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |
| 125% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |
| 150% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |

---

### Categories (`/categories`)

**Item 1: Widgets arrange correctly**

| Zoom | Chrome 1024px | Chrome 1280px | Chrome 1440px | Chrome 1920px | Firefox 1024px | Firefox 1280px | Firefox 1440px | Firefox 1920px |
| ---- | ------------- | ------------- | ------------- | ------------- | -------------- | -------------- | -------------- | -------------- |
| 100% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |
| 125% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |
| 150% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |

**Item 2: No horizontal scrolling**

| Zoom | Chrome 1024px | Chrome 1280px | Chrome 1440px | Chrome 1920px | Firefox 1024px | Firefox 1280px | Firefox 1440px | Firefox 1920px |
| ---- | ------------- | ------------- | ------------- | ------------- | -------------- | -------------- | -------------- | -------------- |
| 100% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [🟨]           |
| 125% | [✅]          | [✅]          | [✅]          | [❌]          | [✅]           | [🟨]           | [🟨]           | [🟨]           |
| 150% | [✅]          | [✅]          | [❌]          | [❌]          | [✅]           | [🟨]           | [🟨]           | [🟨]           |

## "same story as dashboard"

### Settings (`/settings`)

**Item 1: Form layout stable at all breakpoints and zoom levels**

| Zoom | Chrome 1024px | Chrome 1280px | Chrome 1440px | Chrome 1920px | Firefox 1024px | Firefox 1280px | Firefox 1440px | Firefox 1920px |
| ---- | ------------- | ------------- | ------------- | ------------- | -------------- | -------------- | -------------- | -------------- |
| 100% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |
| 125% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |
| 150% | [✅]          | [✅]          | [✅]          | [✅]          | [✅]           | [✅]           | [✅]           | [✅]           |

---

## Interaction Testing — Keyboard & Mouse

### Mouse

- [🟨] Hover states visible on all interactive elements: black buttons and dropdown menus dont have a on hover effect
- [🟨] Tooltips appear without overflow: "spending by category" is a black box otherwise the rest are ok
- [✅] Dropdowns open/close smoothly
- [✅] Contextual actions appear on hover

### Keyboard

- [✅] Tab through all pages — focus order logical
- [✅] All buttons and links focusable
- [✅] Focus outlines visible on all interactive elements
- [✅] Esc closes modals/dialogs
- [✅] Dropdowns usable with keyboard

### Dialogs & Modals

- [✅] Modals center and scale correctly at all breakpoints
- [🟨] No overflow or hidden controls at desktop sizes
- [✅] Esc key closes dialogs :"same story as dashboard"
- [✅] Multiple stacked modals do not cause layout corruption

---

## Test Environment

- **Browsers tested:** Chrome, Firefox
- **Breakpoints tested:** 1024px, 1280px, 1440px, 1920px
- **Zoom levels tested:** 100%, 125%, 150%

---
