# Windows-OrthoApp

Offline orthopedic records, scoring, labs, radiology measurements and research (Electron build of OrthoApp).

## 0.17.0 — thesis & research changes
- **Thesis tab:** *Ghost sign present* and *Tear gap size (mm)* appear when *Posterior root* is anything other than *Intact*.
- **Research hub → Cohort builder:** every Thesis item (plus BMI and affected side) is an inclusion filter — tick categories or give a number range.
- **Research hub → Associations (new):** pick any two items; the test follows the item types (Spearman/Pearson, Welch t + Mann–Whitney, ANOVA + Kruskal–Wallis, chi-square + Fisher's exact with odds ratio) and a "characteristics by group" table with a p-value per item.
- **CSV exports:** column headings now use the item names shown in the app (e.g. "Absolute medial meniscus extrusion (mm)").

## 0.21.0 — Guided measurements (Radiology tab)
- Pick the **region / view** of the image (Spine AP, Hip AP pelvis, Knee lateral, Knee long-leg AP, Foot weight-bearing AP, Wrist PA / lateral, Shoulder true AP) and a measurement. The app shows *Point X of N* with the exact instruction, draws the lines / circles / axes as you tap, then shows the value, the normal range and a short interpretation. Drag any placed point and the result recalculates live. Millimetre measurements prompt for calibration first; HKA asks for the limb side.
- 15 measurements: Cobb, LCEA, Tönnis, neck-shaft, Insall–Salvati, posterior tibial slope, HKA, mLDFA, MPTA, hallux valgus angle, intermetatarsal angle, radial inclination, ulnar variance, volar tilt, critical shoulder angle.
- Files: `guided-geometry.js` (maths + template engine), `measurement-templates.js` (the measurement library — data only; add a measurement by adding one entry), `guided-geometry.test.js` (`npm test`).

Build: GitHub Actions → *Build OrthoApp for Windows* → artifact `OrthoApp-Windows`.
