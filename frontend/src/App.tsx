import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'

function App() {
  return (
    <MantineProvider>
      <Notifications position="top-right" />
      <div className="min-h-screen bg-gray-50 p-4">
        <h1 className="text-2xl font-bold text-gray-800">Hands-Free Gym Tracker</h1>
      </div>
    </MantineProvider>
  )
}

export default App
