import { createBrowserRouter } from 'react-router-dom'
import Shell from '@/components/layout/Shell'
import DashboardPage from '@/features/home/components/DashboardPage'
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
import RecurringInsightsPage from '@/features/insights/components/RecurringInsightsPage'
import CategoryAlertsPage from '@/features/insights/components/CategoryAlertsPage'
import SavingsSuggestionsPage from '@/features/insights/components/SavingsSuggestionsPage'
import SpendingProjectionPage from '@/features/insights/components/SpendingProjectionPage'
import SettingsPage from '@/features/settings/components/settings/SettingsPage'
import AccountsSettingsPage from '@/features/settings/components/accounts/AccountsSettingsPage'
import AccountFormPage from '@/features/settings/components/accounts/AccountFormPage'
import CategoriesSettingsPage from '@/features/settings/components/Categories/CategoriesSettingsPage'
import LabelsSettingsPage from '@/features/settings/components/labels/LabelsSettingsPage'
import ExchangeRatesSettingsPage from '@/features/settings/components/settings/ExchangeRatesSettingsPage'
import ImportExportPage from '@/features/settings/components/settings/ImportExportPage'
import GoogleDriveSyncPage from '@/features/settings/components/settings/GoogleDriveSyncPage'
import DataRetentionPage from '@/features/settings/components/settings/DataRetentionPage'
import PreferencesPage from '@/features/settings/components/settings/PreferencesPage'
import AiAssistantPage from '@/features/settings/components/settings/AiAssistantPage'
import OAuthCallbackPage from '@/features/settings/components/OAuthCallbackPage'
import RemindersPage from '@/features/reminders/components/RemindersPage'
import RecurringTransactionFormPage from '@/features/reminders/components/RecurringTransactionFormPage'
import CompoundInterestPage from '@/features/tools/components/CompoundInterestPage'

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
      {
        path: 'insights',
        children: [
          { index: true, element: <InsightsPage /> },
          { path: 'recurring', element: <RecurringInsightsPage /> },
          { path: 'category-alerts', element: <CategoryAlertsPage /> },
          { path: 'savings', element: <SavingsSuggestionsPage /> },
          { path: 'projection', element: <SpendingProjectionPage /> },
        ],
      },
      { path: 'reminders', element: <RemindersPage /> },
      { path: 'reminders/new', element: <RecurringTransactionFormPage /> },
      { path: 'reminders/:id', element: <RecurringTransactionFormPage /> },
      { path: 'tools/compound-interest', element: <CompoundInterestPage /> },
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
          { path: 'import-export', element: <ImportExportPage /> },
          { path: 'google-drive', element: <GoogleDriveSyncPage /> },
          { path: 'data-retention', element: <DataRetentionPage /> },
          { path: 'preferences', element: <PreferencesPage /> },
          { path: 'ai-assistant', element: <AiAssistantPage /> },
        ],
      },
    ],
  },
], {
  basename: import.meta.env.BASE_URL,
})
