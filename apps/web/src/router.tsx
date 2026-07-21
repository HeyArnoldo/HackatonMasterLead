import { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from '@/components/protected-route';
import { AppLayout } from '@/layouts/app-layout';

// Páginas lazy-loaded: cada una es un chunk separado.
const LoginPage = lazy(() => import('@/pages/login'));
const RegisterPage = lazy(() => import('@/pages/register'));
const ChatPage = lazy(() => import('@/pages/chat'));
const MisSesionesPage = lazy(() => import('@/pages/mis-sesiones'));
const SesionDetallePage = lazy(() => import('@/pages/sesion-detalle'));

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <ChatPage /> },
          { path: '/chat/:conversacionId', element: <ChatPage /> },
          { path: '/sesiones', element: <MisSesionesPage /> },
          { path: '/sesiones/:id', element: <SesionDetallePage /> },
        ],
      },
    ],
  },
]);
