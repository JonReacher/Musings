# Green Bay Packers Gameday

A phone-first live game page for the Green Bay Packers. Open `index.html` in any browser. There is nothing to install.

## What it does

- **Live field.** A 2D field with the Packers end zone on the left, showing the ball, the line of scrimmage, the first-down line, how far the current drive has come and which way the offense is heading. The ball slides to its new spot on each update.
- **Offense or defense.** A badge says whether the Packers have the ball, and the scoreboard marks the team in possession.
- **Game situation.** Quarter and clock, score, timeouts left, down and distance, ball spot and a red-zone flag.
- **Play by play.** The last play with yards gained, every play of the current drive, and how each earlier drive ended.
- **Box score.** Team stats side by side, player leaders, score by quarter and each scoring play.
- **Between games.** A kickoff countdown on game day, the final score after a win, and NFC North standings otherwise.

## Notes

- Data comes from ESPN's public NFL feed. During a game the page refreshes every 10 seconds; the clock only moves when it refreshes.
- Team logos: put image files in a `logos` folder next to `index.html`, named by team abbreviation in lowercase (`gb.png`, `min.png`, `chi.png`, `det.png` and so on), or paste image links into `LOGO_URLS` near the top of the script. Until a logo is there, each slot shows a team-colored circle with the abbreviation.
- To preview the other views, add `#upcoming`, `#win` or `#standings` to the address.
