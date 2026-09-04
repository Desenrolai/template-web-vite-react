export default function App() {
  return (
    <main style={styles.main}>
      <h1 style={styles.title}>Desenrolai &mdash; template Vite+React</h1>
      <p style={styles.subtitle}>
        Ponto de partida para aplicações web Desenrolai com Vite + React + TypeScript.
      </p>
    </main>
  );
}

const styles = {
  main: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    fontFamily: 'system-ui, sans-serif',
    gap: '1rem',
    padding: '2rem',
    textAlign: 'center' as const,
  },
  title: {
    fontSize: '2rem',
    fontWeight: 700,
    margin: 0,
  },
  subtitle: {
    color: '#555',
    margin: 0,
  },
};
