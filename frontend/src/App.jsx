import React, { useEffect, lazy, Suspense } from 'react'
import './App.css'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom' 
import MainLayout from './layouts/MainLayout'
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute'
import { apiPost } from './utils/api'
import ScrollToTop from './components/ScrollToTop'
import Toast from './components/Toast/Toast'
import Loader from './components/Loader/Loader'
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary'
import { useDispatch, useSelector } from 'react-redux'
import { fetchRates, loadCurrencyFromStorage } from './redux/currencySlice'

// Code-split route pages to optimize load time and reduce initial bundle size
const HomePage = lazy(() => import('./pages/HomePage/HomePage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage/RegisterPage'));
const LoginPage = lazy(() => import('./pages/LoginPage/LoginPage'));
const CreateListing = lazy(() => import('./pages/CreateListing/CreateListing'));
const EditListing = lazy(() => import('./pages/EditListing/EditListing'));
const ListingDetails = lazy(() => import('./pages/ListingDetails/ListingDetails'));
const TripList = lazy(() => import('./pages/TripList/TripList'));
const WishList = lazy(() => import('./pages/WishList/WishList'));
const PropertyList = lazy(() => import('./pages/PropertyList/PropertyList'));
const ReservationList = lazy(() => import('./pages/ReservationList/ReservationList'));
const CategoryPage = lazy(() => import('./pages/CategoryPage/CategoryPage'));
const SearchPage = lazy(() => import('./pages/SearchPage/SearchPage'));
const ExplorePage = lazy(() => import('./pages/ExplorePage/ExplorePage'));
const BecomeHost = lazy(() => import('./pages/BecomeHost/BecomeHost'));
const ProfilePage = lazy(() => import('./pages/ProfilePage/ProfilePage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage/CheckoutPage'));
const HostDashboard = lazy(() => import('./pages/HostDashboard/HostDashboard'));
const ChatPage = lazy(() => import('./pages/ChatPage/ChatPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage/NotificationsPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard/AdminDashboard'));
const NotFound = lazy(() => import('./pages/NotFound/NotFound'));

// Handler to restore intended route when redirected by static host 404.html fallback
const SpaRedirectHandler = () => {
  const navigate = useNavigate();
  useEffect(() => {
    try {
      const redirectPath = sessionStorage.getItem('spa_redirect_path');
      if (redirectPath) {
        sessionStorage.removeItem('spa_redirect_path');
        navigate(redirectPath, { replace: true });
      }
    } catch {
      // Ignore storage errors
    }
  }, [navigate]);
  return null;
};

function App() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user?.user);
  const userId = user?._id;

  useEffect(() => {
    dispatch(loadCurrencyFromStorage());
    dispatch(fetchRates('USD'));
  }, [dispatch]);

  useEffect(() => {
    if (!userId) return;

    const sendHeartbeat = async () => {
      // Don't send heartbeat if tab is in the background
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        await apiPost(`/users/${userId}/heartbeat`, {});
      } catch (err) {
        console.error("Heartbeat error:", err);
      }
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 60000); // 60s interval for better efficiency

    return () => clearInterval(interval);
  }, [userId]);

  return (
    <div>
      <BrowserRouter>
        <SpaRedirectHandler />
        <ScrollToTop />
        <Toast />
        <ErrorBoundary>
          <Suspense fallback={<Loader />}>
            <Routes>
              {/* Layout with Navbar & Footer */}
              <Route element={ <MainLayout /> } >
                <Route path='/' element={ <HomePage /> } />
                <Route path='/profile' element={ <ProtectedRoute><ProfilePage /></ProtectedRoute> } />
                <Route path='/create-listing' element={ <ProtectedRoute roles={['host', 'admin']}><CreateListing /></ProtectedRoute> } />
                <Route path='/properties/:listingId/edit' element={ <ProtectedRoute roles={['host', 'admin']}><EditListing /></ProtectedRoute> } />
                <Route path='/properties/:listingId' element={ <ListingDetails /> } />
                <Route path='/properties' element={ <ExplorePage /> } />
                <Route path='/explore' element={ <ExplorePage /> } />
                <Route path='/become-host' element={ <BecomeHost /> } />
                <Route path='/properties/category/:category' element={ <CategoryPage /> } />
                <Route path='/properties/search/:search' element={ <SearchPage /> } />
                <Route path='/admin/dashboard' element={ <ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute> } />
                <Route path='/admin/:tab' element={ <ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute> } />
                <Route path='/admin' element={ <ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute> } />
                <Route path='/:userId/trips' element={ <ProtectedRoute><TripList /></ProtectedRoute> } />
                <Route path='/:userId/wishList' element={ <ProtectedRoute><WishList /></ProtectedRoute> } />
                <Route path='/:userId/properties' element={ <ProtectedRoute roles={['host', 'admin']}><PropertyList /></ProtectedRoute> } />
                <Route path='/:userId/reservations' element={ <ProtectedRoute roles={['host', 'admin']}><ReservationList /></ProtectedRoute> } />
                <Route path='/checkout' element={ <ProtectedRoute><CheckoutPage /></ProtectedRoute> } />
                <Route path='/host/dashboard' element={ <ProtectedRoute roles={['host', 'admin']}><HostDashboard /></ProtectedRoute> } />
                <Route path="/chat/:contactId?" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
                <Route path='/notifications' element={ <ProtectedRoute><NotificationsPage /></ProtectedRoute> } />
              </Route>
              {/* No Navbar/Footer on login & register */}
              <Route path='/register' element={ <RegisterPage /> } />
              <Route path='/login' element={ <LoginPage /> } />

              {/* Catch-all Not Found Route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </div>
  )
}

export default App
