import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  CloudUpload, CloudDownload, LogOut, Info, Folder,
} from 'lucide-react'

import { useTransactionsStore } from '@/stores/transactions.store'
import { useAccountsStore } from '@/stores/accounts.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useLabelsStore } from '@/stores/labels.store'
import { useBudgetsStore } from '@/stores/budgets.store'
import { useVehiclesStore } from '@/stores/vehicles.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useExchangeRatesStore } from '@/stores/exchange-rates.store'
import {
  buildFullBackup,
  parseBackupFile, restoreFromBackup,
} from '@/lib/backup'
import {
  type DriveFolderOption,
  APP_BACKUP_FOLDER_NAME,
  createDriveFolder,
  ensureAppBackupFolder,
  isGoogleDriveConfigured, isSignedInToGoogle,
  startGoogleSignIn, signOutOfGoogle,
  uploadBackupToDrive, downloadBackupFromDrive, listDriveFolders,
} from '@/lib/google-drive'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export default function GoogleDriveSyncPage() {
  const { t } = useTranslation()
  const { load: loadTransactions } = useTransactionsStore()
  const { load: loadAccounts } = useAccountsStore()
  const { load: loadCategories } = useCategoriesStore()
  const { load: loadLabels } = useLabelsStore()
  const { load: loadBudgets } = useBudgetsStore()
  const { load: loadVehicles } = useVehiclesStore()
  const {
    load: loadSettings,
    saveSetting,
    googleClientId,
    googleDriveFolderId,
    googleDriveFolderName,
  } = useSettingsStore()
  const { load: loadExchangeRates } = useExchangeRatesStore()

  const [isBusy, setIsBusy] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState<null | (() => Promise<void>)>(null)
  const [driveSignedIn, setDriveSignedIn] = useState(() => isSignedInToGoogle())
  const [editingDriveConfig, setEditingDriveConfig] = useState(false)
  const [tempClientId, setTempClientId] = useState(googleClientId)
  const [folderOptions, setFolderOptions] = useState<DriveFolderOption[]>([])
  const [isLoadingFolders, setIsLoadingFolders] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState(googleDriveFolderId || 'root')
  const [newFolderName, setNewFolderName] = useState('')

  const driveConfigured = isGoogleDriveConfigured(googleClientId)

  async function handleLoadFolders() {
    if (isLoadingFolders) return
    setIsLoadingFolders(true)
    try {
      const folders = await listDriveFolders()
      setFolderOptions(folders)
    } catch (err) {
      console.error(err)
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.toLowerCase().includes('outdated') || msg.toLowerCase().includes('insufficientscopes')) {
        setDriveSignedIn(false)
      }
      toast.error(msg)
    } finally {
      setIsLoadingFolders(false)
    }
  }

  useEffect(() => {
    if (!driveSignedIn) return

    let cancelled = false

    async function initializeDefaultFolder() {
      setIsLoadingFolders(true)
      try {
        const folders = await listDriveFolders()
        const selectedExists = !!googleDriveFolderId
          && googleDriveFolderId !== 'root'
          && folders.some((folder) => folder.id === googleDriveFolderId)

        if (selectedExists) {
          if (cancelled) return
          setFolderOptions(folders)
          setSelectedFolderId(googleDriveFolderId)
          return
        }

        const appFolder = await ensureAppBackupFolder()
        if (cancelled) return

        const foldersWithApp = folders.some((folder) => folder.id === appFolder.id)
          ? folders
          : [...folders, appFolder].sort((a, b) => a.name.localeCompare(b.name))

        setFolderOptions(foldersWithApp)
        setSelectedFolderId(appFolder.id)
        await saveSetting('googleDriveFolderId', appFolder.id)
        await saveSetting('googleDriveFolderName', appFolder.name)
      } catch (err) {
        console.error(err)
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.toLowerCase().includes('outdated') || msg.toLowerCase().includes('insufficientscopes')) {
          setDriveSignedIn(false)
        }
        toast.error(msg)
      } finally {
        if (!cancelled) {
          setIsLoadingFolders(false)
        }
      }
    }

    initializeDefaultFolder()

    return () => {
      cancelled = true
    }
  }, [driveSignedIn, googleDriveFolderId, saveSetting])

  async function handleSaveDriveFolder() {
    try {
      const selectedName = selectedFolderId === 'root'
        ? ''
        : folderOptions.find((f) => f.id === selectedFolderId)?.name ?? googleDriveFolderName
      await saveSetting('googleDriveFolderId', selectedFolderId)
      await saveSetting('googleDriveFolderName', selectedName)
      toast.success(t('common.saved'))
    } catch (err) {
      console.error(err)
      toast.error(t('settings.saveError', 'Failed to save config'))
    }
  }

  async function handleCreateFolder() {
    const folderName = newFolderName.trim()
    if (!folderName) {
      toast.error(t('settings.driveFolderNameRequired'))
      return
    }

    setIsBusy(true)
    try {
      const created = await createDriveFolder(folderName)
      const nextFolders = [...folderOptions, created].sort((a, b) => a.name.localeCompare(b.name))
      setFolderOptions(nextFolders)
      setSelectedFolderId(created.id)
      await saveSetting('googleDriveFolderId', created.id)
      await saveSetting('googleDriveFolderName', created.name)
      setNewFolderName('')
      toast.success(t('settings.driveFolderCreated', { name: created.name }))
    } catch (err) {
      console.error(err)
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.toLowerCase().includes('outdated') || msg.toLowerCase().includes('insufficientscopes')) {
        setDriveSignedIn(false)
      }
      toast.error(msg)
    } finally {
      setIsBusy(false)
    }
  }

  async function reloadAll() {
    await Promise.all([
      loadTransactions(), loadAccounts(), loadCategories(),
      loadLabels(), loadBudgets(), loadVehicles(),
      loadSettings(), loadExchangeRates(),
    ])
  }

  function handleDriveConnect() {
    try {
      startGoogleSignIn(googleClientId, '/settings/google-drive')
    } catch (err) {
      console.error(err)
      toast.error(t('settings.driveNotConfigured'))
    }
  }

  function handleDriveDisconnect() {
    signOutOfGoogle()
    setDriveSignedIn(false)
    toast.success(t('settings.driveDisconnected'))
  }

  async function handleSaveDriveConfig() {
    setIsBusy(true)
    try {
      const clientId = tempClientId.trim()
      if (!clientId) {
        toast.error(t('settings.driveNotConfigured'))
        return
      }

      await saveSetting('googleClientId', clientId)
      setEditingDriveConfig(false)
      toast.success(t('common.saved'))
      startGoogleSignIn(clientId, '/settings/google-drive')
    } catch {
      toast.error(t('settings.saveError', 'Failed to save config'))
    } finally {
      setIsBusy(false)
    }
  }

  async function handleDriveBackup() {
    if (isBusy) return
    setIsBusy(true)
    try {
      const backup = await buildFullBackup()
      await uploadBackupToDrive(JSON.stringify(backup, null, 2), googleDriveFolderId || 'root')
      toast.success(t('settings.driveBackupSuccess'))
    } catch (err) {
      console.error(err)
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('expired') || msg.toLowerCase().includes('outdated') || msg.toLowerCase().includes('insufficientscopes')) setDriveSignedIn(false)
      toast.error(msg)
    } finally {
      setIsBusy(false)
    }
  }

  async function handleDriveRestoreClick() {
    setConfirmRestore(() => async () => {
      setIsBusy(true)
      try {
        const text = await downloadBackupFromDrive(googleDriveFolderId || 'root')
        const backup = parseBackupFile(text)
        await restoreFromBackup(backup)
        await reloadAll()
        toast.success(t('settings.jsonRestoreSuccess'))
      } catch (err) {
        console.error(err)
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('expired') || msg.toLowerCase().includes('outdated') || msg.toLowerCase().includes('insufficientscopes')) setDriveSignedIn(false)
        toast.error(msg)
      } finally {
        setIsBusy(false)
      }
    })
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-xl font-bold">{t('settings.googleDriveTitle')}</h1>

      {editingDriveConfig ? (
        <div className="rounded-2xl border bg-white p-4 space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700">{t('settings.driveClientId')}</label>
            <input
              type="text"
              value={tempClientId}
              onChange={(e) => setTempClientId(e.target.value)}
              placeholder="12345678-xxxx.apps.googleusercontent.com"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border text-gray-900"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              {t('settings.driveClientIdHelp')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { setEditingDriveConfig(false); setTempClientId(googleClientId) }}>
              {t('common.cancel')}
            </Button>
            <Button className="flex-1" onClick={handleSaveDriveConfig} disabled={isBusy}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border divide-y overflow-hidden bg-white">
          {!driveSignedIn ? (
            <>
              <button type="button" onClick={handleDriveConnect}
                className="flex w-full items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                <CloudUpload size={18} className="text-blue-500 shrink-0" />
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium">{t('settings.driveConnect')}</p>
                  <p className="text-xs text-gray-400">
                    {driveConfigured ? t('settings.driveConnectDesc') : t('settings.driveNotConfigured')}
                  </p>
                </div>
              </button>
              <button type="button" onClick={() => { setTempClientId(googleClientId); setEditingDriveConfig(true) }}
                className="flex w-full items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                <Info size={18} className="text-gray-400 shrink-0" />
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-gray-600">{t('settings.driveConfigureBtn')}</p>
                </div>
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                <p className="flex-1 text-sm text-gray-700">{t('settings.driveConnected')}</p>
                <button type="button" onClick={handleDriveDisconnect}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors">
                  <LogOut size={13} />
                  {t('settings.driveDisconnect')}
                </button>
              </div>

              <div className="px-4 py-3 bg-gray-50/60 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Folder size={16} className="text-gray-500" />
                    <span>{t('settings.driveFolder')}</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleLoadFolders}
                    disabled={isLoadingFolders || isBusy}
                  >
                    {isLoadingFolders ? t('settings.driveFolderLoading') : t('settings.driveFolderLoad')}
                  </Button>
                </div>
                <select
                  value={selectedFolderId}
                  onChange={(e) => setSelectedFolderId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  disabled={isBusy}
                >
                  <option value="root">{t('settings.driveFolderRoot')}</option>
                  {folderOptions.map((folder) => (
                    <option key={folder.id} value={folder.id}>{folder.name}</option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500">{t('settings.driveFolderHelp')}</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder={t('settings.driveFolderNewPlaceholder', { defaultValue: APP_BACKUP_FOLDER_NAME })}
                    className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    disabled={isBusy || isLoadingFolders}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCreateFolder}
                    disabled={isBusy || isLoadingFolders}
                  >
                    {t('settings.driveFolderCreate')}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSaveDriveFolder}
                  disabled={isBusy}
                >
                  {t('common.save')}
                </Button>
              </div>

              <button type="button" onClick={handleDriveBackup} disabled={isBusy}
                className="flex w-full items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors disabled:opacity-50">
                <CloudUpload size={18} className="text-indigo-500 shrink-0" />
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium">{t('settings.driveBackup')}</p>
                  <p className="text-xs text-gray-400">{t('settings.driveBackupDesc')}</p>
                </div>
              </button>
              <button type="button" onClick={handleDriveRestoreClick} disabled={isBusy}
                className="flex w-full items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors disabled:opacity-50">
                <CloudDownload size={18} className="text-amber-500 shrink-0" />
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium">{t('settings.driveRestore')}</p>
                  <p className="text-xs text-gray-400">{t('settings.driveRestoreDesc')}</p>
                </div>
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Destructive restore confirmation dialog ──────────────────────── */}
      <Dialog open={!!confirmRestore} onOpenChange={(open) => { if (!open) setConfirmRestore(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.restoreConfirmTitle')}</DialogTitle>
            <DialogDescription>{t('settings.restoreConfirmDesc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmRestore(null)} disabled={isBusy}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={isBusy}
              onClick={async () => {
                if (confirmRestore) await confirmRestore()
                setConfirmRestore(null)
              }}
            >
              {isBusy ? t('common.loading') : t('settings.restoreConfirmAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
