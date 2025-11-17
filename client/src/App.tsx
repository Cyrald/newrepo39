import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/providers/theme-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import CatalogPage from "@/pages/catalog-page";
import ProductDetailPage from "@/pages/product-detail-page";
import CartPage from "@/pages/cart-page";
import CheckoutPage from "@/pages/checkout-page";
import LoginPage from "@/pages/login-page";
import RegisterPage from "@/pages/register-page";
import VerifyEmailPage from "@/pages/verify-email-page";
import ProfilePage from "@/pages/profile-page";
import WishlistPage from "@/pages/wishlist-page";
import ComparisonPage from "@/pages/comparison-page";
import PrivacyPolicyPage from "@/pages/privacy-policy-page";
import AdminDashboardPage from "@/pages/admin/dashboard-page";
import AdminUsersPage from "@/pages/admin/users-page";
import AdminProductsPage from "@/pages/admin/products-page";
import AdminCategoriesPage from "@/pages/admin/categories-page";
import AdminPromocodesPage from "@/pages/admin/promocodes-page";
import AdminOrdersPage from "@/pages/admin/orders-page";
import AdminSupportChatPage from "@/pages/admin/support-chat-page";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/catalog" component={CatalogPage} />
      <Route path="/products/:id" component={ProductDetailPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/verify-email" component={VerifyEmailPage} />
      <Route path="/privacy-policy" component={PrivacyPolicyPage} />
      
      {/* Protected Routes - require authentication */}
      <Route path="/cart">
        <ProtectedRoute>
          <CartPage />
        </ProtectedRoute>
      </Route>
      <Route path="/checkout">
        <ProtectedRoute>
          <CheckoutPage />
        </ProtectedRoute>
      </Route>
      <Route path="/profile">
        <ProtectedRoute>
          <ProfilePage />
        </ProtectedRoute>
      </Route>
      <Route path="/profile/:tab">
        <ProtectedRoute>
          <ProfilePage />
        </ProtectedRoute>
      </Route>
      <Route path="/wishlist">
        <ProtectedRoute>
          <WishlistPage />
        </ProtectedRoute>
      </Route>
      <Route path="/comparison">
        <ProtectedRoute>
          <ComparisonPage />
        </ProtectedRoute>
      </Route>
      
      {/* Admin Routes - require staff role */}
      <Route path="/admin">
        <ProtectedRoute roles={["admin", "marketer", "consultant"]}>
          <AdminDashboardPage />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute roles={["admin"]}>
          <AdminUsersPage />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/products">
        <ProtectedRoute roles={["admin", "marketer"]}>
          <AdminProductsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/categories">
        <ProtectedRoute roles={["admin", "marketer"]}>
          <AdminCategoriesPage />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/promocodes">
        <ProtectedRoute roles={["admin", "marketer"]}>
          <AdminPromocodesPage />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/orders">
        <ProtectedRoute roles={["admin", "consultant"]}>
          <AdminOrdersPage />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/support">
        <ProtectedRoute roles={["admin", "consultant"]}>
          <AdminSupportChatPage />
        </ProtectedRoute>
      </Route>
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
