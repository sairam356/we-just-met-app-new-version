import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, Outlet, useLocation } from "react-router-dom";
import { useMe } from "./api/hooks";
import { Layout, Spinner } from "./components/Layout";
import { saveReturnPathDurable } from "./lib/returnPath";

const Login = lazy(() => import("./pages/Login"));
const Verify = lazy(() => import("./pages/Verify"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Contacts = lazy(() => import("./pages/Contacts"));
const MyQR = lazy(() => import("./pages/MyQR"));
const Redeem = lazy(() => import("./pages/Redeem"));
const ConnectionDetail = lazy(() => import("./pages/ConnectionDetail"));
const Profile = lazy(() => import("./pages/Profile"));

function RequireAuth() {
  const me = useMe();
  const loc = useLocation();
  if (me.isLoading) return <Spinner />;
  if (!me.data) {
    saveReturnPathDurable(loc.pathname + loc.search);
    return <Navigate to="/login" replace />;
  }
  if (!me.data.name && loc.pathname !== "/onboarding") return <Navigate to={`/onboarding?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return <Outlet />;
}

const S = ({ children }: { children: React.ReactNode }) => <Suspense fallback={<Spinner />}>{children}</Suspense>;

export const router = createBrowserRouter([
  { path: "/login", element: <S><Login /></S> },
  { path: "/auth/verify", element: <S><Verify /></S> },
  {
    element: <RequireAuth />,
    children: [
      { path: "/onboarding", element: <S><Onboarding /></S> },
      {
        element: <Layout />,
        children: [
          { path: "/", element: <S><Contacts /></S> },
          { path: "/qr", element: <S><MyQR /></S> },
          { path: "/x/:token", element: <S><Redeem /></S> },
          { path: "/c/:id", element: <S><ConnectionDetail /></S> },
          { path: "/profile", element: <S><Profile /></S> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
