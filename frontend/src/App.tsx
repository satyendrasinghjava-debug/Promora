import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { captureUtm } from './lib/analytics';
import PublicLayout from './layouts/PublicLayout';
import { AdminLayout, DashboardLayout } from './layouts/AppLayouts';
import { Spinner } from './components/ui';
import Home from './pages/public/Home';
import * as P from './pages/public/Pages';
import * as A from './pages/auth/Auth';

// Signed-in areas are split from the public bundle; the admin console is its own chunk.
const Account = lazy(() => import('./pages/dashboard/Account').then((m) => ({ default: m.AccountRoutes })));
const AdvertiserArea = lazy(() => import('./pages/advertiser/Advertiser').then((m) => ({ default: m.AdvertiserRoutes })));
const PromoterArea = lazy(() => import('./pages/promoter/Promoter').then((m) => ({ default: m.PromoterRoutes })));
const AdminArea = lazy(() => import('./pages/admin/Admin').then((m) => ({ default: m.AdminRoutes })));

export default function App() {
  useEffect(() => { captureUtm(); }, []);
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<P.About />} />
          <Route path="/how-it-works" element={<P.HowItWorks />} />
          <Route path="/pricing" element={<P.Pricing />} />
          <Route path="/discover" element={<P.Discover />} />
          <Route path="/campaigns" element={<P.Campaigns />} />
          <Route path="/campaigns/:id" element={<P.CampaignDetail />} />
          <Route path="/categories" element={<P.Categories />} />
          <Route path="/creators" element={<P.Creators />} />
          <Route path="/creators/:slug" element={<P.CreatorDetail />} />
          <Route path="/businesses" element={<P.Businesses />} />
          <Route path="/businesses/:slug" element={<P.BusinessDetail />} />
          <Route path="/contact" element={<P.Contact />} />
          <Route path="/faq" element={<P.Faq />} />
          <Route path="/privacy-policy" element={<P.Legal doc="privacy-policy" />} />
          <Route path="/terms" element={<P.Legal doc="terms" />} />
          <Route path="/refund-policy" element={<P.Legal doc="refund-policy" />} />
          <Route path="*" element={<P.NotFound />} />
        </Route>
        <Route path="/login" element={<A.Login />} />
        <Route path="/register" element={<A.Register />} />
        <Route path="/verify-email" element={<A.VerifyEmail />} />
        <Route path="/forgot-password" element={<A.ForgotPassword />} />
        <Route path="/reset-password" element={<A.ResetPassword />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route path="advertiser/*" element={<AdvertiserArea />} />
          <Route path="promoter/*" element={<PromoterArea />} />
          <Route index element={<Account />} />
          <Route path="*" element={<Account />} />
        </Route>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminArea />} />
          <Route path="*" element={<AdminArea />} />
        </Route>
        <Route path="/signup" element={<Navigate to="/register" replace />} />
      </Routes>
    </Suspense>
  );
}
