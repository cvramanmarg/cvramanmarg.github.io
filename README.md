# CV Raman Marg Daily Brief

Static site for cvramanmarg.github.io. Each day's brief is one small file in `briefs/`, named by date (for example `2026-09-30.json`). GitHub builds the page, the archive and the search from those files.

## Every day (about a minute)
1. Open the day's file `YYYY-MM-DD.json` from the Drive folder and download it.
2. In this repository open the `briefs` folder -> Add file -> Upload files -> drop the file -> Commit changes.
3. Wait one to two minutes. The new brief appears at the top; yesterday's moves into "Earlier briefs" by itself. The date at the top comes from the newest file.

If the Actions tab shows a red cross, a file has a typo. Click the failed run to read the plain-English message. The live site stays as it was.

## To correct a brief
Open the file in `briefs`, click the pencil icon, fix the text, Commit.

## Visitor counter
Register a code at goatcounter.com, then put it in `config.json`, for example `"goatcounter": "cvramanmarg"`. Commit. Counting starts on the next build.

## Files
- `briefs/` one file per day (the only thing that changes daily)
- `site/` page template, styles, search script
- `build.js` turns the above into the finished site
- `.github/workflows/pages.yml` runs the build on every upload
