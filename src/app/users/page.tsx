'use client'
import { useCallback, useEffect, useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { MobileListCard } from '@/components/ui/MobileListCard'
import { LoadingState } from '@/components/ui/LoadingState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { authFetch } from '@/lib/client-api'
import { Avatar } from '@/components/ui/Avatar'

interface User {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [deactivateUser, setDeactivateUser] = useState<User | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'TEACHER' })

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await authFetch<{ users: User[] }>('/api/users')
    if (data?.users) setUsers(data.users)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async () => {
    setSaving(true)
    const { error } = await authFetch('/api/users', {
      method: 'POST',
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!error) {
      setShowForm(false)
      setForm({ name: '', email: '', password: '', role: 'TEACHER' })
      load()
    }
  }

  const handleDeactivate = async () => {
    if (!deactivateUser) return
    setSaving(true)
    await authFetch('/api/users', {
      method: 'PATCH',
      body: JSON.stringify({ id: deactivateUser.id, isActive: false }),
    })
    setSaving(false)
    setDeactivateUser(null)
    load()
  }

  if (loading) return <LoadingState message="Loading users..." />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">User Management</h1>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" />
          Add User
        </Button>
      </div>

      <div className="space-y-3">
        {users.map((user) => (
          <MobileListCard
            key={user.id}
            title={user.name}
            subtitle={user.email}
            meta={user.role.replace('_', ' ')}
            left={<Avatar name={user.name} size="sm" />}
            badge={
              <Badge variant={user.isActive ? 'success' : 'neutral'}>
                {user.isActive ? 'Active' : 'Inactive'}
              </Badge>
            }
            onClick={() => !user.isActive ? null : setDeactivateUser(user)}
          />
        ))}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add User">
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Select
            label="Role"
            options={[
              { value: 'ADMIN', label: 'Admin' },
              { value: 'TEACHER', label: 'Teacher' },
              { value: 'SUPER_ADMIN', label: 'Super Admin' },
            ]}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          />
          <Button fullWidth loading={saving} onClick={handleCreate}>
            <Users className="w-4 h-4" />
            Create User
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deactivateUser}
        onClose={() => setDeactivateUser(null)}
        onConfirm={handleDeactivate}
        title="Deactivate User"
        message={`Deactivate ${deactivateUser?.name}? They will no longer be able to sign in.`}
        confirmLabel="Deactivate"
        loading={saving}
        danger
      />
    </div>
  )
}
