const sampleStandings = [
  {
    league_code: "NL",
    conference_code: "R",
    division_code: "D",
    team_name: "SAN FRANCISCO SPIDERS",
    wins: 5,
    losses: 2,
    win_pct: 0.71429,
    rank_in_group: 2,
    offense_points: 1162,
    pitching_points: 855,
    total_points: 2017,
    plus_minus: 137,
    average_per_week: 288.14
  },
  {
    league_code: "NL",
    conference_code: "R",
    division_code: "D",
    team_name: "BROOKLYN ROBINS",
    wins: 4,
    losses: 3,
    win_pct: 0.57143,
    rank_in_group: 5,
    offense_points: 996,
    pitching_points: 976,
    total_points: 1972,
    plus_minus: 62,
    average_per_week: 281.71
  },
  {
    league_code: "NL",
    conference_code: "R",
    division_code: "D",
    team_name: "COLORADO CRUSADERS",
    wins: 4,
    losses: 3,
    win_pct: 0.57143,
    rank_in_group: 5,
    offense_points: 1060,
    pitching_points: 760,
    total_points: 1820,
    plus_minus: -147,
    average_per_week: 260.00
  },
  {
    league_code: "NL",
    conference_code: "R",
    division_code: "D",
    team_name: "CHICAGO ROGUES",
    wins: 5,
    losses: 2,
    win_pct: 0.71429,
    rank_in_group: 2,
    offense_points: 1032,
    pitching_points: 831,
    total_points: 1863,
    plus_minus: 50,
    average_per_week: 266.14
  }
];

const statusEl = document.querySelector("#status");
const standingsEl = document.querySelector("#standings");

function numberValue(value, digits = 0) {
  if (value === null || value === undefined || value === "") return "-";
  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  });
}

function pctValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  return Number(value).toFixed(3);
}

function groupStandings(rows) {
  return rows.reduce((groups, row) => {
    const key = `${row.league_code || "League"}-${row.conference_code || "Conference"}-${row.division_code || "Division"}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
    return groups;
  }, new Map());
}

function renderStandings(rows) {
  const groups = groupStandings(rows);
  standingsEl.innerHTML = "";

  for (const [key, groupRows] of groups.entries()) {
    const [league, conference, division] = key.split("-");
    const sortedRows = [...groupRows].sort((a, b) => {
      if ((a.rank_in_group || 999) !== (b.rank_in_group || 999)) {
        return (a.rank_in_group || 999) - (b.rank_in_group || 999);
      }
      return String(a.team_name).localeCompare(String(b.team_name));
    });

    const section = document.createElement("section");
    section.className = "division-table";
    section.innerHTML = `
      <div class="division-title">
        <h2>${division} Division</h2>
        <span>${league} / ${conference}</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Team</th>
              <th>W</th>
              <th>L</th>
              <th>Win %</th>
              <th>Rank</th>
              <th>Off</th>
              <th>Pit</th>
              <th>Total</th>
              <th>+/-</th>
              <th>Week Avg</th>
            </tr>
          </thead>
          <tbody>
            ${sortedRows.map((row) => `
              <tr>
                <td class="team-name">${row.team_name}</td>
                <td>${numberValue(row.wins)}</td>
                <td>${numberValue(row.losses)}</td>
                <td>${pctValue(row.win_pct)}</td>
                <td>${numberValue(row.rank_in_group)}</td>
                <td>${numberValue(row.offense_points)}</td>
                <td>${numberValue(row.pitching_points)}</td>
                <td>${numberValue(row.total_points)}</td>
                <td>${numberValue(row.plus_minus)}</td>
                <td>${numberValue(row.average_per_week, 2)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    standingsEl.append(section);
  }
}

async function loadStandings() {
  try {
    const response = await fetch("/api/standings");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const rows = payload.data || [];

    if (rows.length === 0) {
      statusEl.textContent = "No standings rows found yet. Showing sample Season 28 data.";
      renderStandings(sampleStandings);
      return;
    }

    statusEl.textContent = "";
    renderStandings(rows);
  } catch (error) {
    statusEl.textContent = "Supabase is not connected yet. Showing sample Season 28 data.";
    renderStandings(sampleStandings);
  }
}

loadStandings();
