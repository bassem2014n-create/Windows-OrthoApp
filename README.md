# Windows-OrthoApp

Offline orthopedic records, scoring, labs, radiology measurements and research (Electron build of OrthoApp).

## 0.17.0 — thesis & research changes
- **Thesis tab:** *Ghost sign present* and *Tear gap size (mm)* appear when *Posterior root* is anything other than *Intact*.
- **Research hub → Cohort builder:** every Thesis item (plus BMI and affected side) is an inclusion filter — tick categories or give a number range.
- **Research hub → Associations (new):** pick any two items; the test follows the item types (Spearman/Pearson, Welch t + Mann–Whitney, ANOVA + Kruskal–Wallis, chi-square + Fisher's exact with odds ratio) and a "characteristics by group" table with a p-value per item.
- **CSV exports:** column headings now use the item names shown in the app (e.g. "Absolute medial meniscus extrusion (mm)").

Build: GitHub Actions → *Build OrthoApp for Windows* → artifact `OrthoApp-Windows`.
