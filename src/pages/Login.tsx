import { useState, type FormEvent } from "react";
import { Logo } from "../components/Header.tsx";
import type { Credentials } from "../lib/xc.ts";

export function Login(props: { onSubmit: (creds: Credentials) => Promise<void>; initialError?: string }) {
  const [host, setHost] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(props.initialError ?? "");

  const submit = async (creds: Credentials) => {
    setBusy(true);
    setError("");
    try {
      await props.onSubmit(creds);
    } catch (err) {
      console.warn("[login] failed", err);
      setError(err instanceof Error ? err.message : "Falha ao conectar");
      setBusy(false);
    }
  };

  const onForm = (e: FormEvent) => {
    e.preventDefault();
    void submit({ host, username, password });
  };

  return (
    <main className="login">
      <div className="login-glow" />
      <form className="login-card" onSubmit={onForm}>
        <Logo />
        <h1>Entre com sua lista</h1>
        <p className="login-sub">Conecte um servidor compatível com Xtream Codes (XC API).</p>
        <label>
          Servidor
          <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="http://servidor.com:8080" required autoComplete="url" />
        </label>
        <label>
          Usuário
          <input value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" />
        </label>
        <label>
          Senha
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </label>
        {error && <p className="login-error">{error}</p>}
        <button className="btn btn-primary block" disabled={busy}>
          {busy ? "Conectando…" : "Entrar"}
        </button>
        <button
          type="button"
          className="btn btn-ghost block"
          disabled={busy}
          onClick={() => void submit({ host: `${window.location.origin}/mock`, username: "demo", password: "demo" })}
        >
          Usar servidor de demonstração
        </button>
        <p className="login-note">As credenciais ficam salvas apenas neste navegador. O app só reproduz conteúdo das listas que você informar.</p>
      </form>
    </main>
  );
}
