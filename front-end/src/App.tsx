import { useState } from 'react'
import reactLogo from './assets/react.svg'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 text-white flex flex-col items-center justify-center gap-8">
      <header className="flex items-center gap-4">
        <img src={reactLogo} alt="React logo" className="h-16 w-16 animate-spin-slow" />
        <h1 className="text-4xl font-bold tracking-tight">CityU Hub</h1>
      </header>

      <p className="text-slate-300">React + Vite + Tailwind CSS 已就绪</p>

      <button
        type="button"
        onClick={() => setCount((c) => c + 1)}
        className="rounded-lg bg-indigo-500 px-6 py-3 text-base font-medium shadow-lg transition hover:bg-indigo-400 active:scale-95"
      >
        count is {count}
      </button>
    </div>
  )
}

export default App
