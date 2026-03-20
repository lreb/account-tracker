import { createBrowserRouter } from 'react-router-dom'
import Shell from '@/components/layout/Shell'
import DashboardPage from '@/features/reports/components/DashboardPage'
import TransactionListPage from '@/features/transactions/components/TransactionListPage'
import TransactionFormPage from '@/features/transactions/components/TransactionFormPage'
import VehicleListPage from '@/features/vehicles/components/VehicleListPage'
import VehicleDetailPage from '@/features/vehicles/components/VehicleDetailPage'
import FuelLogFormPage from '@/features/vehicles/components/FuelLogFormPage'
import ServiceFormPage from '@/features/vehicles/components/ServiceFormPage'
import ReportsPage from '@/features/reports/components/ReportsPage'
import BalanceSheetPage from '@/features/reports/components/BalanceSheetPage'
import BalanceSheetDetailPage from '@/features/reports/components/BalanceSheetDetailPage'
import BudgetsPage from '@/features/budgets/components/BudgetsPage'
import InsightsPage from '@/features/insights/components/InsightsPage'
import SettingsPage from '@/features/settings/components/SettingsPage'
import AccountsSettingsPage from '@/features/settings/components/AccountsSettingsPage'
import AccountFormPage from '@/features/settings/components/AccountFormPage'
import CategoriesSettingsPage from '@/features/settings/components/CategoriesSettingsPage'
import LabelsSettingsPage from '@/features/settings/components/LabelsSettingsPage'
import ExchangeRatesSettingsPage from '@/features/settings/components/ExchangeRatesSettingsPage'
import OAuthCallbackPage from '@/features/settings/components/OAuthCallbackPage'

export const router = createBrowserRouter([
  // OAuth callback — outside Shell so there's no nav chrome during the redirect
  { path: '/oauth-callback', element: <OAuthCallbackPage /> },
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'transactions', element: <TransactionListPage /> },
      { path: 'balance-sheet', element: <BalanceSheetPage /> },
      { path: 'balance-sheet/:accountId', element: <BalanceSheetDetailPage /> },
      { path: 'transactions/new', element: <TransactionFormPage /> },
      { path: 'transactions/:id', element: <TransactionFormPage /> },
      { path: 'vehicles', element: <VehicleListPage /> },
      { path: 'vehicles/:id', element: <VehicleDetailPage /> },
      { path: 'vehicles/:vehicleId/fuel/new', element: <FuelLogFormPage /> },
      { path: 'vehicles/:vehicleId/fuel/:fuelId', element: <FuelLogFormPage /> },
      { path: 'vehicles/:vehicleId/service/new', element: <ServiceFormPage /> },
      { path: 'vehicles/:vehicleId/service/:serviceId', element: <ServiceFormPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'budgets', element: <BudgetsPage /> },
      { path: 'insights', element: <InsightsPage /> },
      {
        path: 'settings',
        children: [
          { index: true, element: <SettingsPage /> },
          { path: 'accounts', element: <AccountsSettingsPage /> },
          { path: 'accounts/new', element: <AccountFormPage /> },
          { path: 'accounts/:id', element: <AccountFormPage /> },
          { path: 'categories', element: <CategoriesSettingsPage /> },
          { path: 'labels', element: <LabelsSettingsPage /> },
          { path: 'exchange-rates', element: <ExchangeRatesSettingsPage /> },
        ],
      },
    ],
  },
], {
  basename: import.meta.env.BASE_URL,
})
