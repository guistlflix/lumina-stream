export function Loading(props: { error?: string }) {
  if (props.error)
    return (
      <main className="page center">
        <div className="state-box">
          <h2>Não foi possível carregar o catálogo</h2>
          <p>{props.error}</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Tentar novamente
          </button>
        </div>
      </main>
    );
  return (
    <main className="page center">
      <div className="loader" aria-label="Carregando" />
    </main>
  );
}
