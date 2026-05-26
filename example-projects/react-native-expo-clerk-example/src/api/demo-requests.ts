export interface DemoRequestOutcome {
  status: number;
  body: unknown;
}

export interface DemoApiDefinition {
  id: string;
  title: string;
  description: string;
  run: () => Promise<DemoRequestOutcome>;
}

/** Public HTTP samples — no API keys; distinct hosts/methods for Mockifyer demos. */
export const DEMO_APIS: DemoApiDefinition[] = [
  {
    id: 'pokeapi',
    title: 'PokéAPI — GET JSON',
    description: 'https://pokeapi.co/api/v2/pokemon/pikachu',
    run: async () => {
      const res = await fetch('https://pokeapi.co/api/v2/pokemon/pikachu');
      return { status: res.status, body: await res.json() };
    },
  },
  {
    id: 'pokeapi-list',
    title: 'PokéAPI — GET paginated list',
    description: 'First page of species (limit=8)',
    run: async () => {
      const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=8');
      return { status: res.status, body: await res.json() };
    },
  },
  {
    id: 'rick-morty',
    title: 'Rick & Morty API — GET JSON',
    description: 'https://rickandmortyapi.com/api/character/1',
    run: async () => {
      const res = await fetch('https://rickandmortyapi.com/api/character/1');
      return { status: res.status, body: await res.json() };
    },
  },
  {
    id: 'dog-ceo',
    title: 'Dog CEO — GET JSON',
    description: 'Random dog breed image URL',
    run: async () => {
      const res = await fetch('https://dog.ceo/api/breeds/image/random');
      return { status: res.status, body: await res.json() };
    },
  },
  {
    id: 'catfact',
    title: 'Cat Facts — GET JSON',
    description: 'https://catfact.ninja/fact',
    run: async () => {
      const res = await fetch('https://catfact.ninja/fact');
      return { status: res.status, body: await res.json() };
    },
  },
  {
    id: 'restcountries',
    title: 'REST Countries — GET query',
    description: 'Country lookup by name (fields trimmed)',
    run: async () => {
      const url =
        'https://restcountries.com/v3.1/name/sweden?fields=name,capital,population,flags';
      const res = await fetch(url);
      return { status: res.status, body: await res.json() };
    },
  },
  {
    id: 'randomuser',
    title: 'RandomUser — GET JSON',
    description: 'https://randomuser.me/api/',
    run: async () => {
      const res = await fetch('https://randomuser.me/api/?nat=us&results=1');
      return { status: res.status, body: await res.json() };
    },
  },
  {
    id: 'open-meteo',
    title: 'Open-Meteo — GET query string',
    description: 'Forecast with latitude/longitude params',
    run: async () => {
      const url =
        'https://api.open-meteo.com/v1/forecast?latitude=59.33&longitude=18.06&current_weather=true';
      const res = await fetch(url);
      return { status: res.status, body: await res.json() };
    },
  },
  {
    id: 'nationalize',
    title: 'Nationalize — GET JSON',
    description: 'https://api.nationalize.io?name=alex',
    run: async () => {
      const res = await fetch('https://api.nationalize.io?name=alex');
      return { status: res.status, body: await res.json() };
    },
  },
  {
    id: 'github',
    title: 'GitHub REST — GET + Accept header',
    description: 'Public repo metadata (rate limits apply)',
    run: async () => {
      const res = await fetch('https://api.github.com/repos/axios/axios', {
        headers: { Accept: 'application/vnd.github+json' },
      });
      return { status: res.status, body: await res.json() };
    },
  },
  {
    id: 'reqres-post',
    title: 'ReqRes — POST JSON body',
    description: 'Illustrates POST body hashing in Mockifyer',
    run: async () => {
      const res = await fetch('https://reqres.in/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Mockifyer Demo',
          job: 'recording HTTP',
        }),
      });
      return { status: res.status, body: await res.json() };
    },
  },
];

export function formatPreview(body: unknown, maxLength = 280): string {
  const text =
    typeof body === 'string' ? body : JSON.stringify(body, null, 2);
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}…`;
}
