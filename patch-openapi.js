import { readFileSync, writeFileSync } from 'node:fs';

let c = readFileSync('src/docs/openapi.js', 'utf8');

// Normalize CRLF to LF for easier matching
c = c.replace(/\r\n/g, '\n');

// 1. Add pace to exampleResult
c = c.replace(
  "  team_name: 'Equipe Horizonte',\n};\n\nconst exampleUpdateAthlete",
  "  team_name: 'Equipe Horizonte',\n  pace: '3:44 min/km',\n};\n\nconst exampleUpdateAthlete"
);

// 2. Add pace to exampleUpdateAthlete
c = c.replace(
  "  team_name: 'Equipe Horizonte Pro',\n};\n\nconst exampleImport",
  "  team_name: 'Equipe Horizonte Pro',\n  pace: '4:10 min/km',\n};\n\nconst exampleImport"
);

// 3. Add pace to exampleImport results array entry
c = c.replace(
  "    team_name: 'Equipe Horizonte',\n  }],\n};",
  "    team_name: 'Equipe Horizonte',\n    pace: '3:44 min/km',\n  }],\n};"
);

// 4. Add pace property to ImportedResult schema
c = c.replace(
  "          team_name: { type: 'string', maxLength: 200, nullable: true, example: 'Equipe Horizonte' },\n        },\n      },\n      Event:",
  "          team_name: { type: 'string', maxLength: 200, nullable: true, example: 'Equipe Horizonte' },\n          pace: { type: 'string', maxLength: 20, nullable: true, example: '3:44 min/km' },\n        },\n      },\n      Event:"
);

// 5. Add pace property to Result schema (required list + properties)
c = c.replace(
  "          'id', 'bib_number', 'athlete_name', 'category', 'status', 'gender',\n          'rank_general', 'rank_category', 'time_gross', 'time_net', 'team_name',\n        ],",
  "          'id', 'bib_number', 'athlete_name', 'category', 'status', 'gender',\n          'rank_general', 'rank_category', 'time_gross', 'time_net', 'team_name', 'pace',\n        ],"
);

c = c.replace(
  "          team_name: { type: 'string', nullable: true, example: exampleResult.team_name },\n        },\n      },\n      ImportResultsResponse:",
  "          team_name: { type: 'string', nullable: true, example: exampleResult.team_name },\n          pace: { type: 'string', maxLength: 20, nullable: true, example: exampleResult.pace },\n        },\n      },\n      ImportResultsResponse:"
);

// 6. Add pace property to UpdateResultRequest schema
c = c.replace(
  "          team_name: { type: 'string', maxLength: 200, nullable: true, example: 'Equipe Horizonte Pro' },\n          event_slug:",
  "          team_name: { type: 'string', maxLength: 200, nullable: true, example: 'Equipe Horizonte Pro' },\n          pace: { type: 'string', maxLength: 20, nullable: true, example: '4:10 min/km' },\n          event_slug:"
);

writeFileSync('src/docs/openapi.js', c);
console.log('openapi.js patched OK');

