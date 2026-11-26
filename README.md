# Lumina — player para listas XC API

Player web estilo streaming (home com destaque, prateleiras, detalhes, temporadas) para servidores
compatíveis com Xtream Codes (`player_api.php`).

## Rodar

```bash
npm install
npm run dev        # http://127.0.0.1:8787 (Vite + proxy, recarrega o servidor ao editar)
npm run build && npm start   # produção: serve dist/ + proxy
```

Na tela de login, use seu servidor (`http://host:porta`, usuário, senha) ou
**Usar servidor de demonstração** (mock local `demo/demo` com streams públicos de teste).

## Arquitetura

- `server/proxy.ts` — `POST /api/xc` (encaminha `player_api.php`, evita CORS) e `GET /stream?url=`
  (proxy de mídia com `Range`, reescreve playlists HLS). Só acessa origens registradas por um login
  bem-sucedido ou referenciadas pelas playlists. Escuta apenas em `127.0.0.1`.
- `server/mock.ts` — servidor XC falso para testes.
- `src/lib/xc.ts` — cliente XC com validação Zod tolerante (campos string/número/nulo).
- `src/components/Player.tsx` — hls.js (`.m3u8`), mpegts.js (`.ts` ao vivo) e nativo (`mp4`/`mkv`);
  ao vivo tenta m3u8 e cai para ts. Retomada, próximo episódio, zapping (↑/↓), EPG, atalhos
  (espaço, ←/→ 10 s, F, M, Esc).
- Favoritos e progresso ficam no `localStorage`, separados por servidor + usuário.

## Scripts

`npm run typecheck` · `npm test` · `npm run build`
