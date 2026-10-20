import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { UpdatePrompt } from '@/pwa/UpdatePrompt'
import { Providers } from './providers'
import { routes } from './routes'

const router = createBrowserRouter(routes)

export function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
      <UpdatePrompt />
    </Providers>
  )
}
