'use client'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { LoadingState } from '@/components/ui/LoadingState'
import { authFetch } from '@/lib/client-api'

interface Settings {
  id: string
  name: string
  contactDetails?: string | null
  currency: string
  defaultTeacherRate: number
  defaultSessionCount: number
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await authFetch<{ settings: Settings }>('/api/settings')
    if (data?.settings) setSettings(data.settings)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    await authFetch('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        name: settings.name,
        contactDetails: settings.contactDetails,
        defaultTeacherRate: settings.defaultTeacherRate,
        defaultSessionCount: settings.defaultSessionCount,
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading || !settings) return <LoadingState message="Loading settings..." />

  return (
    <div className="space-y-4 max-w-lg">
      <h1 className="text-lg font-bold text-gray-900">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Institute Details</CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <Input
            label="Institute Name"
            value={settings.name}
            onChange={(e) => setSettings({ ...settings, name: e.target.value })}
          />
          <Input
            label="Contact Details"
            value={settings.contactDetails ?? ''}
            onChange={(e) => setSettings({ ...settings, contactDetails: e.target.value })}
          />
          <Input
            label="Default Teacher Rate (Rs./session)"
            type="number"
            value={settings.defaultTeacherRate}
            onChange={(e) => setSettings({ ...settings, defaultTeacherRate: Number(e.target.value) })}
          />
          <Input
            label="Default Monthly Session Count"
            type="number"
            hint="Used when subject-specific target is not set"
            value={settings.defaultSessionCount}
            onChange={(e) => setSettings({ ...settings, defaultSessionCount: Number(e.target.value) })}
          />
          <Button fullWidth loading={saving} onClick={handleSave}>
            Save Settings
          </Button>
          {saved && <p className="text-sm text-green-600 text-center">Settings saved.</p>}
        </div>
      </Card>
    </div>
  )
}
